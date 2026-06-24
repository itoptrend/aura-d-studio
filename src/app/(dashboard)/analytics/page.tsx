'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Summary {
  totalAssets: number;
  totalCredits: number;
  totalRuns: number;
  favoriteCount: number;
  memberSince: string | null;
}

interface TypeCount { type: string; count: number; }
interface ProviderStat { label: string; credits: number; runs: number; }
interface CategoryStat { label: string; credits: number; runs: number; }
interface RecentAsset { id: string; title: string; type: string; createdAt: string; isFavorited: boolean; sourceNodeExecution: { costCredit: number } | null; }
interface ChartPoint { date: string; label: string; count: number; }

interface Analytics {
  summary: Summary;
  assetsByType: TypeCount[];
  creditsByProvider: ProviderStat[];
  creditsByCategory: CategoryStat[];
  recentAssets: RecentAsset[];
  chartData: ChartPoint[];
}

const TYPE_EMOJI: Record<string, string> = {
  document: '📄', image: '🖼️', audio: '🔊', video: '🎬', storyboard: '🎭'
};
const TYPE_LABEL: Record<string, string> = {
  document: 'เอกสาร', image: 'รูปภาพ', audio: 'เสียงพากย์', video: 'วิดีโอ', storyboard: 'Storyboard'
};
const PROVIDER_LABEL: Record<string, string> = {
  google: 'Google Gemini', openai: 'OpenAI GPT', anthropic: 'Anthropic Claude',
  xai: 'xAI Grok', elevenlabs: 'ElevenLabs'
};

