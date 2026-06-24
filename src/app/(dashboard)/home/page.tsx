'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Stats {
  totalAssets: number;
  totalCredits: number;
  favoriteCount: number;
}
interface RecentAsset {
  id: string;
  type: string;
  title: string;
  createdAt: string;
  thumbnail: string | null;
  isAudio: boolean;
}

const MODULES = [
  { href: '/seo',        emoji: '✍️',  label: 'SEO Article',    desc: 'เขียนบทความ SEO ภาษาไทย',        color: 'from-blue-900/30 to-blue-800/10' },
  { href: '/social',     emoji: '📱', label: 'Social Content',  desc: '6 platforms: FB/IG/TikTok/YT/…',  color: 'from-pink-900/30 to-pink-800/10' },
  { href: '/video',      emoji: '🎬', label: 'Video/Ad',        desc: 'สคริปต์โฆษณา + Storyboard',       color: 'from-purple-900/30 to-purple-800/10' },
  { href: '/image',      emoji: '🖼️',  label: 'สร้างภาพ',       desc: 'Nano Banana · Grok · GPT Image',  color: 'from-emerald-900/30 to-emerald-800/10' },
  { href: '/audio',      emoji: '🔊', label: 'สร้างเสียง',      desc: 'OpenAI TTS · Gemini · ElevenLabs', color: 'from-amber-900/30 to-amber-800/10' },
  { href: '/characters', emoji: '🎭', label: 'Character Engine', desc: 'สร้างตัวละครแบรนด์ด้วย AI',      color: 'from-rose-900/30 to-rose-800/10' },
  { href: '/skills',     emoji: '⚡', label: 'Skill Library',    desc: '12 Official Skills พร้อมใช้',      color: 'from-cyan-900/30 to-cyan-800/10' },
];

const TYPE_EMOJI: Record<string, string> = {
  document: '📄', image: '🖼️', audio: '🔊', video: '🎬', storyboard: '🎭'
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5)  return 'ดึกแล้วนะครับ';
  if (h < 12) return 'สวัสดีตอนเช้าครับ';
  if (h < 17) return 'สวัสดีตอนบ่ายครับ';
  if (h < 21) return 'สวัสดีตอนเย็นครับ';
  return 'สวัสดีตอนค่ำครับ';
}

