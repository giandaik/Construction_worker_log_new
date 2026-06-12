import { ApiError } from '@/lib/api/errorHandling';
import { RepositoryFactory } from '@/lib/repositories';
import { getAuthUser } from '@/utils/auth';

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function getMonthBounds(month: string): { startDay: string; endDay: string } {
  const [year, monthNumber] = month.split('-').map(Number);
  const lastDayOfMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return {
    startDay: `${month}-01`,
    endDay: `${month}-${String(lastDayOfMonth).padStart(2, '0')}`,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return ApiError.unauthorized();
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month') ?? new Date().toISOString().slice(0, 7);

    if (!MONTH_PATTERN.test(month)) {
      return ApiError.badRequest('month must be in YYYY-MM format');
    }

    const { startDay, endDay } = getMonthBounds(month);

    return await RepositoryFactory.withWorkLogRepository(async (workLogRepo) => {
      const counts = await workLogRepo.countByDayForProject(id, startDay, endDay);
      return ApiError.success(counts);
    });
  } catch (error) {
    return ApiError.handle(error);
  }
}
