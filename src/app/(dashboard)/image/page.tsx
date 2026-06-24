'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useFormPersist, formatSavedAt } from '@/lib/useFormPersist';

interface Credential { id: string; displayName: string; providerCode: string; }
interface Provider { code: string; models: { modelCode: string; displayName: string; capability: string }[]; }

const STYLES = [
  { code: '',             label: 'ไม่ระบุ (AI เลือกเอง)' },
  { code: 'photorealistic', label: '📷 Photorealistic' },
  { code: 'anime',         label: '🎌 Anime / Illustration' },
  { code: 'watercolor',    label: '🎨 Watercolor' },
  { code: 'oil painting',  label: '🖼️ Oil Painting' },
  { code: '3D render',     label: '💎 3D Render' },
  { code: 'flat design',   label: '📐 Flat Design / Vector' },
  { code: 'cinematic',     label: '🎬 Cinematic' },
  { code: 'minimalist',    label: '◻️ Minimalist' },
];

const PROMPT_EXAMPLES = [
  'สาวไทยยิ้มในสวนดอกไม้ แสงอาทิตย์ยามเช้า',
  'ผลิตภัณฑ์ครีมบำรุงผิววางบนหินอ่อนสีขาว พร้อมดอกไม้ประกอบ',
  'โลโก้แบรนด์ความงาม สไตล์ minimal สีทอง พื้นหลังดำ',
  'บรรยากาศร้านกาแฟ cozy ในตอนเย็น แสง warm tone',
  'กราฟิกโฆษณา Flash Sale 50% พื้นหลังสีส้มสด ตัวอักษรขาว',
];

