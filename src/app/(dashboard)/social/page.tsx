'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Credential { id: string; displayName: string; providerCode: string; }
interface Provider { code: string; models: { modelCode: string; displayName: string }[]; }
interface Character { id: string; name: string; avatarEmoji: string; role: string; }
interface Skill { id: string; name: string; category: string; }

const PLATFORMS = [
  { code: 'facebook',  label: 'Facebook',   emoji: '📘', color: '#1877F2' },
  { code: 'instagram', label: 'Instagram',  emoji: '📸', color: '#E1306C' },
  { code: 'tiktok',    label: 'TikTok',     emoji: '🎵', color: '#010101' },
  { code: 'youtube',   label: 'YouTube',    emoji: '▶️',  color: '#FF0000' },
  { code: 'linkedin',  label: 'LinkedIn',   emoji: '💼', color: '#0A66C2' },
  { code: 'twitter',   label: 'Twitter/X',  emoji: '✖️',  color: '#000000' },
];

const CONTENT_TYPES: Record<string, { code: string; label: string; description: string }[]> = {
  facebook:  [
    { code: 'caption', label: 'แคปชั่นโพสต์', description: 'โพสต์ทั่วไป + hashtag' },
    { code: 'ads',     label: 'โฆษณา Ads',    description: 'Copy AIDA 3 versions' }
  ],
  instagram: [
    { code: 'caption', label: 'แคปชั่น + Hashtag', description: 'โพสต์รูปภาพ' },
    { code: 'reels',   label: 'สคริปต์ Reels',     description: '15-60 วินาที' }
  ],
  tiktok:    [
    { code: 'script',  label: 'สคริปต์วิดีโอ', description: '30-60 วินาที Hook + เนื้อหา + CTA' },
    { code: 'hook',    label: 'Hook 5 แบบ',     description: 'ไอเดีย Hook หยุดคนเลื่อน' }
  ],
  youtube:   [
    { code: 'script',  label: 'สคริปต์วิดีโอ', description: 'Hook + เนื้อหา + CTA ระบุเวลา' },
    { code: 'seo',     label: 'Title + Description + Tags', description: 'YouTube SEO' }
  ],
  linkedin:  [
    { code: 'post',    label: 'โพสต์ Professional', description: 'Thought Leadership' }
  ],
  twitter:   [
    { code: 'tweet',   label: 'Tweet 5 แบบ', description: 'ไม่เกิน 280 ตัวอักษร' },
    { code: 'thread',  label: 'Thread',       description: '5-8 tweets ต่อเนื่อง' }
  ]
};

