'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useFormPersist, formatSavedAt } from '@/lib/useFormPersist';
import { CopyButton } from '@/components/CopyButton';

interface Provider { code: string; displayName: string; models: { modelCode: string; displayName: string; capability: string }[]; }
interface CredentialOption { id: string; providerCode: string; displayName: string; }
interface Skill { id: string; name: string; promptTemplate: string; }

const LENGTH_OPTIONS = [
  { value: 'short',  label: 'สั้น',   desc: '300-400 คำ',  hint: 'สำหรับ blog post หรือ social' },
  { value: 'medium', label: 'กลาง',   desc: '600-800 คำ',  hint: 'มาตรฐาน SEO ทั่วไป' },
  { value: 'long',   label: 'ยาว',    desc: '1000-1500 คำ', hint: 'เชิงลึก Pillar Content' },
];

const TONE_OPTIONS = [
  { value: '',             label: 'ไม่ระบุ',     emoji: '—' },
  { value: 'friendly',     label: 'เป็นกันเอง', emoji: '😊' },
  { value: 'professional', label: 'มืออาชีพ',   emoji: '💼' },
  { value: 'academic',     label: 'วิชาการ',     emoji: '🎓' },
  { value: 'fun',          label: 'สนุกสนาน',   emoji: '🎉' },
  { value: 'persuasive',   label: 'โน้มน้าว',    emoji: '✨' },
];

