'use client';

import { usePathname, useRouter } from 'next/navigation';

// หน้าที่ไม่แสดงปุ่มย้อนกลับ
const NO_BACK_PATHS = ['/home', '/'];

export function BackButton() {
  const pathname = usePathname();
  const router = useRouter();

  // ไม่แสดงบนหน้าหลัก
  if (NO_BACK_PATHS.includes(pathname)) return null;

  return (
    <button
      onClick={() => router.back()}
      className="flex items-center gap-1.5 text-xs text-[#9C9690] hover:text-bone transition-colors group"
      aria-label="ย้อนกลับ"
    >
      <span className="text-base leading-none group-hover:-translate-x-0.5 transition-transform">←</span>
      <span>ย้อนกลับ</span>
    </button>
  );
}
