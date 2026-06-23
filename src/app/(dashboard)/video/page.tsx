'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Credential { id: string; displayName: string; providerCode: string; }
interface Provider { code: string; models: { modelCode: string; displayName: string }[]; }
interface Character { id: string; name: string; avatarEmoji: string; }
interface Skill { id: string; name: string; category: string; }

const AD_TYPES = [
  { code: 'facebook_video', label: 'Facebook/IG Video Ad', emoji: '📘', description: 'สคริปต์โฆษณาวิดีโอ + visual direction' },
  { code: 'tiktok_video',   label: 'TikTok Video Ad',      emoji: '🎵', description: 'สคริปต์แบบ organic ไม่ดูเป็นโฆษณา' },
  { code: 'youtube_preroll',label: 'YouTube Pre-roll',      emoji: '▶️',  description: 'ดึงดูดใน 5 วินาทีก่อน Skip' },
  { code: 'storyboard',     label: 'Storyboard',            emoji: '🎬', description: 'Shot by shot พร้อม camera + action' },
  { code: 'ad_package',     label: 'Complete Ad Package',   emoji: '📦', description: 'Hook 5 แบบ + Script + Storyboard + CTA' },
];

const DURATION_OPTIONS: Record<string, string[]> = {
  facebook_video: ['15 วินาที', '30 วินาที', '60 วินาที'],
  tiktok_video:   ['15 วินาที', '30 วินาที', '60 วินาที'],
  youtube_preroll:['6 วินาที (Bumper)', '15 วินาที (Non-skip)', '30 วินาที (Skippable)'],
  storyboard:     ['15 วินาที', '30 วินาที', '60 วินาที'],
  ad_package:     ['15 วินาที', '30 วินาที'],
};

const PLATFORM_OPTIONS = ['Facebook', 'Instagram', 'TikTok', 'YouTube', 'LINE'];

