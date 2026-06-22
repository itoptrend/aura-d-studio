import { redirect } from 'next/navigation';
import { getCurrentTeamId } from '@/lib/session';

export default async function RootPage() {
  const teamId = await getCurrentTeamId();
  redirect(teamId ? '/seo' : '/login');
}