export default function SocialContentPage() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);

  const [platform, setPlatform] = useState('facebook');
  const [contentType, setContentType] = useState('caption');
  const [topic, setTopic] = useState('');
  const [credentialId, setCredentialId] = useState('');
  const [modelCode, setModelCode] = useState('');
  const [characterId, setCharacterId] = useState('');
  const [skillId, setSkillId] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ text: string; costCredit: number; assetId: string } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/credentials').then((r) => r.json()),
      fetch('/api/ai-providers?capability=text').then((r) => r.json()),
      fetch('/api/characters').then((r) => r.json()),
      fetch('/api/skills').then((r) => r.json()),
    ]).then(([cred, prov, char, skill]) => {
      setCredentials(cred.credentials ?? []);
      setProviders(prov.providers ?? []);
      setCharacters(char.characters ?? []);
      setSkills(skill.skills ?? []);
    });
  }, []);

  const selectedCredential = credentials.find((c) => c.id === credentialId);
  const selectedProvider = providers.find((p) => p.code === selectedCredential?.providerCode);
  const currentPlatform = PLATFORMS.find((p) => p.code === platform)!;
  const contentTypes = CONTENT_TYPES[platform] ?? [];

  // Reset content type when platform changes
  function handlePlatformChange(p: string) {
    setPlatform(p);
    setContentType(CONTENT_TYPES[p]?.[0]?.code ?? '');
    setResult(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    const res = await fetch('/api/workflows/social-content/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ platform, contentType, topic, credentialId, modelCode,
        characterId: characterId || undefined, skillId: skillId || undefined })
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? 'สร้างคอนเทนต์ไม่สำเร็จ'); return; }
    setResult(data);
  }

  if (credentials.length === 0) {
    return (
      <div>
        <h1 className="font-serif text-2xl mb-3">Social Content</h1>
        <p className="text-sm text-[#9C9690] mb-4">ยังไม่ได้เชื่อมต่อ AI ต้องเพิ่ม API Key ก่อน</p>
        <Link href="/settings/connected-ai" className="text-sm font-semibold text-gold">ไปที่ Connected AI →</Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-serif text-2xl mb-1">Social Content</h1>
      <p className="text-sm text-[#9C9690] mb-6">สร้างคอนเทนต์โซเชียลมีเดียทุก platform ด้วย AI</p>

      {/* Platform selector */}
      <div className="mb-5">
        <label className="block text-xs text-[#9C9690] mb-2">Platform</label>
        <div className="flex gap-2 flex-wrap">
          {PLATFORMS.map((p) => (
            <button key={p.code} onClick={() => handlePlatformChange(p.code)}
              className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border transition-colors ${
                platform === p.code ? 'border-gold bg-gold/10 text-gold font-semibold' : 'border-[#2C2A35] text-[#9C9690] hover:border-[#9C9690]'
              }`}>
              <span>{p.emoji}</span> {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content type selector */}
      <div className="mb-5">
        <label className="block text-xs text-[#9C9690] mb-2">ประเภทคอนเทนต์</label>
        <div className="flex gap-2 flex-wrap">
          {contentTypes.map((ct) => (
            <button key={ct.code} onClick={() => { setContentType(ct.code); setResult(null); }}
              className={`text-left text-xs px-3 py-2 rounded-xl border transition-colors ${
                contentType === ct.code ? 'border-gold bg-gold/10 text-gold font-semibold' : 'border-[#2C2A35] text-[#9C9690] hover:border-[#9C9690]'
              }`}>
              <div>{ct.label}</div>
              <div className="text-[10px] opacity-70 mt-0.5">{ct.description}</div>
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
        {/* Topic */}
        <div>
          <label className="block text-xs text-[#9C9690] mb-1.5">หัวข้อ / สินค้า / เนื้อหา</label>
          <textarea required value={topic} onChange={(e) => setTopic(e.target.value)}
            placeholder={`เช่น ${currentPlatform.emoji} ${
              platform === 'tiktok' ? 'วิธีดูแลผิวหน้าง่ายๆ 3 ขั้นตอน'
              : platform === 'youtube' ? 'รีวิวครีมกันแดด 5 ยี่ห้อยอดฮิต'
              : 'ครีมบำรุงผิวสูตรใหม่ เนื้อบางเบา ซึมเร็ว'
            }`}
            className="w-full rounded-xl px-3.5 py-2.5 text-sm min-h-[80px] resize-none" />
        </div>

        {/* AI selector */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[#9C9690] mb-1.5">AI ที่ใช้</label>
            <select required value={credentialId} onChange={(e) => { setCredentialId(e.target.value); setModelCode(''); }}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm">
              <option value="">เลือก AI</option>
              {credentials.map((c) => <option key={c.id} value={c.id}>{c.displayName}</option>)}
            </select>
          </div>
          {selectedProvider && (
            <div>
              <label className="block text-xs text-[#9C9690] mb-1.5">โมเดล</label>
              <select required value={modelCode} onChange={(e) => setModelCode(e.target.value)}
                className="w-full rounded-xl px-3.5 py-2.5 text-sm">
                <option value="">เลือกโมเดล</option>
                {selectedProvider.models.map((m) => <option key={m.modelCode} value={m.modelCode}>{m.displayName}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Optional: Character + Skill */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[#9C9690] mb-1.5">ตัวละคร (optional)</label>
            <select value={characterId} onChange={(e) => setCharacterId(e.target.value)}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm">
              <option value="">ไม่ใช้ตัวละคร</option>
              {characters.map((c) => <option key={c.id} value={c.id}>{c.avatarEmoji} {c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#9C9690] mb-1.5">Skill (optional)</label>
            <select value={skillId} onChange={(e) => setSkillId(e.target.value)}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm">
              <option value="">ใช้ prompt เริ่มต้น</option>
              {skills.filter((s) => s.category === 'social' || s.category === 'video').map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="text-sm text-[#C9716A]">{error}</p>}

        <button type="submit" disabled={loading}
          className="rounded-xl bg-gold text-black font-semibold px-5 py-2.5 text-sm disabled:opacity-50">
          {loading ? `กำลังสร้าง ${currentPlatform.emoji} ${contentType}...` : `สร้าง ${currentPlatform.label} Content`}
        </button>
      </form>

      {/* Result */}
      {result && (
        <div className="mt-10 border-t border-[#2C2A35] pt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-serif text-xl">ผลลัพธ์ {currentPlatform.emoji}</h2>
            <span className="text-xs text-[#9C9690] font-mono">~{result.costCredit} เครดิต</span>
          </div>
          <article className="whitespace-pre-line text-sm leading-relaxed bg-[#1C1B23] rounded-2xl p-5 border border-[#2C2A35]">
            {result.text}
          </article>
          <div className="flex gap-3 mt-4">
            <Link href={`/assets/${result.assetId}`} className="text-sm font-semibold text-gold">
              ดู Generation Recipe →
            </Link>
            <a href={`data:text/plain;charset=utf-8,${encodeURIComponent(result.text)}`}
              download={`${platform}-${contentType}-${topic.slice(0,20)}.txt`}
              className="text-sm font-semibold text-[#9C9690]">
              ดาวน์โหลด .txt
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
