// GET a single work log by ID
import { ApiError } from '@/lib/api/errorHandling';
import { RepositoryFactory } from '@/lib/repositories';
import { getAuthUser, canModify, isProjectOwner, resolveRepositoryContext } from '@/utils/auth';
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
import { fetchProjectContext } from '@/lib/api/projectContext';
import { workLogUpdateSchema } from '@/lib/schemas/workLogSchema';
import type { WorkLog } from '@/lib/repositories/WorkLogRepository';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return ApiError.unauthorized();
    const context = resolveRepositoryContext(authUser);
    const { id } = await params;

    return await RepositoryFactory.withWorkLogRepository(async (workLogRepo) => {
      const workLog = await workLogRepo.findByIdWithDetails(id);

      if (!workLog) {
        return ApiError.notFound('Work log');
      }

      return ApiError.success(workLog);
    }, context);
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
    const user = await getAuthUser(request);

    if (!user) {
      return ApiError.unauthorized();
    }

    const context = resolveRepositoryContext(user);

    // Strict: an unknown key is rejected rather than spread into `$set`.
    // `tenantId`, `_id` and `createdAt` are not in the schema at all, so a
    // client cannot name them; BaseRepository.update() strips them regardless.
    const parsedBody = workLogUpdateSchema.safeParse(await request.json());
    if (!parsedBody.success) {
      return ApiError.badRequest(
        parsedBody.error.issues
          .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
          .join(', ')
      );
    }
    const requestData = parsedBody.data;

    return await RepositoryFactory.withWorkLogRepository(async (workLogRepo) => {
      // First, get the existing work log to check ownership
      const existingWorkLog = await workLogRepo.findById(id);

      if (!existingWorkLog) {
        return ApiError.notFound('Work log');
      }

      // Re-bind as non-null so TypeScript keeps the narrowing through awaited calls below
      const log = existingWorkLog;
      // Typed as the entity so the server-set fields below (status,
      // rejectionComment) are checked; the parsed body cannot contribute keys
      // outside the strict schema.
      let updateData: Partial<WorkLog> = { ...requestData };

      const isAuthorOrAdmin = canModify(user, log.author?.toString() || '');

      if (!isAuthorOrAdmin && log.status !== FORM_STATUS.SIGNED) {
        return ApiError.forbidden('You do not have permission to update this work log');
      }

      const projectId =
        typeof log.project === 'string' ? log.project : log.project?.toString();
      const {
        projectName,
        projectOwnerName,
        projectContractorName,
        projectOwnerEmail,
        projectContractorEmail,
        projectOwnerUserId,
      } = await fetchProjectContext(projectId, context);

      const isOwnerApproval =
        isProjectOwner(user, projectOwnerUserId) && log.status === FORM_STATUS.SIGNED;

      if (!isAuthorOrAdmin && !isOwnerApproval) {
        return ApiError.forbidden('You do not have permission to update this work log');
      }

      const existingSignatureCount = log.signatures?.length ?? 0;
      const existingSignatures = log.signatures ?? [];
      const updatedSignatures = Array.isArray(updateData.signatures)
        ? updateData.signatures
        : existingSignatures;
      const hasNewSignature = updatedSignatures.length > existingSignatureCount;

      if (log.status === 'completed') {
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

        // Owner approval may only add the signature — ignore any other
        // client-sent fields. Never spread the mapped entity here: its
        // string _id/date would be written back into the $set payload.
        updateData = {
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
    }, context);
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
    const user = await getAuthUser(request);

    if (!user) {
      return ApiError.unauthorized();
    }

    const context = resolveRepositoryContext(user);

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
    }, context);
  } catch (error) {
    return ApiError.handle(error);
  }
}
