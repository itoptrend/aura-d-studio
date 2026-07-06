'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { CopyButton } from '@/components/CopyButton';

interface RecipeStep {
  taskName: string;
  status: string;
  modelDisplayName: string | null;
  providerCode: string | null;
  costCredit: string;
  startedAt: string | null;
  finishedAt: string | null;
}

interface AssetDetail {
  id: string;
  type: string;
  title: string;
  contentText: string | null;
  fileUrl: string | null;
  isFavorited: boolean;
  createdAt: string;
}

export default function AssetDetailPage() {
  const params = useParams<{ id: string }>();
  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [recipe, setRecipe] = useState<RecipeStep[]>([]);
  const [totalCost, setTotalCost] = useState(0);
  const [loading, setLoading] = useState(true);
  const [favorited, setFavorited] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/assets/${params.id}`);
      const data = await res.json();
      setAsset(data.asset);
      setFavorited(data.asset?.isFavorited ?? false);
      setRecipe(data.recipe ?? []);
      setTotalCost(data.totalCostCredit ?? 0);
      setLoading(false);
    }
    load();
  }, [params.id]);

  async function toggleFavorite() {
    if (!asset) return;
    const next = !favorited;
    setFavorited(next); // optimistic
    await fetch(`/api/assets/${asset.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isFavorited: next })
    });
  }

  function download() {
    if (asset?.fileUrl) {
      const a = document.createElement('a');
      a.href = `${asset.fileUrl}?download=1`;
      a.download = `${asset.title}.mp4`;
      a.click();
      return;
    }
    if (!asset?.contentText) return;
    const blob = new Blob([asset.contentText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${asset.title}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <p className="text-sm text-[#9C9690]">กำลังโหลด...</p>;
  if (!asset) return <p className="text-sm text-[#9C9690]">ไม่พบไฟล์นี้</p>;

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <p className="text-xs uppercase tracking-wider text-[#9C9690]">Generation Recipe</p>
          <h1 className="font-serif text-2xl mt-1">{asset.title}</h1>
        </div>

        {/* Copy + Download + Favorite */}
        <div className="flex items-center gap-2 flex-shrink-0 mt-1">
          {/* Duplicate to SEO (for document assets) */}
          {asset.type === 'document' && asset.contentText &&
            !asset.contentText.startsWith('data:') && (
              <a
                href={`/seo?duplicate=${encodeURIComponent(asset.title.slice(0, 60))}`}
                className="text-xs text-[#9C9690] hover:text-gold border border-[#2C2A35] hover:border-gold/40 rounded-xl px-3 py-1.5 transition-colors"
                title="ก๊อปไปสร้างใหม่ใน SEO">
                ⎘ ก๊อป
              </a>
          )}
          {/* Copy — เฉพาะ text document */}
          {asset.contentText &&
            !asset.contentText.startsWith('data:image') &&
            !asset.contentText.startsWith('data:audio') && (
              <CopyButton text={asset.contentText} label="คัดลอก" />
          )}
          {asset.contentText && (
            <button
              onClick={download}
              className="text-xs text-[#9C9690] hover:text-bone border border-[#2C2A35] hover:border-[#9C9690] rounded-xl px-3 py-1.5"
            >
              ↓ ดาวน์โหลด
            </button>
          )}
          <button
            onClick={toggleFavorite}
            className={`text-xl px-2 ${favorited ? 'text-red' : 'text-[#9C9690]'}`}
            aria-label="ถูกใจ"
          >
            {favorited ? '♥' : '♡'}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-gold/10 border border-gold/30 px-4 py-3 mb-6 mt-6">
        <span className="text-sm">ต้นทุนรวมที่ใช้สร้างไฟล์นี้</span>
        <span className="font-mono font-bold text-gold">~{totalCost} เครดิต</span>
      </div>

      <div className="space-y-3 mb-10">
        {recipe.map((step, i) => (
          <div key={i} className="flex gap-3">
            <div className="w-2 h-2 rounded-full bg-gold mt-1.5 flex-shrink-0" />
            <div className="flex-1 pb-2 border-b border-[#2C2A35]">
              <p className="text-sm font-semibold">{step.taskName}</p>
              <p className="text-xs text-[#9C9690] mt-1">
                {step.modelDisplayName ?? 'ไม่ทราบโมเดล'} ({step.providerCode}) · ~{step.costCredit} เครดิต ·{' '}
                {step.status}
              </p>
            </div>
          </div>
        ))}
        {recipe.length === 0 && <p className="text-sm text-[#9C9690]">ไม่มีข้อมูลขั้นตอนการสร้าง</p>}
      </div>

      {/* วิดีโอ — เก็บบน Blob (fileUrl) ไม่ใช่ contentText */}
      {asset.type === 'video' && asset.fileUrl && (
        <div className="rounded-2xl border border-[#2C2A35] overflow-hidden bg-black">
          <video src={asset.fileUrl} controls playsInline className="w-full max-h-[600px]" style={{ accentColor: '#E4DECE' }} />
        </div>
      )}

      {asset.contentText && (
        asset.contentText.startsWith('data:image') ? (
          <div className="rounded-2xl overflow-hidden border border-[#2C2A35] bg-[#1C1B23]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={asset.contentText} alt={asset.title} className="w-full object-contain max-h-[600px]" />
          </div>
        ) : asset.contentText.startsWith('data:audio') ? (
          <div className="rounded-2xl bg-[#1C1B23] border border-[#2C2A35] p-5">
            <p className="text-xs text-[#9C9690] mb-3">🔊 เสียงพากย์</p>
            <audio src={asset.contentText} controls className="w-full" style={{ accentColor: '#E4DECE' }} />
          </div>
        ) : (
          <div>
            <div className="flex justify-end mb-2">
              <CopyButton text={asset.contentText} label="คัดลอกทั้งหมด" />
            </div>
            <article className="whitespace-pre-line text-sm leading-relaxed bg-[#1C1B23] rounded-2xl p-5 border border-[#2C2A35]">
              {asset.contentText}
            </article>
          </div>
        )
      )}

      <div className="mt-6 space-y-4">
        {/* Continue Workflow — only for text documents */}
        {asset.type === 'document' && asset.contentText && !asset.contentText.startsWith('data:') && (
          <div className="rounded-2xl border border-[#2C2A35] p-4">
            <p className="text-xs text-[#9C9690] font-semibold uppercase tracking-wider mb-3">
              ต่อยอดจากเนื้อหานี้
            </p>
            <div className="flex gap-2 flex-wrap">
              <Link
                href={`/social?topic=${encodeURIComponent(asset.title.slice(0, 80))}`}
                className="text-xs font-semibold text-bone border border-[#2C2A35] rounded-xl px-3 py-2 hover:border-gold hover:text-gold transition-colors">
                📱 สร้าง Social Content
              </Link>
              <Link
                href={`/image?prompt=${encodeURIComponent(asset.title.slice(0, 100))}`}
                className="text-xs font-semibold text-bone border border-[#2C2A35] rounded-xl px-3 py-2 hover:border-gold hover:text-gold transition-colors">
                🖼️ สร้างภาพประกอบ
              </Link>
              <Link
                href={`/audio?text=${encodeURIComponent(asset.contentText.slice(0, 300))}`}
                className="text-xs font-semibold text-bone border border-[#2C2A35] rounded-xl px-3 py-2 hover:border-gold hover:text-gold transition-colors">
                🔊 สร้างเสียงพากย์
              </Link>
              <Link
                href={`/video?topic=${encodeURIComponent(asset.title.slice(0, 80))}`}
                className="text-xs font-semibold text-bone border border-[#2C2A35] rounded-xl px-3 py-2 hover:border-gold hover:text-gold transition-colors">
                🎬 สร้าง Video Script
              </Link>
            </div>
          </div>
        )}

        <Link href="/assets" className="text-sm text-[#9C9690] hover:text-bone">
          ← กลับคลังไฟล์
        </Link>
      </div>
    </div>
  );
}
