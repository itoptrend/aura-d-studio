import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentTeamId } from '@/lib/session';
import { SignOutButton } from '@/components/SignOutButton';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const teamId = await getCurrentTeamId();
  if (!teamId) redirect('/login');

  return (
    <div className="min-h-screen">
      <header className="border-b border-[#2C2A35] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <span className="font-serif text-lg">Aura-D Studio</span>
          <nav className="flex items-center gap-5 text-sm text-[#9C9690]">
            <Link href="/seo" className="hover:text-bone">SEO</Link>
            <Link href="/social" className="hover:text-bone">Social</Link>
            <Link href="/video" className="hover:text-bone">Video/Ad</Link>
            <Link href="/image" className="hover:text-bone">สร้างภาพ</Link>
            <Link href="/audio" className="hover:text-bone">สร้างเสียง</Link>
            <Link href="/characters" className="hover:text-bone">Character</Link>
            <Link href="/skills" className="hover:text-bone">Skills</Link>
            <Link href="/assets" className="hover:text-bone">คลังไฟล์</Link>
            <Link href="/analytics" className="hover:text-bone">Analytics</Link>
            <Link href="/settings/connected-ai" className="hover:text-bone">Connected AI</Link>
          </nav>
        </div>
        <SignOutButton />
      </header>
      <main className="max-w-3xl mx-auto px-6 py-10">{children}</main>
    </div>
  );
}