export default function HomePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<RecentAsset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/analytics').then((r) => r.json()),
      fetch('/api/assets').then((r) => r.json()),
    ]).then(([analytics, assets]) => {
      setStats({
        totalAssets:  analytics.summary?.totalAssets  ?? 0,
        totalCredits: analytics.summary?.totalCredits ?? 0,
        favoriteCount: analytics.summary?.favoriteCount ?? 0,
      });
      setRecent((assets.assets ?? []).slice(0, 5));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">

      {/* Greeting */}
      <div>
        <h1 className="font-serif text-3xl">{greeting()} 👋</h1>
        <p className="text-sm text-[#9C9690] mt-1">
          วันนี้อยากสร้างอะไรดีครับ?
        </p>
      </div>

      {/* Stats */}
      {!loading && stats && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-[#2C2A35] bg-[#1C1B23] p-4 text-center">
            <p className="font-serif text-3xl font-bold text-bone">{stats.totalAssets}</p>
            <p className="text-xs text-[#9C9690] mt-1">ผลงานทั้งหมด</p>
          </div>
          <div className="rounded-2xl border border-[#2C2A35] bg-[#1C1B23] p-4 text-center">
            <p className="font-serif text-3xl font-bold text-bone">{stats.totalCredits.toFixed(1)}</p>
            <p className="text-xs text-[#9C9690] mt-1">เครดิตที่ใช้</p>
          </div>
          <div className="rounded-2xl border border-[#2C2A35] bg-[#1C1B23] p-4 text-center">
            <p className="font-serif text-3xl font-bold text-bone">{stats.favoriteCount}</p>
            <p className="text-xs text-[#9C9690] mt-1">ถูกใจ ♥</p>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="font-serif text-lg mb-3">เริ่มสร้างคอนเทนต์</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {MODULES.map((m) => (
            <Link key={m.href} href={m.href}
              className={`group rounded-2xl border border-[#2C2A35] bg-gradient-to-br ${m.color} p-4 hover:border-[#9C9690] transition-all hover:scale-[1.02]`}>
              <span className="text-3xl block mb-2">{m.emoji}</span>
              <p className="text-sm font-semibold text-bone group-hover:text-gold transition-colors">{m.label}</p>
              <p className="text-[11px] text-[#9C9690] mt-1 leading-relaxed">{m.desc}</p>
            </Link>
          ))}
          {/* Analytics shortcut */}
          <Link href="/analytics"
            className="group rounded-2xl border border-[#2C2A35] bg-gradient-to-br from-slate-900/30 to-slate-800/10 p-4 hover:border-[#9C9690] transition-all hover:scale-[1.02]">
            <span className="text-3xl block mb-2">📊</span>
            <p className="text-sm font-semibold text-bone group-hover:text-gold transition-colors">Analytics</p>
            <p className="text-[11px] text-[#9C9690] mt-1 leading-relaxed">สถิติการใช้งานทั้งหมด</p>
          </Link>
        </div>
      </div>

      {/* Recent Assets */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-serif text-lg">ผลงานล่าสุด</h2>
          <Link href="/assets" className="text-xs text-[#9C9690] hover:text-gold transition-colors">
            ดูทั้งหมด →
          </Link>
        </div>

        {loading && <p className="text-sm text-[#9C9690]">กำลังโหลด...</p>}

        {!loading && recent.length === 0 && (
          <div className="rounded-2xl border border-[#2C2A35] border-dashed p-8 text-center">
            <p className="text-3xl mb-2">🌱</p>
            <p className="text-sm text-[#9C9690]">ยังไม่มีผลงาน</p>
            <p className="text-xs text-[#9C9690] mt-1">เริ่มสร้างคอนเทนต์แรกของคุณได้เลยครับ</p>
            <Link href="/seo" className="inline-block mt-3 text-xs font-semibold text-gold border border-gold/40 rounded-xl px-4 py-2 hover:bg-gold/10">
              เขียนบทความ SEO ชิ้นแรก →
            </Link>
          </div>
        )}

        {!loading && recent.length > 0 && (
          <div className="space-y-2">
            {recent.map((a) => (
              <Link key={a.id} href={`/assets/${a.id}`}
                className="flex items-center gap-3 rounded-2xl border border-[#2C2A35] px-4 py-3 hover:border-[#9C9690] transition-colors">
                {/* Thumbnail */}
                {a.thumbnail ? (
                  <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-[#1C1B23]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.thumbnail} alt={a.title} className="w-full h-full object-cover" />
                  </div>
                ) : a.isAudio ? (
                  <div className="w-10 h-10 rounded-xl bg-[#1C1B23] flex items-center justify-center flex-shrink-0">🔊</div>
                ) : (
                  <span className="text-2xl flex-shrink-0">{TYPE_EMOJI[a.type] ?? '📁'}</span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{a.title}</p>
                  <p className="text-[11px] text-[#9C9690] mt-0.5">
                    {new Date(a.createdAt).toLocaleString('th-TH', {
                      month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                </div>
                <span className="text-xs text-[#9C9690] flex-shrink-0">→</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick settings */}
      <div className="border-t border-[#2C2A35] pt-6">
        <div className="flex items-center gap-4">
          <Link href="/settings/connected-ai"
            className="text-xs text-[#9C9690] border border-[#2C2A35] rounded-xl px-3 py-2 hover:border-[#9C9690] hover:text-bone transition-colors">
            🔑 Connected AI
          </Link>
          <Link href="/assets"
            className="text-xs text-[#9C9690] border border-[#2C2A35] rounded-xl px-3 py-2 hover:border-[#9C9690] hover:text-bone transition-colors">
            📂 คลังไฟล์
          </Link>
          <Link href="/analytics"
            className="text-xs text-[#9C9690] border border-[#2C2A35] rounded-xl px-3 py-2 hover:border-[#9C9690] hover:text-bone transition-colors">
            📊 Analytics
          </Link>
        </div>
      </div>
    </div>
  );
}
