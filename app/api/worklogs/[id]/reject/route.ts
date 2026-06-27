import { ApiError } from '@/lib/api/errorHandling';
import { RepositoryFactory } from '@/lib/repositories';
import { getAuthUser, isProjectOwner } from '@/utils/auth';
import { validateOwnerRejection } from '@/lib/signatureUtils';
import { FORM_STATUS } from '@/lib/constants/constantValues';
import { DatabaseUtils } from '@/lib/api/database';
import { sendRejectWorkLogEmail } from '@/lib/email/sendEmail';


export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getAuthUser();

    if (!user) {
      return ApiError.unauthorized();
    }

    const body = await request.json();
    const rejectionComment =
      typeof body.rejectionComment === 'string' ? body.rejectionComment.trim() : '';

    if (!rejectionComment) {
      return ApiError.badRequest('A rejection comment is required.');
    }

    return await RepositoryFactory.withWorkLogRepository(async (workLogRepo) => {
      const existingWorkLog = await workLogRepo.findById(id);

      if (!existingWorkLog) {
        return ApiError.notFound('Work log');
      }

      const projectId =
        typeof existingWorkLog.project === 'string'
          ? existingWorkLog.project
          : existingWorkLog.project?.toString();

      let projectOwnerName: string | undefined;
      let projectContractorName: string | undefined;
      let projectOwnerUserId: string | undefined;
      let projectName: string | undefined;
      let projectOwnerEmail: string | undefined;
      let projectContractorEmail: string | undefined;

      if (projectId) {
        try {
          await DatabaseUtils.withConnection(async (db) => {
            const { ObjectId } = await import('mongodb');
            const project = await db
              .collection('projects')
              .findOne({ _id: new ObjectId(projectId) });
            projectOwnerName = project?.ownerName;
            projectContractorName = project?.contractorName;
            projectOwnerUserId = project?.ownerUserId?.toString();
            projectOwnerEmail = project?.ownerEmail;
            projectContractorEmail = project?.contractorEmail;
            projectName = project?.name;
          });
        } catch (error) {
          console.error('Error fetching project details:', error);
        }
      }

      if (!isProjectOwner(user, projectOwnerUserId)) {
        return ApiError.forbidden('Only the project owner can reject this work log.');
      }

      const existingSignatures = existingWorkLog.signatures ?? [];
      const rejectionError = validateOwnerRejection(
        existingSignatures,
        existingWorkLog.status,
        projectOwnerName,
        projectContractorName
      );

      if (rejectionError) {
        return ApiError.badRequest(rejectionError);
      }

      const workLog = await workLogRepo.update(id, {
        signatures: [],
        status: FORM_STATUS.PENDING,
        rejectionComment,
      });

      if (!workLog) {
        return ApiError.notFound('Work log');
      }

      try {
            await sendRejectWorkLogEmail({
              projectName,
              workLogId: id,
              projectOwnerEmail,
              projectContractorEmail,
              rejectionComment,
              rejectedAt: new Date()
            });
        } catch (error) {
          console.error('Error sending signature email:', error);
        }



      return ApiError.success(workLog);
    });
  } catch (error) {
    return ApiError.handle(error);
  }
}