function Bar({ value, max, color = '#E4DECE' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 rounded-full bg-[#2C2A35] overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function StatCard({ emoji, label, value, sub }: { emoji: string; label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl border border-[#2C2A35] bg-[#1C1B23] p-4">
      <p className="text-2xl mb-1">{emoji}</p>
      <p className="font-serif text-2xl font-bold text-bone">{value}</p>
      <p className="text-xs text-[#9C9690] mt-1">{label}</p>
      {sub && <p className="text-[10px] text-[#9C9690] mt-0.5">{sub}</p>}
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analytics')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-[#9C9690]">กำลังโหลด...</p>;
  if (!data) return <p className="text-sm text-[#9C9690]">ไม่สามารถโหลดข้อมูลได้</p>;

  const { summary, assetsByType, creditsByProvider, creditsByCategory, recentAssets, chartData } = data;
  const maxChart = Math.max(...chartData.map((d) => d.count), 1);
  const maxProviderCredits = Math.max(...creditsByProvider.map((p) => p.credits), 1);
  const maxCategoryCredits = Math.max(...creditsByCategory.map((c) => c.credits), 1);

  const memberDays = summary.memberSince
    ? Math.floor((Date.now() - new Date(summary.memberSince).getTime()) / 86400000)
    : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="font-serif text-2xl">Analytics</h1>
          <p className="text-sm text-[#9C9690] mt-1">ภาพรวมการใช้งาน Aura-D Studio</p>
        </div>
        <Link href="/assets" className="text-xs text-[#9C9690] border border-[#2C2A35] rounded-xl px-3 py-1.5 hover:border-[#9C9690]">
          คลังไฟล์ทั้งหมด →
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 mt-6 sm:grid-cols-4">
        <StatCard emoji="📦" label="ผลงานทั้งหมด" value={summary.totalAssets} sub={`${summary.favoriteCount} ถูกใจ`} />
        <StatCard emoji="⚡" label="เครดิตที่ใช้" value={summary.totalCredits.toFixed(1)} sub={`${summary.totalRuns} ครั้ง`} />
        <StatCard emoji="❤️" label="ถูกใจ" value={summary.favoriteCount} />
        <StatCard emoji="📅" label="ใช้งานมาแล้ว" value={`${memberDays} วัน`} sub={summary.memberSince ? new Date(summary.memberSince).toLocaleDateString('th-TH') : ''} />
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">

        {/* Asset by type */}
        <div className="rounded-2xl border border-[#2C2A35] p-5">
          <h2 className="text-sm font-semibold mb-4">ผลงานตามประเภท</h2>
          {assetsByType.length === 0 && <p className="text-xs text-[#9C9690]">ยังไม่มีผลงาน</p>}
          <div className="space-y-3">
            {assetsByType.map((t) => (
              <div key={t.type}>
                <div className="flex justify-between text-xs mb-1">
                  <span>{TYPE_EMOJI[t.type] ?? '📁'} {TYPE_LABEL[t.type] ?? t.type}</span>
                  <span className="font-mono text-bone">{t.count}</span>
                </div>
                <Bar value={t.count} max={summary.totalAssets} />
              </div>
            ))}
          </div>
        </div>

        {/* Credits by module */}
        <div className="rounded-2xl border border-[#2C2A35] p-5">
          <h2 className="text-sm font-semibold mb-4">เครดิตตามโมดูล</h2>
          {creditsByCategory.length === 0 && <p className="text-xs text-[#9C9690]">ยังไม่มีการใช้งาน</p>}
          <div className="space-y-3">
            {creditsByCategory.map((c) => (
              <div key={c.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#9C9690]">{c.label}</span>
                  <span className="font-mono text-bone">{c.credits.toFixed(1)} เครดิต</span>
                </div>
                <Bar value={c.credits} max={maxCategoryCredits} color="#B8A88A" />
              </div>
            ))}
          </div>
        </div>

        {/* Credits by provider */}
        <div className="rounded-2xl border border-[#2C2A35] p-5">
          <h2 className="text-sm font-semibold mb-4">เครดิตตาม AI Provider</h2>
          {creditsByProvider.length === 0 && <p className="text-xs text-[#9C9690]">ยังไม่มีการใช้งาน</p>}
          <div className="space-y-3">
            {creditsByProvider.map((p) => (
              <div key={p.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#9C9690]">{PROVIDER_LABEL[p.label] ?? p.label}</span>
                  <span className="font-mono text-bone">{p.credits.toFixed(1)}</span>
                </div>
                <Bar value={p.credits} max={maxProviderCredits} color="#9C7A4E" />
              </div>
            ))}
          </div>
        </div>

        {/* 14-day trend */}
        <div className="rounded-2xl border border-[#2C2A35] p-5">
          <h2 className="text-sm font-semibold mb-4">ผลงาน 14 วันที่ผ่านมา</h2>
          <div className="flex items-end gap-1 h-24">
            {chartData.map((d) => {
              const heightPct = maxChart > 0 ? (d.count / maxChart) * 100 : 0;
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                  {/* Tooltip */}
                  {d.count > 0 && (
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 hidden group-hover:block text-[9px] text-bone bg-[#2C2A35] px-1.5 py-0.5 rounded whitespace-nowrap z-10">
                      {d.count} ชิ้น
                    </div>
                  )}
                  <div className="w-full rounded-t flex-1 flex items-end">
                    <div
                      className="w-full rounded-t transition-all"
                      style={{
                        height: `${Math.max(heightPct, d.count > 0 ? 8 : 2)}%`,
                        background: d.count > 0 ? '#E4DECE' : '#2C2A35'
                      }}
                    />
                  </div>
                  <span className="text-[8px] text-[#9C9690]">{d.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="mt-6 rounded-2xl border border-[#2C2A35] p-5">
        <h2 className="text-sm font-semibold mb-4">กิจกรรมล่าสุด</h2>
        {recentAssets.length === 0 && <p className="text-xs text-[#9C9690]">ยังไม่มีผลงาน</p>}
        <div className="space-y-2">
          {recentAssets.map((a) => (
            <Link key={a.id} href={`/assets/${a.id}`}
              className="flex items-center justify-between rounded-xl hover:bg-[#2C2A35] px-3 py-2.5 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-lg flex-shrink-0">{TYPE_EMOJI[a.type] ?? '📁'}</span>
                <div className="min-w-0">
                  <p className="text-sm truncate">{a.title}</p>
                  <p className="text-[10px] text-[#9C9690]">
                    {new Date(a.createdAt).toLocaleString('th-TH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                {a.sourceNodeExecution && (
                  <span className="text-[10px] font-mono text-[#9C9690]">
                    ~{Number(a.sourceNodeExecution.costCredit).toFixed(1)} เครดิต
                  </span>
                )}
                {a.isFavorited && <span className="text-red-400 text-xs">♥</span>}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
