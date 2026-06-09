// GET a single work log by ID
import { ApiError } from '@/lib/api/errorHandling';
import { DatabaseUtils } from '@/lib/api/database';
import { RepositoryFactory } from '@/lib/repositories';
import { getAuthUser, canModify } from '@/utils/auth';
import {
  sendSignatureNotificationEmail,
  sendWorkLogCompletedEmail,
} from '@/lib/email/sendEmail';
import {
  getWorkLogStatusFromSignatures,
  validateSignatureOrder,
  hasContractorThenOwnerSignatures,
} from '@/lib/signatureUtils';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    return await RepositoryFactory.withWorkLogRepository(async (workLogRepo) => {
      const workLog = await workLogRepo.findByIdWithDetails(id);

      if (!workLog) {
        return ApiError.notFound('Work log');
      }

      return ApiError.success(workLog);
    });
  } catch (error) {
    return ApiError.handle(error);
  }
}

// Update a work log by ID
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getAuthUser();

    if (!user) {
      return ApiError.unauthorized();
    }

    const data = await request.json();

    return await RepositoryFactory.withWorkLogRepository(async (workLogRepo) => {
      // First, get the existing work log to check ownership
      const existingWorkLog = await workLogRepo.findById(id);

      if (!existingWorkLog) {
        return ApiError.notFound('Work log');
      }

      // Check if user can modify (admin/manager or author)
      if (!canModify(user, existingWorkLog.author?.toString() || '')) {
        return ApiError.forbidden('You do not have permission to update this work log');
      }

      const existingSignatureCount = existingWorkLog.signatures?.length ?? 0;
      const updatedSignatures = Array.isArray(data.signatures)
        ? data.signatures
        : existingWorkLog.signatures ?? [];
      const hasNewSignature = updatedSignatures.length > existingSignatureCount;

      let projectName: string | undefined;
      let projectOwnerName: string | undefined;
      let projectContractorName: string | undefined;

      try {
        await DatabaseUtils.withConnection(async (db) => {
          const projectsCollection = db.collection('projects');
          const projectId = typeof existingWorkLog.project === 'string' ? existingWorkLog.project : existingWorkLog.project?.toString();
          if (projectId) {
            const { ObjectId } = await import('mongodb');
            const project = await projectsCollection.findOne({ _id: new ObjectId(projectId) });
            projectName = project?.name;
            projectOwnerName = project?.ownerName;
            projectContractorName = project?.contractorName;
          }
        });
      } catch (error) {
        console.error('Error fetching project details:', error);
      }

      const signatureOrderError = validateSignatureOrder(updatedSignatures, projectOwnerName, projectContractorName);
      if (signatureOrderError) {
        return ApiError.badRequest(signatureOrderError);
      }

      if (projectOwnerName && projectContractorName) {
        data.status = getWorkLogStatusFromSignatures(updatedSignatures, projectOwnerName, projectContractorName);
      }

      // Update the work log using repository
      const workLog = await workLogRepo.update(id, data);

      if (!workLog) {
        return ApiError.notFound('Work log');
      }

      if (hasNewSignature && updatedSignatures.length > 0) {
        const latestSignature = updatedSignatures[updatedSignatures.length - 1];

        await sendSignatureNotificationEmail({
          signerName: latestSignature.signedBy,
          signerRole: latestSignature.role,
          projectName,
          signatureSignedAt: latestSignature.signedAt.toString(),
          workLogId: id,
        }).catch((error) => {
          console.error('Error sending signature notification email:', error);
        });
        
      }

      return ApiError.success(workLog);
    });
  } catch (error) {
    return ApiError.handle(error);
  }
}

// Delete a work log by ID
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getAuthUser();

    if (!user) {
      return ApiError.unauthorized();
    }

    return await RepositoryFactory.withWorkLogRepository(async (workLogRepo) => {
      // First, get the existing work log to check ownership
      const existingWorkLog = await workLogRepo.findById(id);

      if (!existingWorkLog) {
        return ApiError.notFound('Work log');
      }

      // Check if user can modify (admin/manager or author)
      if (!canModify(user, existingWorkLog.author?.toString() || '')) {
        return ApiError.forbidden('You do not have permission to delete this work log');
      }

      // Delete the work log using repository
      const deleted = await workLogRepo.delete(id);

      if (!deleted) {
        return ApiError.notFound('Work log');
      }

      return ApiError.success({ success: true });
    });
  } catch (error) {
    return ApiError.handle(error);
  }
} 