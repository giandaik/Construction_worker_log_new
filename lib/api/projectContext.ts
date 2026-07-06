import { DatabaseUtils } from '@/lib/api/database';

export interface WorkLogProjectContext {
  projectName?: string;
  projectOwnerName?: string;
  projectContractorName?: string;
  projectOwnerEmail?: string;
  projectContractorEmail?: string;
  projectOwnerUserId?: string;
  projectContractorUserId?: string;
}

// Shared by the worklog PUT and reject routes. Errors are intentionally
// not swallowed here: a failed lookup must surface as a 5xx, not leave
// the owner fields undefined and turn into a misleading 403.
export async function fetchProjectContext(
  projectId: string | undefined
): Promise<WorkLogProjectContext> {
  if (!projectId) {
    return {};
  }

  return DatabaseUtils.withConnection(async (db) => {
    const { ObjectId } = await import('mongodb');
    const project = await db
      .collection('projects')
      .findOne({ _id: new ObjectId(projectId) });

    return {
      projectName: project?.name,
      projectOwnerName: project?.ownerName,
      projectContractorName: project?.contractorName,
      projectOwnerEmail: project?.ownerEmail,
      projectContractorEmail: project?.contractorEmail,
      projectOwnerUserId: project?.ownerUserId?.toString(),
      projectContractorUserId: project?.contractorUserId?.toString(),
    };
  });
}
