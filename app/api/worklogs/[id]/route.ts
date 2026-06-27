// GET a single work log by ID
import { ApiError } from '@/lib/api/errorHandling';
import { DatabaseUtils } from '@/lib/api/database';
import { RepositoryFactory } from '@/lib/repositories';
import { getAuthUser, canModify, isProjectOwner } from '@/utils/auth';
import {
  sendSignatureNotificationEmail,
  sendWorkLogCompletedEmail,
} from '@/lib/email/sendEmail';
import {
  getWorkLogStatusFromSignatures,
  validateSignatureWorkflowChange,
  getSignatureRoleType,
} from '@/lib/signatureUtils';
import { createWorkLogPdfAttachment } from '@/app/worklogs/[id]/exportToPDF';
import { FORM_STATUS } from '@/lib/constants/constantValues';

async function fetchProjectContext(projectId: string | undefined) {
  let projectName: string | undefined;
  let projectOwnerName: string | undefined;
  let projectContractorName: string | undefined;
  let projectOwnerEmail: string | undefined;
  let projectContractorEmail: string | undefined;
  let projectOwnerUserId: string | undefined;
  let projectContractorUserId: string | undefined;

  if (!projectId) {
    return {
      projectName,
      projectOwnerName,
      projectContractorName,
      projectOwnerEmail,
      projectContractorEmail,
      projectOwnerUserId,
      projectContractorUserId,
    };
  }

  try {
    await DatabaseUtils.withConnection(async (db) => {
      const projectsCollection = db.collection('projects');
      const { ObjectId } = await import('mongodb');
      const project = await projectsCollection.findOne({ _id: new ObjectId(projectId) });
      projectName = project?.name;
      projectOwnerName = project?.ownerName;
      projectContractorName = project?.contractorName;
      projectOwnerEmail = project?.ownerEmail;
      projectContractorEmail = project?.contractorEmail;
      projectOwnerUserId = project?.ownerUserId?.toString();
      projectContractorUserId = project?.contractorUserId?.toString();
    });
  } catch (error) {
    console.error('Error fetching project details:', error);
  }

  return {
    projectName,
    projectOwnerName,
    projectContractorName,
    projectOwnerEmail,
    projectContractorEmail,
    projectOwnerUserId,
    projectContractorUserId,
  };
}

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

    const requestData = await request.json();

    return await RepositoryFactory.withWorkLogRepository(async (workLogRepo) => {
      // First, get the existing work log to check ownership
      const existingWorkLog = await workLogRepo.findById(id);

      if (!existingWorkLog) {
        return ApiError.notFound('Work log');
      }

      let updateData = { ...requestData };

      // Check if user can modify (admin/manager or author)
      const projectId =
        typeof existingWorkLog.project === 'string'
          ? existingWorkLog.project
          : existingWorkLog.project?.toString();
      const projectContext = await fetchProjectContext(projectId);
      const {
        projectName,
        projectOwnerName,
        projectContractorName,
        projectOwnerEmail,
        projectContractorEmail,
        projectOwnerUserId,
      } = projectContext;

      const isAuthorOrAdmin = canModify(user, existingWorkLog.author?.toString() || '');
      const isOwnerApproval =
        isProjectOwner(user, projectOwnerUserId) &&
        existingWorkLog.status === FORM_STATUS.SIGNED;

      if (!isAuthorOrAdmin && !isOwnerApproval) {
        return ApiError.forbidden('You do not have permission to update this work log');
      }

      const existingSignatureCount = existingWorkLog.signatures?.length ?? 0;
      const existingSignatures = existingWorkLog.signatures ?? [];
      const updatedSignatures = Array.isArray(updateData.signatures)
        ? updateData.signatures
        : existingSignatures;
      const hasNewSignature = updatedSignatures.length > existingSignatureCount;

      if (existingWorkLog.status === 'completed') {
        return ApiError.badRequest('This work log is completed and locked.');
      }

      if (isOwnerApproval && !isAuthorOrAdmin) {
        if (!hasNewSignature) {
          return ApiError.badRequest('Please add your signature to approve this work log.');
        }

        const addedSignature = updatedSignatures[updatedSignatures.length - 1];
        if (addedSignature.projectRole !== 'owner') {
          return ApiError.badRequest('Only the project owner can approve this work log.');
        }

        updateData = {
          ...existingWorkLog,
          signatures: updatedSignatures,
        };
      }

      const signatureWorkflowError = validateSignatureWorkflowChange(
        existingSignatures,
        updatedSignatures,
        projectOwnerName,
        projectContractorName
      );
      if (signatureWorkflowError) {
        return ApiError.badRequest(signatureWorkflowError);
      }

      updateData.status = getWorkLogStatusFromSignatures(
        updatedSignatures,
        projectOwnerName,
        projectContractorName
      );

      if (hasNewSignature) {
        const latestSignature = updatedSignatures[updatedSignatures.length - 1];
        if (
          getSignatureRoleType(latestSignature, projectOwnerName, projectContractorName) ===
          'contractor'
        ) {
          updateData.rejectionComment = undefined;
        }
      }

      // Update the work log using repository
      const workLog = await workLogRepo.update(id, updateData);

      if (!workLog) {
        return ApiError.notFound('Work log');
      }

      if (hasNewSignature && updatedSignatures.length > 0) {
        const latestSignature =
          updatedSignatures[updatedSignatures.length - 1];

        try {
          if (latestSignature.projectRole === 'contractor') {
            await sendSignatureNotificationEmail({
              signerName: latestSignature.signedBy,
              signerRole: latestSignature.projectRole,
              projectName,
              signatureSignedAt: latestSignature.signedAt.toString(),
              workLogId: id,
              projectOwnerEmail,
            });
          } else if (latestSignature.projectRole === 'owner') {
            const workLogWithDetails = await workLogRepo.findByIdWithDetails(id);
            const pdfAttachment = workLogWithDetails
              ? await createWorkLogPdfAttachment(workLogWithDetails)
              : undefined;

            await sendWorkLogCompletedEmail({
              signerName: latestSignature.signedBy,
              signerRole: latestSignature.projectRole,
              projectName,
              signatureSignedAt: latestSignature.signedAt.toString(),
              workLogId: id,
              projectOwnerEmail,
              projectContractorEmail,
            }, pdfAttachment ? [pdfAttachment] : undefined);
          }
        } catch (error) {
          console.error('Error sending signature email:', error);
        }
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

      if (existingWorkLog.status === 'completed') {
        return ApiError.badRequest('This work log is completed and locked.');
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
