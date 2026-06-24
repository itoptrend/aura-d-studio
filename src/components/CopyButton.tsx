'use client';

import { useState } from 'react';

interface CopyButtonProps {
  text: string;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * CopyButton — คัดลอกข้อความลง clipboard
 * แสดง "✓ คัดลอกแล้ว!" 2 วินาที แล้วกลับเป็นปกติ
 */
export function CopyButton({ text, label = 'คัดลอก', size = 'sm', className = '' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback สำหรับ browser ที่ไม่รองรับ clipboard API
      const el = document.createElement('textarea');
      el.value = text;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const sizeClass = size === 'md'
    ? 'px-4 py-2 text-sm'
    : 'px-2.5 py-1 text-xs';

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`font-semibold rounded-xl border transition-all ${
        copied
          ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-400'
          : 'border-[#2C2A35] text-[#9C9690] hover:border-[#9C9690] hover:text-bone'
      } ${sizeClass} ${className}`}
    >
      {copied ? '✓ คัดลอกแล้ว!' : `📋 ${label}`}
    </button>
  );
}
