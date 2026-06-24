'use client';

import { useRouter, usePathname } from 'next/navigation';

const HIDE_ON = ['/home', '/'];

/**
 * BackButton — แสดงปุ่มย้อนกลับทุกหน้า ยกเว้นหน้าแรก
 * ใช้ router.back() กลับไปหน้าก่อนหน้าใน browser history
 */
export function BackButton() {
  const router = useRouter();
  const pathname = usePathname();

  if (HIDE_ON.includes(pathname)) return null;

  return (
    <button
      onClick={() => router.back()}
      className="flex items-center gap-1.5 text-xs text-[#9C9690] hover:text-bone transition-colors group"
      title="ย้อนกลับ"
    >
      <span className="text-base leading-none group-hover:-translate-x-0.5 transition-transform">←</span>
      <span>ย้อนกลับ</span>
    </button>
  );
}