export default function SeoArticlePage() {
  const searchParams = useSearchParams();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [credentials, setCredentials] = useState<CredentialOption[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ text: string; costCredit: number; assetId: string } | null>(null);

  const { values: form, setField, clearForm, saveForm, savedAt } = useFormPersist('seo', {
    topic: '', keyword: '', target: '', extra: '',
    length: 'medium', tone: '',
    credentialId: '', modelCode: ''
  });
  const { topic, keyword, target, extra, length, tone, credentialId, modelCode } = form;

  useEffect(() => {
    Promise.all([
      fetch('/api/ai-providers?capability=text').then((r) => r.json()),
      fetch('/api/credentials').then((r) => r.json()),
    ]).then(([prov, cred]) => {
      setProviders(prov.providers ?? []);
      setCredentials(cred.credentials ?? []);
    });

    const skillId = searchParams.get('skillId');
    if (skillId) {
      fetch('/api/skills?category=').then((r) => r.json()).then((data) => {
        const skill = (data.skills ?? []).find((s: Skill) => s.id === skillId);
        if (skill) setSelectedSkill(skill);
      });
    }
  }, [searchParams]);

  const selectedCredential = credentials.find((c) => c.id === credentialId);
  const selectedProvider = providers.find((p) => p.code === selectedCredential?.providerCode);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);

    const res = await fetch('/api/workflows/seo-article/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ topic, keyword, target, extra, length, tone, credentialId, modelCode, skillId: selectedSkill?.id })
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) { setError(data.error ?? 'สร้างบทความไม่สำเร็จ'); return; }
    setResult(data);
  }

  if (credentials.length === 0) {
    return (
      <div>
        <h1 className="font-serif text-2xl mb-3">เขียนบทความ SEO</h1>
        <p className="text-sm text-[#9C9690] mb-4">ยังไม่ได้เชื่อมต่อ AI ต้องเพิ่ม API Key ก่อน</p>
        <Link href="/settings/connected-ai" className="text-sm font-semibold text-gold">ไปที่ Connected AI →</Link>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-serif text-2xl">เขียนบทความ SEO</h1>
        <div className="flex items-center gap-2">
          {savedAt && <span className="text-[10px] text-[#9C9690]">💾 {formatSavedAt(savedAt)}</span>}
          {(topic || keyword) && (
            <button onClick={() => { clearForm(); setSelectedSkill(null); setResult(null); }}
              className="text-xs text-[#9C9690] border border-[#2C2A35] rounded-lg px-2.5 py-1 hover:border-[#C9716A] hover:text-[#C9716A]">
              ล้างข้อมูล
            </button>
          )}
        </div>
      </div>
      <p className="text-sm text-[#9C9690] mb-6">กรอกหัวข้อ ปรับแต่งตามต้องการ แล้วกดสร้างได้เลย</p>

      {/* Selected skill badge */}
      {selectedSkill && (
        <div className="flex items-center justify-between rounded-2xl bg-gold/10 border border-gold/30 px-4 py-2.5 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold text-gold bg-gold/20 px-1.5 py-0.5 rounded-full">SKILL</span>
            <span className="text-sm font-semibold">{selectedSkill.name}</span>
          </div>
          <button onClick={() => setSelectedSkill(null)} className="text-xs text-[#9C9690] hover:text-bone">ลบออก ×</button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5 max-w-xl">

        {/* Topic + Keyword */}
        <div className="rounded-2xl border border-[#2C2A35] p-4 space-y-3">
          <p className="text-xs text-[#9C9690] font-semibold uppercase tracking-wider">ข้อมูลบทความ</p>
          <div>
            <label className="block text-xs text-[#9C9690] mb-1.5">หัวข้อบทความ *</label>
            <input required value={topic} onChange={(e) => setField('topic', e.target.value)}
              placeholder="เช่น วิธีเลือกเซรั่มบำรุงผิวหน้าสำหรับผิวมัน"
              className="w-full rounded-xl px-3.5 py-2.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-[#9C9690] mb-1.5">คีย์เวิร์ดหลัก *</label>
            <input required value={keyword} onChange={(e) => setField('keyword', e.target.value)}
              placeholder="เช่น เซรั่มผิวมัน, เซรั่มลดสิว"
              className="w-full rounded-xl px-3.5 py-2.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-[#9C9690] mb-1.5">
              กลุ่มเป้าหมาย <span className="text-[10px] opacity-60">(optional) เช่น ผู้หญิง 25-35 ปี ผิวมัน</span>
            </label>
            <input value={target} onChange={(e) => setField('target', e.target.value)}
              placeholder="เช่น ผู้หญิงอายุ 20-35 ปี มีปัญหาผิวมันและสิว"
              className="w-full rounded-xl px-3.5 py-2.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-[#9C9690] mb-1.5">
              รายละเอียดเพิ่มเติม <span className="text-[10px] opacity-60">(optional)</span>
            </label>
            <textarea value={extra} onChange={(e) => setField('extra', e.target.value)}
              placeholder="เช่น เน้นส่วนผสม Niacinamide, เปรียบเทียบ 5 ผลิตภัณฑ์, มีตารางเปรียบเทียบ"
              className="w-full rounded-xl px-3.5 py-2.5 text-sm min-h-[64px] resize-none" />
          </div>
        </div>

        {/* Length */}
        <div>
          <label className="block text-xs text-[#9C9690] mb-2">ความยาวบทความ</label>
          <div className="grid grid-cols-3 gap-2">
            {LENGTH_OPTIONS.map((opt) => (
              <button key={opt.value} type="button"
                onClick={() => setField('length', opt.value)}
                className={`text-left rounded-xl border px-3 py-2.5 transition-colors ${
                  length === opt.value ? 'border-gold bg-gold/10' : 'border-[#2C2A35] hover:border-[#9C9690]'
                }`}>
                <p className={`text-sm font-semibold ${length === opt.value ? 'text-gold' : 'text-bone'}`}>{opt.label}</p>
                <p className="text-[10px] text-[#9C9690] mt-0.5">{opt.desc}</p>
                <p className="text-[9px] text-[#9C9690]/60 mt-0.5">{opt.hint}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Tone */}
        <div>
          <label className="block text-xs text-[#9C9690] mb-2">โทนการเขียน</label>
          <div className="flex flex-wrap gap-2">
            {TONE_OPTIONS.map((opt) => (
              <button key={opt.value} type="button"
                onClick={() => setField('tone', opt.value)}
                className={`text-xs px-3 py-1.5 rounded-xl border transition-colors ${
                  tone === opt.value ? 'border-gold bg-gold/10 text-gold font-semibold' : 'border-[#2C2A35] text-[#9C9690] hover:border-[#9C9690]'
                }`}>
                {opt.emoji !== '—' && <span className="mr-1">{opt.emoji}</span>}{opt.label}
              </button>
            ))}
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
                {selectedProvider.models
                  .filter((m) => m.capability === 'text')
                  .map((m) => <option key={m.modelCode} value={m.modelCode}>{m.displayName}</option>)}
              </select>
            </div>
          )}
        </div>

        {!selectedSkill && (
          <Link href="/skills" className="inline-block text-xs text-[#9C9690] hover:text-gold border border-[#2C2A35] rounded-xl px-3 py-2 hover:border-gold/40 transition-colors">
            ⚡ เลือก Skill เพิ่มประสิทธิภาพ →
          </Link>
        )}

        {error && <p className="text-sm text-[#C9716A]">{error}</p>}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={loading}
            className="rounded-xl bg-gold text-black font-semibold px-5 py-2.5 text-sm disabled:opacity-50">
            {loading ? 'กำลังสร้างบทความ...' : 'สร้างบทความ'}
          </button>
          <button type="button" onClick={saveForm}
            className="rounded-xl border border-[#2C2A35] text-[#9C9690] hover:border-[#9C9690] px-4 py-2.5 text-sm">
            💾 บันทึก
          </button>
        </div>
      </form>

      {result && (
        <div className="mt-10 border-t border-[#2C2A35] pt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-serif text-xl">ผลลัพธ์</h2>
            <span className="text-xs text-[#9C9690] font-mono">~{result.costCredit} เครดิต</span>
          </div>
          <article className="whitespace-pre-line text-sm leading-relaxed bg-[#1C1B23] rounded-2xl p-5 border border-[#2C2A35]">
            {result.text}
          </article>
          <div className="flex gap-3 mt-4 flex-wrap">
            <CopyButton text={result.text} label="คัดลอกบทความ" size="md" />
            <Link href={`/assets/${result.assetId}`} className="text-sm font-semibold text-gold border border-gold/40 rounded-xl px-4 py-2 hover:bg-gold/10">
              ดู Generation Recipe →
            </Link>
            <a href={`data:text/plain;charset=utf-8,${encodeURIComponent(result.text)}`}
              download={`${topic}.txt`} className="text-sm font-semibold text-[#9C9690] border border-[#2C2A35] rounded-xl px-4 py-2 hover:border-[#9C9690]">
              ↓ .txt
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
