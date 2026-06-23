'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface AssetRow {
  id: string;
  type: string;
  title: string;
  isFavorited: boolean;
  createdAt: string;
  contentText?: string | null;
  sourceNodeExecution: { costCredit: string } | null;
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch('/api/assets');
    const data = await res.json();
    setAssets(data.assets ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggleFavorite(id: string, current: boolean) {
    setAssets((prev) => prev.map((a) => (a.id === id ? { ...a, isFavorited: !current } : a)));
    await fetch(`/api/assets/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isFavorited: !current })
    });
  }

  function downloadText(title: string, text: string) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <p className="text-sm text-[#9C9690]">กำลังโหลด...</p>;

  return (
    <div>
      <h1 className="font-serif text-2xl mb-1">คลังไฟล์</h1>
      <p className="text-sm text-[#9C9690] mb-8">ผลงานทั้งหมดที่สร้างผ่าน Aura-D Studio</p>

      {assets.length === 0 && (
        <p className="text-sm text-[#9C9690]">
          ยังไม่มีผลงาน —{' '}
          <Link href="/seo" className="text-gold font-semibold">
            ไปสร้างบทความ SEO ชิ้นแรก
          </Link>
        </p>
      )}

      <div className="space-y-2">
        {assets.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between rounded-2xl border border-[#2C2A35] px-4 py-3 gap-3"
          >
            <Link href={`/assets/${a.id}`} className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{a.title}</p>
              <p className="text-xs text-[#9C9690] mt-1">
                {a.type} · {new Date(a.createdAt).toLocaleString('th-TH')}
                {a.sourceNodeExecution && ` · ~${a.sourceNodeExecution.costCredit} เครดิต`}
              </p>
            </Link>

            <div className="flex items-center gap-1 flex-shrink-0">
              {/* ปุ่มดาวน์โหลด — แสดงเฉพาะ asset ที่มีเนื้อหาข้อความ */}
              {a.contentText && (
                <button
                  onClick={() => downloadText(a.title, a.contentText!)}
                  className="text-xs text-[#9C9690] hover:text-bone px-2 py-1 rounded-lg border border-[#2C2A35] hover:border-[#9C9690]"
                  aria-label="ดาวน์โหลด"
                  title="ดาวน์โหลด .txt"
                >
                  ↓
                </button>
              )}

              {/* ปุ่มถูกใจ */}
              <button
                onClick={() => toggleFavorite(a.id, a.isFavorited)}
                className={`text-lg px-2 ${a.isFavorited ? 'text-red' : 'text-[#9C9690]'}`}
                aria-label="ถูกใจ"
              >
                {a.isFavorited ? '♥' : '♡'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
