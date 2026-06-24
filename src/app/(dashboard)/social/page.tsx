'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useFormPersist, formatSavedAt } from '@/lib/useFormPersist';
import { CopyButton } from '@/components/CopyButton';
import { useToast } from '@/components/Toast';

interface Credential { id: string; displayName: string; providerCode: string; }
interface Provider { code: string; models: { modelCode: string; displayName: string }[]; }
interface Character { id: string; name: string; avatarEmoji: string; }
interface Skill { id: string; name: string; category: string; }

const PLATFORMS = [
  { code: 'facebook',  label: 'Facebook',   emoji: '📘' },
  { code: 'instagram', label: 'Instagram',  emoji: '📸' },
  { code: 'tiktok',    label: 'TikTok',     emoji: '🎵' },
  { code: 'youtube',   label: 'YouTube',    emoji: '▶️'  },
  { code: 'linkedin',  label: 'LinkedIn',   emoji: '💼' },
  { code: 'twitter',   label: 'Twitter/X',  emoji: '✖️'  },
];

const CONTENT_TYPES: Record<string, { code: string; label: string; description: string }[]> = {
  facebook:  [
    { code: 'caption', label: 'แคปชั่นโพสต์',   description: 'โพสต์ทั่วไป + hashtag' },
    { code: 'ads',     label: 'โฆษณา Ads',       description: 'Copy AIDA 3 versions' }
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
    { code: 'script',  label: 'สคริปต์วิดีโอ',           description: 'Hook + เนื้อหา + CTA ระบุเวลา' },
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

// Placeholder examples per platform
const PLACEHOLDERS: Record<string, { topic: string; product: string; target: string; extra: string }> = {
  facebook:  { topic: 'เปิดตัวสินค้าใหม่', product: 'ครีมบำรุงผิว AuraGlow', target: 'ผู้หญิงอายุ 25-35 ปี', extra: 'เนื้อบางเบา ซึมเร็ว SPF50' },
  instagram: { topic: 'Skincare routine เช้า', product: 'เซรั่มวิตามินซี', target: 'สาวๆ รักผิว', extra: 'ลดฝ้า กระ ผิวกระจ่างใส' },
  tiktok:    { topic: '3 เคล็ดลับผิวสวยง่ายๆ', product: 'ครีมกันแดด', target: 'วัยรุ่น Gen Z', extra: 'ใช้ง่าย ราคาไม่แพง' },
  youtube:   { topic: 'รีวิวครีมกันแดด 5 ยี่ห้อ', product: 'ครีมกันแดด', target: 'คนชอบดูแลผิว', extra: 'เปรียบเทียบราคา texture และความคุ้มค่า' },
  linkedin:  { topic: 'Digital Marketing Trends 2025', product: 'Aura-D Studio', target: 'นักการตลาดและเจ้าของธุรกิจ', extra: 'AI ช่วยสร้างคอนเทนต์ได้เร็วขึ้น 10x' },
  twitter:   { topic: 'Tips การทำ Content Marketing', product: '', target: 'Content Creator ไทย', extra: 'เน้น practical tips ที่ทำได้ทันที' },
};

export default function SocialContentPage() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);

  const { success: toastSuccess, error: toastError } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ text: string; costCredit: number; assetId: string } | null>(null);

  // Persist form data across navigation
  const { values: form, setField, clearForm, saveForm, savedAt } = useFormPersist('social', {
    platform: 'facebook', contentType: 'caption',
    topic: '', product: '', target: '', extra: '',
    credentialId: '', modelCode: '', characterId: '', skillId: ''
  });
  const { platform, contentType, topic, product, target, extra, credentialId, modelCode, characterId, skillId } = form;

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
  const ph = PLACEHOLDERS[platform];

  function handlePlatformChange(p: string) {
    setField('platform', p);
    setField('contentType', CONTENT_TYPES[p]?.[0]?.code ?? '');
    setResult(null);
  }

  // Build combined topic from filled fields
  function buildTopic(): string {
    const parts = [];
    if (topic.trim())   parts.push(`หัวข้อ: ${topic.trim()}`);
    if (product.trim()) parts.push(`สินค้า/แบรนด์: ${product.trim()}`);
    if (target.trim())  parts.push(`กลุ่มเป้าหมาย: ${target.trim()}`);
    if (extra.trim())   parts.push(`รายละเอียดเพิ่มเติม: ${extra.trim()}`);
    return parts.join(' | ');
  }

  const hasInput = topic.trim() || product.trim() || target.trim() || extra.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasInput) return;
    setError(null);
    setResult(null);
    setLoading(true);

    const res = await fetch('/api/workflows/social-content/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        platform, contentType,
        topic: buildTopic(),
        credentialId, modelCode,
        characterId: characterId || undefined,
        skillId: skillId || undefined
      })
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { toastError(data.error ?? 'สร้างคอนเทนต์ไม่สำเร็จ'); setError(data.error ?? 'สร้างคอนเทนต์ไม่สำเร็จ'); return; }
    toastSuccess('✓ สร้างคอนเทนต์สำเร็จ บันทึกในคลังไฟล์แล้ว');
    clearForm();
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
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-serif text-2xl">Social Content</h1>
        <div className="flex items-center gap-2">
          {savedAt && (
            <span className="text-[10px] text-[#9C9690]">
              💾 บันทึกอัตโนมัติ {formatSavedAt(savedAt)}
            </span>
          )}
          {(topic || product || target || extra) && (
            <button onClick={() => { clearForm(); setResult(null); }}
              className="text-xs text-[#9C9690] border border-[#2C2A35] rounded-lg px-2.5 py-1 hover:border-[#C9716A] hover:text-[#C9716A]">
              ล้างข้อมูล
            </button>
          )}
        </div>
      </div>
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
      <div className="mb-6">
        <label className="block text-xs text-[#9C9690] mb-2">ประเภทคอนเทนต์</label>
        <div className="flex gap-2 flex-wrap">
          {CONTENT_TYPES[platform]?.map((ct) => (
            <button key={ct.code} onClick={() => { setField('contentType', ct.code); setResult(null); }}
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

        {/* Input fields — separate boxes */}
        <div className="rounded-2xl border border-[#2C2A35] p-4 space-y-3">
          <p className="text-xs text-[#9C9690] font-semibold uppercase tracking-wider">
            ข้อมูลสำหรับสร้างคอนเทนต์ — กรอกอย่างน้อย 1 ช่อง
          </p>

          {/* หัวข้อ */}
          <div>
            <label className="block text-xs text-[#9C9690] mb-1">
              หัวข้อ
              <span className="ml-1 text-[10px] text-[#9C9690]/60">เช่น {ph.topic}</span>
            </label>
            <input value={topic} onChange={(e) => setField('topic', e.target.value)}
              placeholder={ph.topic}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm" />
          </div>

          {/* ชื่อสินค้า/แบรนด์ */}
          <div>
            <label className="block text-xs text-[#9C9690] mb-1">
              ชื่อสินค้า / แบรนด์
              {ph.product && <span className="ml-1 text-[10px] text-[#9C9690]/60">เช่น {ph.product}</span>}
            </label>
            <input value={product} onChange={(e) => setField('product', e.target.value)}
              placeholder={ph.product || 'เช่น AuraGlow, ร้านกาแฟ The Brew'}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm" />
          </div>

          {/* กลุ่มเป้าหมาย */}
          <div>
            <label className="block text-xs text-[#9C9690] mb-1">
              กลุ่มเป้าหมาย
              <span className="ml-1 text-[10px] text-[#9C9690]/60">เช่น {ph.target}</span>
            </label>
            <input value={target} onChange={(e) => setField('target', e.target.value)}
              placeholder={ph.target}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm" />
          </div>

          {/* รายละเอียดเพิ่มเติม */}
          <div>
            <label className="block text-xs text-[#9C9690] mb-1">
              รายละเอียดเพิ่มเติม / จุดเด่นสินค้า
              <span className="ml-1 text-[10px] text-[#9C9690]/60">เช่น {ph.extra}</span>
            </label>
            <textarea value={extra} onChange={(e) => setField('extra', e.target.value)}
              placeholder={ph.extra}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm min-h-[72px] resize-none" />
          </div>
        </div>

        {/* AI + Model */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[#9C9690] mb-1.5">AI ที่ใช้</label>
            <select required value={credentialId}
              onChange={(e) => { setField('credentialId', e.target.value); setField('modelCode', ''); }}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm">
              <option value="">เลือก AI</option>
              {credentials.map((c) => <option key={c.id} value={c.id}>{c.displayName}</option>)}
            </select>
          </div>
          {selectedProvider && (
            <div>
              <label className="block text-xs text-[#9C9690] mb-1.5">โมเดล</label>
              <select required value={modelCode} onChange={(e) => setField('modelCode', e.target.value)}
                className="w-full rounded-xl px-3.5 py-2.5 text-sm">
                <option value="">เลือกโมเดล</option>
                {selectedProvider.models.map((m) => (
                  <option key={m.modelCode} value={m.modelCode}>{m.displayName}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Character + Skill (optional) */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[#9C9690] mb-1.5">
              ตัวละคร <span className="text-[10px] text-[#9C9690]/60">(optional)</span>
            </label>
            <select value={characterId} onChange={(e) => setField('characterId', e.target.value)}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm">
              <option value="">ไม่ใช้ตัวละคร</option>
              {characters.map((c) => (
                <option key={c.id} value={c.id}>{c.avatarEmoji} {c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#9C9690] mb-1.5">
              Skill <span className="text-[10px] text-[#9C9690]/60">(optional)</span>
            </label>
            <select value={skillId} onChange={(e) => setField('skillId', e.target.value)}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm">
              <option value="">ใช้ prompt เริ่มต้น</option>
              {skills
                .filter((s) => s.category === 'social' || s.category === 'video')
                .map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        {!hasInput && (
          <p className="text-xs text-[#9C9690]">กรอกอย่างน้อย 1 ช่องด้านบน</p>
        )}
        {error && <p className="text-sm text-[#C9716A]">{error}</p>}

        <div className="flex items-center gap-3 flex-wrap">
          <button type="submit" disabled={loading || !hasInput || !credentialId || !modelCode}
            className="rounded-xl bg-gold text-black font-semibold px-5 py-2.5 text-sm disabled:opacity-50">
            {loading
              ? `กำลังสร้าง ${currentPlatform.emoji}...`
              : `สร้าง ${currentPlatform.label} Content`}
          </button>
          <button type="button" onClick={saveForm}
            className="rounded-xl border border-[#2C2A35] text-[#9C9690] hover:border-[#9C9690] px-4 py-2.5 text-sm">
            💾 บันทึก
          </button>
          {savedAt && (
            <span className="text-xs text-[#9C9690]">
              บันทึกแล้ว {new Date(savedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
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
          <div className="flex gap-3 mt-4 flex-wrap">
            <CopyButton text={result.text} label="คัดลอก" size="md" />
            <Link href={`/assets/${result.assetId}`} className="text-sm font-semibold text-gold border border-gold/40 rounded-xl px-4 py-2 hover:bg-gold/10">
              ดู Generation Recipe →
            </Link>
            <a href={`data:text/plain;charset=utf-8,${encodeURIComponent(result.text)}`}
              download={`${platform}-${contentType}.txt`}
              className="text-sm font-semibold text-[#9C9690] border border-[#2C2A35] rounded-xl px-4 py-2 hover:border-[#9C9690]">
              ↓ .txt
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