export default function VideoAdPage() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);

  const [adType, setAdType] = useState('facebook_video');
  const [platform, setPlatform] = useState('');
  const [product, setProduct] = useState('');
  const [brand, setBrand] = useState('');
  const [target, setTarget] = useState('');
  const [usp, setUsp] = useState('');
  const [duration, setDuration] = useState('');
  const [extra, setExtra] = useState('');

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
  const currentAdType = AD_TYPES.find((t) => t.code === adType)!;
  const hasInput = product || brand || target || usp;

  function handleAdTypeChange(code: string) {
    setAdType(code);
    setDuration('');
    setResult(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasInput) return;
    setError(null);
    setResult(null);
    setLoading(true);

    const res = await fetch('/api/workflows/video-ad/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        adType, platform, product, brand, target, usp, duration, extra,
        credentialId, modelCode,
        characterId: characterId || undefined,
        skillId: skillId || undefined
      })
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? 'สร้างไม่สำเร็จ'); return; }
    setResult(data);
  }

  if (credentials.length === 0) {
    return (
      <div>
        <h1 className="font-serif text-2xl mb-3">Video/Ad Pipeline</h1>
        <p className="text-sm text-[#9C9690] mb-4">ยังไม่ได้เชื่อมต่อ AI</p>
        <Link href="/settings/connected-ai" className="text-sm font-semibold text-gold">ไปที่ Connected AI →</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-1">
        <div>
          <h1 className="font-serif text-2xl">Video/Ad Pipeline</h1>
          <p className="text-sm text-[#9C9690] mt-1">สร้างสคริปต์โฆษณา Storyboard และชุด Ad ครบวงจร</p>
        </div>
        <div className="text-right flex-shrink-0 mt-1">
          <span className="text-xs text-[#9C9690] border border-[#2C2A35] rounded-full px-2.5 py-1">
            Script & Storyboard Phase
          </span>
          <p className="text-[10px] text-[#9C9690] mt-1">Video generation → Phase 2</p>
        </div>
      </div>

      {/* Ad Type selector */}
      <div className="mt-6 mb-6">
        <label className="block text-xs text-[#9C9690] mb-2">ประเภทโฆษณา</label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {AD_TYPES.map((t) => (
            <button key={t.code} onClick={() => handleAdTypeChange(t.code)}
              className={`flex items-start gap-3 text-left px-4 py-3 rounded-xl border transition-colors ${
                adType === t.code ? 'border-gold bg-gold/10' : 'border-[#2C2A35] hover:border-[#9C9690]'
              }`}>
              <span className="text-2xl flex-shrink-0">{t.emoji}</span>
              <div>
                <p className={`text-sm font-semibold ${adType === t.code ? 'text-gold' : 'text-bone'}`}>{t.label}</p>
                <p className="text-xs text-[#9C9690] mt-0.5">{t.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
        {/* Input fields */}
        <div className="rounded-2xl border border-[#2C2A35] p-4 space-y-3">
          <p className="text-xs text-[#9C9690] font-semibold uppercase tracking-wider">
            ข้อมูลสินค้า/โฆษณา — กรอกอย่างน้อย 1 ช่อง
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#9C9690] mb-1">
                สินค้า <span className="text-[10px] opacity-60">เช่น ครีมกันแดด SPF50</span>
              </label>
              <input value={product} onChange={(e) => setProduct(e.target.value)}
                placeholder="เช่น ครีมกันแดด SPF50"
                className="w-full rounded-xl px-3.5 py-2.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-[#9C9690] mb-1">
                แบรนด์ <span className="text-[10px] opacity-60">เช่น Aura Glow</span>
              </label>
              <input value={brand} onChange={(e) => setBrand(e.target.value)}
                placeholder="เช่น Aura Glow"
                className="w-full rounded-xl px-3.5 py-2.5 text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-[#9C9690] mb-1">
              กลุ่มเป้าหมาย <span className="text-[10px] opacity-60">เช่น ผู้หญิง 25-35 ปี ชอบดูแลผิว</span>
            </label>
            <input value={target} onChange={(e) => setTarget(e.target.value)}
              placeholder="เช่น ผู้หญิง 25-35 ปี ชอบดูแลผิว"
              className="w-full rounded-xl px-3.5 py-2.5 text-sm" />
          </div>

          <div>
            <label className="block text-xs text-[#9C9690] mb-1">
              จุดขาย / USP <span className="text-[10px] opacity-60">เช่น ซึมเร็ว ไม่เหนียว กันน้ำ 8 ชั่วโมง</span>
            </label>
            <textarea value={usp} onChange={(e) => setUsp(e.target.value)}
              placeholder="เช่น ซึมเร็ว ไม่เหนียว กันน้ำ 8 ชั่วโมง ทดสอบแพทย์แล้ว"
              className="w-full rounded-xl px-3.5 py-2.5 text-sm min-h-[60px] resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#9C9690] mb-1">ความยาววิดีโอ</label>
              <select value={duration} onChange={(e) => setDuration(e.target.value)}
                className="w-full rounded-xl px-3.5 py-2.5 text-sm">
                <option value="">ไม่ระบุ</option>
                {(DURATION_OPTIONS[adType] ?? []).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            {adType === 'storyboard' || adType === 'ad_package' ? (
              <div>
                <label className="block text-xs text-[#9C9690] mb-1">Platform หลัก</label>
                <select value={platform} onChange={(e) => setPlatform(e.target.value)}
                  className="w-full rounded-xl px-3.5 py-2.5 text-sm">
                  <option value="">ไม่ระบุ</option>
                  {PLATFORM_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            ) : <div />}
          </div>

          <div>
            <label className="block text-xs text-[#9C9690] mb-1">
              ข้อมูลเพิ่มเติม <span className="text-[10px] opacity-60">เช่น สี mood บรรยากาศ โปรโมชัน</span>
            </label>
            <textarea value={extra} onChange={(e) => setExtra(e.target.value)}
              placeholder="เช่น สีพาสเทล บรรยากาศสดใส โปรซื้อ 2 แถม 1 ราคา 590 บาท"
              className="w-full rounded-xl px-3.5 py-2.5 text-sm min-h-[60px] resize-none" />
          </div>
        </div>

        {/* AI + Model */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[#9C9690] mb-1.5">AI ที่ใช้</label>
            <select required value={credentialId}
              onChange={(e) => { setCredentialId(e.target.value); setModelCode(''); }}
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
                {selectedProvider.models.map((m) => (
                  <option key={m.modelCode} value={m.modelCode}>{m.displayName}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Character + Skill */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[#9C9690] mb-1.5">
              ตัวละคร <span className="text-[10px] opacity-60">(optional)</span>
            </label>
            <select value={characterId} onChange={(e) => setCharacterId(e.target.value)}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm">
              <option value="">ไม่ใช้ตัวละคร</option>
              {characters.map((c) => <option key={c.id} value={c.id}>{c.avatarEmoji} {c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#9C9690] mb-1.5">
              Skill <span className="text-[10px] opacity-60">(optional)</span>
            </label>
            <select value={skillId} onChange={(e) => setSkillId(e.target.value)}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm">
              <option value="">ใช้ prompt เริ่มต้น</option>
              {skills.filter((s) => s.category === 'video' || s.category === 'social').map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        {!hasInput && <p className="text-xs text-[#9C9690]">กรอกอย่างน้อย 1 ช่องด้านบน</p>}
        {error && <p className="text-sm text-[#C9716A]">{error}</p>}

        <button type="submit" disabled={loading || !hasInput || !credentialId || !modelCode}
          className="rounded-xl bg-gold text-black font-semibold px-5 py-2.5 text-sm disabled:opacity-50 w-full">
          {loading
            ? `กำลังสร้าง ${currentAdType.emoji} ${currentAdType.label}...`
            : `สร้าง ${currentAdType.emoji} ${currentAdType.label}`}
        </button>
      </form>

      {/* Result */}
      {result && (
        <div className="mt-10 border-t border-[#2C2A35] pt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-serif text-xl">{currentAdType.emoji} ผลลัพธ์</h2>
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
              download={`${adType}-${brand || product}.txt`}
              className="text-sm font-semibold text-[#9C9690]">
              ดาวน์โหลด .txt
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
