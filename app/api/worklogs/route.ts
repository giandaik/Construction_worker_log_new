// GET all work logs
import { DEFAULT_PAGE_SIZE } from '@/lib/constants/constants';
import { ApiError } from '@/lib/api/errorHandling';
import { RepositoryFactory } from '@/lib/repositories';
import { getAuthUser } from '@/utils/auth';
import {
  sendSignatureNotificationEmail,
  sendWorkLogCompletedEmail,
} from '@/lib/email/sendEmail';
import {
  getWorkLogStatusFromSignatures,
  validateSignatureOrder,
  hasContractorThenOwnerSignatures,
} from '@/lib/signatureUtils';
import { generateWorkLogPdfBuffer } from '@/lib/pdf/workLogPdf';
import { DatabaseUtils } from '@/lib/api/database';

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return ApiError.unauthorized();
    }

    return await RepositoryFactory.withWorkLogRepository(async (workLogRepo) => {
      // Get project filter from query parameters
      const { searchParams } = new URL(request.url);
      const projectId = searchParams.get('project');

      let workLogs;

      if (projectId) {
        // Get work logs for a specific project
        workLogs = await workLogRepo.findByProject(projectId, {
          limit: DEFAULT_PAGE_SIZE,
          projection: {
            _id: 1,
            date: 1,
            project: 1,
            status: 1,
            author: 1,
            workDescription: 1,
            createdAt: 1,
            updatedAt: 1
          }
        });
      } else {
        // Get recent work logs
        workLogs = await workLogRepo.findRecent(DEFAULT_PAGE_SIZE);
      }

      return ApiError.success(workLogs);
    });
  } catch (error) {
    return ApiError.handle(error);
  }
}

export async function POST(request: Request) {
  try {
    const startTime = Date.now();
    const user = await getAuthUser();

    if (!user) {
      return ApiError.unauthorized();
    }

    const data = await request.json();

    return await RepositoryFactory.withWorkLogRepository(async (workLogRepo) => {
      // Determine if the selected project already defines signature parties
      let projectOwnerName: string | undefined;
      let projectContractorName: string | undefined;

      try {
        await DatabaseUtils.withConnection(async (db) => {
          const projectsCollection = db.collection('projects');
          const projectId = typeof data.project === 'string' ? data.project : data.project?.toString();
          if (projectId) {
            const { ObjectId } = await import('mongodb');
            const project = await projectsCollection.findOne({ _id: new ObjectId(projectId) });
            projectOwnerName = project?.ownerName;
            projectContractorName = project?.contractorName;
          }
        });
      } catch (error) {
        console.error('Error fetching project details:', error);
      }

      const validationError = validateSignatureOrder(
        Array.isArray(data.signatures) ? data.signatures : [],
        projectOwnerName,
        projectContractorName
      );

      if (validationError) {
        return ApiError.badRequest(validationError);
      }

      const status = getWorkLogStatusFromSignatures(
        Array.isArray(data.signatures) ? data.signatures : [],
        projectOwnerName,
        projectContractorName
      );

      const workLogData = {
        ...data,
        author: user.userId,
        status,
      };

      // Create the work log using repository
      const workLog = await workLogRepo.create(workLogData);

      if (Array.isArray(data.signatures) && data.signatures.length > 0) {
        const latestSignature = data.signatures[data.signatures.length - 1];

        // Fetch project details from database
        let projectName: string | undefined;
        let projectOwnerName: string | undefined;
        let projectContractorName: string | undefined;
        try {
          await DatabaseUtils.withConnection(async (db) => {
            const projectsCollection = db.collection('projects');
            const projectId = typeof workLog.project === 'string' ? workLog.project : workLog.project?.toString();
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

        await sendSignatureNotificationEmail({
          signerName: latestSignature.signedBy,
          signerRole: latestSignature.role,
          projectName,
          signatureSignedAt: latestSignature.signedAt.toString(),
          workLogId: workLog._id ? workLog._id.toString() : undefined,
        }).catch((error) => {
          console.error('Error sending signature notification email:', error);
        });

        if (projectOwnerName && projectContractorName && hasContractorThenOwnerSignatures(data.signatures, projectOwnerName, projectContractorName)) {
          const populatedWorkLog = await RepositoryFactory.withWorkLogRepository(async (repo) => {
            const workLogDetails = await repo.findByIdWithDetails(
              workLog._id?.toString() ?? '',
              DatabaseUtils.getCollection('projects'),
              DatabaseUtils.getCollection('users')
            );
            return workLogDetails;
          });

          if (populatedWorkLog) {
            const pdfBuffer = await generateWorkLogPdfBuffer(populatedWorkLog as any);
            await sendWorkLogCompletedEmail(
              {
                projectName,
                workLogId: workLog._id ? workLog._id.toString() : undefined,
                signerName: latestSignature.signedBy,
              },
              [{
                filename: `worklog-${workLog._id?.toString() || 'completed'}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf',
              }]
            ).catch((error) => {
              console.error('Error sending completed work log email:', error);
            });
          }
        }
      }

      console.log(`Work log created in ${Date.now() - startTime}ms`);

      return ApiError.success(workLog, 201);
    });
  } catch (error) {
    return ApiError.handle(error);
  }
} 