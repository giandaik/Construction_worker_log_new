import { del } from '@vercel/blob';
import { z } from 'zod';
import { ApiError } from '@/lib/api/errorHandling';
import { RepositoryFactory } from '@/lib/repositories';
import { getAuthUser, isAdmin } from '@/utils/auth';

const attachBodySchema = z.object({
  url: z.string().url(),
  pathname: z.string().min(1),
  filename: z.string().min(1),
  size: z.number().int().nonnegative(),
  pdfUrl: z.string().url().optional(),
  pdfFilename: z.string().min(1).optional(),
  pdfSize: z.number().int().nonnegative().optional(),
});

const removeBodySchema = z.object({
  url: z.string().url(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return ApiError.unauthorized();
    if (!isAdmin(user)) return ApiError.forbidden('Only admins or supervisors can manage DWG files');

    const { id } = await params;
    const parsed = attachBodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return ApiError.badRequest(parsed.error.issues.map(i => i.message).join(', '));
    }

    return await RepositoryFactory.withProjectRepository(async (projectRepo) => {
      const updated = await projectRepo.addDwgFile(id, {
        ...parsed.data,
        uploadedBy: user.userId,
      });
      if (!updated) return ApiError.notFound('Project');
      return ApiError.success(updated);
    });
  } catch (error) {
    return ApiError.handle(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return ApiError.unauthorized();
    if (!isAdmin(user)) return ApiError.forbidden('Only admins or supervisors can manage DWG files');

    const { id } = await params;
    const parsed = removeBodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return ApiError.badRequest(parsed.error.issues.map(i => i.message).join(', '));
    }

    const { updated, removedPdfUrl } = await RepositoryFactory.withProjectRepository(
      async (projectRepo) => {
        const existing = await projectRepo.findById(id);
        const pdfUrl = existing?.dwgFiles?.find((d) => d.url === parsed.data.url)?.pdfUrl;
        const result = await projectRepo.removeDwgFile(id, parsed.data.url);
        return { updated: result, removedPdfUrl: pdfUrl };
      },
    );
    if (!updated) return ApiError.notFound('Project');

    // Best-effort blob cleanup. The document is already updated; a failed blob delete
    // leaves an orphaned file but doesn't break the user-visible state.
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      for (const url of [parsed.data.url, removedPdfUrl].filter((u): u is string => Boolean(u))) {
        try {
          await del(url);
        } catch (blobError) {
          console.error('Failed to delete blob:', url, blobError);
        }
      }
    }

    return ApiError.success(updated);
  } catch (error) {
    return ApiError.handle(error);
  }
}
