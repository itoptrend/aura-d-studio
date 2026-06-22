import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * Returns the current team_id for an authenticated request, or null.
 * Every data-access function in this slice takes teamId explicitly so it's
 * obvious at a glance that queries are tenant-scoped (spec §2.4 tenant
 * isolation) — there is no global "get all rows" query anywhere.
 */
export async function getCurrentTeamId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.teamId ?? null;
}
