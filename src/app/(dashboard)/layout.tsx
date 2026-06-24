import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentTeamId } from '@/lib/session';
import { SignOutButton } from '@/components/SignOutButton';
import { BackButton } from '@/components/BackButton';
import { ToastProvider } from '@/components/Toast';
import { NavLinks } from '@/components/NavLinks';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const teamId = await getCurrentTeamId();
  if (!teamId) redirect('/login');

  return (
    <ToastProvider>
      <div className="min-h-screen">
        <header className="border-b border-[#2C2A35] px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/home" className="font-serif text-lg hover:text-gold transition-colors">Aura-D Studio</Link>
            <NavLinks />
          </div>
          <div className="flex items-center gap-4">
            <BackButton />
            <SignOutButton />
          </div>
        </header>
        <main className="max-w-3xl mx-auto px-6 py-10">{children}</main>
      </div>
    </ToastProvider>
  );
}
