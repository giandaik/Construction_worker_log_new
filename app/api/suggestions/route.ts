import { ApiError } from '@/lib/api/errorHandling';
import { DatabaseUtils } from '@/lib/api/database';
import { getAuthUser } from '@/utils/auth';
import mongoose from 'mongoose';

const ALLOWED_FIELDS = {
  'personnel.role': { collection: 'worklogs', path: 'personnel.role' },
  'equipment.type': { collection: 'worklogs', path: 'equipment.type' },
  'materials.name': { collection: 'worklogs', path: 'materials.name' },
  'materials.unit': { collection: 'worklogs', path: 'materials.unit' },
} as const;

type FieldKey = keyof typeof ALLOWED_FIELDS;

export async function GET(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return ApiError.unauthorized();
    }

    const { searchParams } = new URL(request.url);
    const field = searchParams.get('field') as FieldKey | null;
    const projectId = searchParams.get('project');

    if (!field || !(field in ALLOWED_FIELDS)) {
      return ApiError.badRequest(`field must be one of: ${Object.keys(ALLOWED_FIELDS).join(', ')}`);
    }

    const { collection, path } = ALLOWED_FIELDS[field];

    return await DatabaseUtils.withCollection(collection, async (worklogs) => {
      const match: Record<string, unknown> = {
        author: new mongoose.Types.ObjectId(user.userId),
      };
      if (projectId && mongoose.Types.ObjectId.isValid(projectId)) {
        match.project = new mongoose.Types.ObjectId(projectId);
      }

      const results = await worklogs
        .aggregate([
          { $match: match },
          { $unwind: `$${path.split('.')[0]}` },
          { $group: { _id: `$${path}`, count: { $sum: 1 } } },
          { $match: { _id: { $nin: [null, ''] } } },
          { $sort: { count: -1, _id: 1 } },
          { $limit: 50 },
        ])
        .toArray();

      const suggestions = results
        .map((r) => (typeof r._id === 'string' ? r._id.trim() : ''))
        .filter((s) => s.length > 0);

      return ApiError.success({ suggestions });
    });
  } catch (error) {
    return ApiError.handle(error);
  }
}
