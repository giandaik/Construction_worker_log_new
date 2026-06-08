import { put } from '@vercel/blob';
import { ApiError } from '@/lib/api/errorHandling';
import { getAuthUser } from '@/utils/auth';

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return ApiError.unauthorized();

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return ApiError.handle(new Error('BLOB_READ_WRITE_TOKEN is not configured'));
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return ApiError.badRequest('No file provided');
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return ApiError.badRequest(`Unsupported file type: ${file.type}`);
    }
    if (file.size > MAX_BYTES) {
      return ApiError.badRequest('File exceeds 8MB limit');
    }

    const ext = file.type.split('/')[1] || 'jpg';
    const pathname = `worklogs/${user.userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const blob = await put(pathname, file, {
      access: 'public',
      contentType: file.type,
    });

    return ApiError.success({ url: blob.url, pathname: blob.pathname });
  } catch (error) {
    return ApiError.handle(error);
  }
}
