import { redirect } from 'next/navigation';
import { getCurrentTeamId } from '@/lib/session';

export default async function RootPage() {
  const teamId = await getCurrentTeamId();
  // ถ้า login แล้ว → หน้า Home Dashboard
  // ถ้ายังไม่ login → หน้า Login
  redirect(teamId ? '/home' : '/login');
}
