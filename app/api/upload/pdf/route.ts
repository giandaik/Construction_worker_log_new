import { put } from '@vercel/blob';
import { ApiError } from '@/lib/api/errorHandling';
import { ValidationUtils } from '@/lib/api/validation';
import { getAuthUser, isAdmin } from '@/utils/auth';

const MAX_BYTES = 25 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/octet-stream',
  '',
]);

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return ApiError.unauthorized();
    if (!isAdmin(user)) return ApiError.forbidden('Only admins or supervisors can upload PDF drawings');

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return ApiError.handle(new Error('BLOB_READ_WRITE_TOKEN is not configured'));
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const projectIdRaw = formData.get('projectId');

    if (!(file instanceof File)) {
      return ApiError.badRequest('No file provided');
    }
    if (typeof projectIdRaw !== 'string' || !projectIdRaw) {
      return ApiError.badRequest('projectId is required');
    }

    const projectId = ValidationUtils.normalizeObjectId(projectIdRaw).toString();

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return ApiError.badRequest('Only .pdf files are allowed');
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return ApiError.badRequest(`Unsupported file type: ${file.type}`);
    }
    if (file.size > MAX_BYTES) {
      return ApiError.badRequest('File exceeds 25MB limit');
    }

    const pathname = `projects/${projectId}/pdfs/${Date.now()}-${crypto.randomUUID()}.pdf`;

    const blob = await put(pathname, file, {
      access: 'public',
      contentType: 'application/pdf',
    });

    return ApiError.success({
      url: blob.url,
      pathname: blob.pathname,
      filename: file.name,
      size: file.size,
    });
  } catch (error) {
    return ApiError.handle(error);
  }
}
