'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/seo',                  label: 'SEO' },
  { href: '/social',               label: 'Social' },
  { href: '/video',                label: 'Video/Ad' },
  { href: '/image',                label: 'สร้างภาพ' },
  { href: '/audio',                label: 'สร้างเสียง' },
  { href: '/characters',           label: 'Character' },
  { href: '/skills',               label: 'Skills' },
  { href: '/assets',               label: 'คลังไฟล์' },
  { href: '/analytics',            label: 'Analytics' },
  { href: '/settings/connected-ai', label: 'Connected AI' },
];

export function NavLinks() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === '/assets') return pathname.startsWith('/assets');
    if (href === '/settings/connected-ai') return pathname.startsWith('/settings');
    return pathname === href || pathname.startsWith(href + '/');
  }

  return (
    <nav className="flex items-center gap-5 text-sm">
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`transition-colors relative py-0.5 ${
              active
                ? 'text-gold font-semibold'
                : 'text-[#9C9690] hover:text-bone'
            }`}
          >
            {item.label}
            {/* Active underline indicator */}
            {active && (
              <span className="absolute -bottom-[13px] left-0 right-0 h-px bg-gold rounded-full" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
