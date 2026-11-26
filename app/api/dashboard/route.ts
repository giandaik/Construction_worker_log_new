import { ApiError } from '@/lib/api/errorHandling';
import { RepositoryFactory } from '@/lib/repositories';
import { getAuthUser, resolveRepositoryContext } from '@/utils/auth';

/**
 * How many recent logs the dashboard reads: the home list shows six, and the
 * "signed" counter counts every log in the window, so it has to be wider than
 * one page of the list.
 */
const RECENT_LOG_WINDOW = 50;

/**
 * Everything the home screen draws, in one request.
 *
 * The native shell used to open with three round trips — `/api/me`,
 * `/api/projects` and `/api/worklogs` — and the slowest of them gated the first
 * paint. Each call costs a TLS handshake plus a function invocation, so on a
 * phone the third request was pure latency: ~0.6 s before any content appeared.
 * The three reads run in parallel here, behind one auth check, so a cold open
 * costs one round trip instead of three.
 */
export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return ApiError.unauthorized();
    }

    const context = resolveRepositoryContext(authUser);

    const data = await RepositoryFactory.withRepositories(
      async ({ projects: projectRepo, workLogs: workLogRepo }) => {
        const [projects, workLogs, totalLogs] = await Promise.all([
          projectRepo.findSummary(),
          workLogRepo.findRecent(RECENT_LOG_WINDOW),
          workLogRepo.count(),
        ]);

        return { projects, workLogs, totalLogs };
      },
      context,
    );

    return ApiError.success({
      user: authUser,
      projects: data.projects,
      workLogs: data.workLogs,
      totalLogs: data.totalLogs,
    });
  } catch (error) {
    return ApiError.handle(error);
  }
}
