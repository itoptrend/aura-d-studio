'use client';

import { signOut } from 'next-auth/react';

export function SignOutButton() {
  return (
    <button onClick={() => signOut({ callbackUrl: '/login' })} className="text-sm text-[#9C9690] hover:text-bone">
      ออกจากระบบ
    </button>
  );
}
