import { ObjectId } from 'mongodb';
import { ValidationUtils, ValidationError } from '@/lib/api/validation';

/**
 * Normalizes a tenantId from HTTP/JWT context (string) or MongoDB (ObjectId)
 * into a BSON ObjectId for tenant-scoped queries and writes.
 *
 * Throws ValidationError for malformed IDs — callers must fail closed rather
 * than querying with an invalid tenantId (which could match nothing or behave
 * unpredictably).
 */
export function normalizeTenantId(tenantId: string | ObjectId): ObjectId {
  try {
    return ValidationUtils.normalizeObjectId(tenantId);
  } catch {
    throw new ValidationError('Invalid tenant ID format', 400);
  }
}

/**
 * Builds a MongoDB filter fragment `{ tenantId: ObjectId }` for direct
 * collection access outside BaseRepository (e.g. SSR dashboard queries).
 * Returns null when no tenant scope applies (platform / SUPER_ADMIN).
 */
export function tenantIdFilter(
  tenantId: string | null | undefined
): { tenantId: ObjectId } | null {
  if (!tenantId) return null;
  return { tenantId: normalizeTenantId(tenantId) };
}