export default function ImageGenerationPage() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ dataUrl: string; assetId: string; mimeType: string } | null>(null);

  const { values: form, setField, clearForm, savedAt } = useFormPersist('image', {
    prompt: '', negativePrompt: '', style: '', credentialId: '', modelCode: ''
  });
  const { prompt, negativePrompt, style, credentialId, modelCode } = form;

  useEffect(() => {
    Promise.all([
      fetch('/api/credentials').then((r) => r.json()),
      fetch('/api/ai-providers?capability=image').then((r) => r.json()),
    ]).then(([cred, prov]) => {
      setCredentials(cred.credentials ?? []);
      setProviders(prov.providers ?? []);
    });
  }, []);

  const selectedCredential = credentials.find((c) => c.id === credentialId);
  const selectedProvider = providers.find((p) => p.code === selectedCredential?.providerCode);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
    setError(null);
    setResult(null);
    setLoading(true);

    const res = await fetch('/api/workflows/generate-image/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt, negativePrompt, style, credentialId, modelCode })
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) { setError(data.error ?? 'สร้างภาพไม่สำเร็จ'); return; }
    clearForm();
    setResult(data);
  }

  async function handleDownload() {
    if (!result) return;
    const a = document.createElement('a');
    a.href = result.dataUrl;
    a.download = `aura-image-${Date.now()}.${result.mimeType.split('/')[1] ?? 'png'}`;
    a.click();
  }

  // Filter credentials to image-capable providers only
  const imageCredentials = credentials.filter((c) =>
    providers.some((p) => p.code === c.providerCode)
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="font-serif text-2xl">สร้างภาพ AI</h1>
          <p className="text-sm text-[#9C9690] mt-1">สร้างภาพด้วย Nano Banana (Gemini) และ Grok Imagine</p>
        </div>
        <div className="flex items-center gap-2">
          {savedAt && <span className="text-[10px] text-[#9C9690]">💾 {formatSavedAt(savedAt)}</span>}
          {prompt && (
            <button onClick={() => { clearForm(); setResult(null); }}
              className="text-xs text-[#9C9690] border border-[#2C2A35] rounded-lg px-2.5 py-1 hover:border-[#C9716A] hover:text-[#C9716A]">
              ล้างข้อมูล
            </button>
          )}
        </div>
      </div>

      {imageCredentials.length === 0 && (
        <div className="mt-4 p-4 rounded-2xl border border-[#2C2A35] text-sm text-[#9C9690]">
          ยังไม่มี API Key ที่รองรับการสร้างภาพ — ต้องใช้{' '}
          <strong className="text-bone">Google Gemini</strong> (Nano Banana) หรือ{' '}
          <strong className="text-bone">xAI Grok</strong> (Grok Imagine){' '}
          <Link href="/settings/connected-ai" className="text-gold font-semibold">ไปที่ Connected AI →</Link>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4 max-w-xl">

        {/* Prompt */}
        <div>
          <label className="block text-xs text-[#9C9690] mb-1.5">
            Prompt — บอกว่าต้องการภาพอะไร
          </label>
          <textarea required value={prompt}
            onChange={(e) => setField('prompt', e.target.value)}
            placeholder="เช่น สาวไทยยิ้มในสวนดอกไม้ แสงอาทิตย์ยามเช้า สีสันสดใส"
            className="w-full rounded-xl px-3.5 py-2.5 text-sm min-h-[100px] resize-none" />

          {/* Quick examples */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PROMPT_EXAMPLES.map((ex) => (
              <button key={ex} type="button"
                onClick={() => setField('prompt', ex)}
                className="text-[10px] text-[#9C9690] border border-[#2C2A35] rounded-lg px-2 py-1 hover:border-[#9C9690] hover:text-bone text-left">
                {ex.slice(0, 30)}...
              </button>
            ))}
          </div>
        </div>

        {/* Negative Prompt */}
        <div>
          <label className="block text-xs text-[#9C9690] mb-1.5">
            Negative Prompt <span className="text-[10px] opacity-60">(optional) — สิ่งที่ไม่ต้องการในภาพ</span>
          </label>
          <input value={negativePrompt}
            onChange={(e) => setField('negativePrompt', e.target.value)}
            placeholder="เช่น blurry, low quality, watermark, text, logo"
            className="w-full rounded-xl px-3.5 py-2.5 text-sm" />
        </div>

        {/* Style */}
        <div>
          <label className="block text-xs text-[#9C9690] mb-2">สไตล์ภาพ</label>
          <div className="flex flex-wrap gap-2">
            {STYLES.map((s) => (
              <button key={s.code} type="button"
                onClick={() => setField('style', s.code)}
                className={`text-xs px-3 py-1.5 rounded-xl border transition-colors ${
                  style === s.code ? 'border-gold bg-gold/10 text-gold font-semibold' : 'border-[#2C2A35] text-[#9C9690] hover:border-[#9C9690]'
                }`}>
                {s.label}
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
              {imageCredentials.map((c) => (
                <option key={c.id} value={c.id}>{c.displayName}</option>
              ))}
            </select>
          </div>
          {selectedProvider && (
            <div>
              <label className="block text-xs text-[#9C9690] mb-1.5">โมเดล</label>
              <select required value={modelCode}
                onChange={(e) => setField('modelCode', e.target.value)}
                className="w-full rounded-xl px-3.5 py-2.5 text-sm">
                <option value="">เลือกโมเดล</option>
                {selectedProvider.models
                  .filter((m) => m.capability === 'image')
                  .map((m) => (
                    <option key={m.modelCode} value={m.modelCode}>{m.displayName}</option>
                  ))}
              </select>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-[#C9716A]">{error}</p>}

        <button type="submit"
          disabled={loading || !prompt.trim() || !credentialId || !modelCode}
          className="w-full rounded-xl bg-gold text-black font-semibold py-2.5 text-sm disabled:opacity-50">
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">⏳</span> กำลังสร้างภาพ... (อาจใช้เวลา 10-30 วินาที)
            </span>
          ) : '🖼️ สร้างภาพ'}
        </button>
      </form>

      {/* Result */}
      {result && (
        <div className="mt-10 border-t border-[#2C2A35] pt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-xl">ผลลัพธ์ 🖼️</h2>
            <span className="text-xs text-[#9C9690] font-mono">~5 เครดิต</span>
          </div>

          {/* Image display */}
          <div className="rounded-2xl overflow-hidden border border-[#2C2A35] bg-[#1C1B23]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={result.dataUrl} alt="AI Generated" className="w-full max-h-[600px] object-contain" />
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-4">
            <button onClick={handleDownload}
              className="text-sm font-semibold text-gold border border-gold/40 rounded-xl px-4 py-2 hover:bg-gold/10">
              ↓ ดาวน์โหลดภาพ
            </button>
            <Link href={`/assets/${result.assetId}`}
              className="text-sm font-semibold text-[#9C9690] border border-[#2C2A35] rounded-xl px-4 py-2 hover:border-[#9C9690]">
              ดู Generation Recipe →
            </Link>
          </div>

          {/* Generate another */}
          <button onClick={() => setResult(null)}
            className="mt-4 text-xs text-[#9C9690] underline">
            สร้างภาพใหม่อีกครั้ง
          </button>
        </div>
      )}
    </div>
  );
}
