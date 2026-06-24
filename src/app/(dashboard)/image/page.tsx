'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/Toast';
import { useFormPersist, formatSavedAt } from '@/lib/useFormPersist';

interface Credential { id: string; displayName: string; providerCode: string; }
interface Provider { code: string; models: { modelCode: string; displayName: string; capability: string }[]; }

const ASPECT_RATIOS = [
  { code: '1:1',  label: '1:1',  w: 40, h: 40, tip: 'Square — โซเชียล ทั่วไป' },
  { code: '4:5',  label: '4:5',  w: 32, h: 40, tip: 'Portrait — Instagram Post' },
  { code: '9:16', label: '9:16', w: 23, h: 40, tip: 'Vertical — TikTok / Reels / Stories' },
  { code: '16:9', label: '16:9', w: 40, h: 23, tip: 'Landscape — YouTube / Banner' },
  { code: '4:3',  label: '4:3',  w: 40, h: 30, tip: 'Standard — Presentation' },
  { code: '3:4',  label: '3:4',  w: 30, h: 40, tip: 'Portrait — Print / Pinterest' },
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
  const { success: toastSuccess, error: toastError } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ dataUrl: string; assetId: string; mimeType: string } | null>(null);

  const { values: form, setField, clearForm, savedAt } = useFormPersist('image', {
    prompt: '', negativePrompt: '', style: '', aspectRatio: '1:1', credentialId: '', modelCode: ''
  });
  const { prompt, negativePrompt, style, aspectRatio, credentialId, modelCode } = form;

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
      body: JSON.stringify({ prompt, negativePrompt, style, aspectRatio, credentialId, modelCode })
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      const msg = data.error ?? 'สร้างภาพไม่สำเร็จ';
      // Friendly message for 503 / overload errors
      if (msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('high demand')) {
        setError(
          '⏳ Nano Banana Pro มีผู้ใช้งานเยอะมากในขณะนี้ — ลองใหม่อีกครั้ง หรือเปลี่ยนไปใช้ Nano Banana (เร็วกว่า ไม่ติด queue)'
        );
      } else {
        setError(msg);
      }
      return;
    }
    clearForm();
    toastSuccess('✓ สร้างภาพสำเร็จ บันทึกในคลังไฟล์แล้ว');
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

        {/* Aspect Ratio — visual buttons */}
        <div>
          <label className="block text-xs text-[#9C9690] mb-2">อัตราส่วนภาพ</label>
          <div className="flex items-end gap-3 flex-wrap">
            {ASPECT_RATIOS.map((ar) => (
              <button key={ar.code} type="button"
                onClick={() => setField('aspectRatio', ar.code)}
                title={ar.tip}
                className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl border transition-colors ${
                  aspectRatio === ar.code
                    ? 'border-gold bg-gold/10'
                    : 'border-[#2C2A35] hover:border-[#9C9690]'
                }`}>
                {/* Visual shape representing the ratio */}
                <div
                  className={`rounded border-2 ${aspectRatio === ar.code ? 'border-gold bg-gold/20' : 'border-[#9C9690]'}`}
                  style={{ width: ar.w, height: ar.h }}
                />
                <span className={`text-[10px] font-mono font-bold ${aspectRatio === ar.code ? 'text-gold' : 'text-[#9C9690]'}`}>
                  {ar.label}
                </span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-[#9C9690] mt-1.5">
            {ASPECT_RATIOS.find((r) => r.code === aspectRatio)?.tip ?? ''}
          </p>
        </div>

        {/* Style dropdown */}
        <div>
          <label className="block text-xs text-[#9C9690] mb-1.5">สไตล์ภาพ</label>
          <select value={style} onChange={(e) => setField('style', e.target.value)}
            className="w-full rounded-xl px-3.5 py-2.5 text-sm">
            <option value="">ไม่ระบุ (AI เลือกเอง)</option>
            <option value="photorealistic">📷 Photorealistic</option>
            <option value="anime">🎌 Anime / Illustration</option>
            <option value="watercolor">🎨 Watercolor</option>
            <option value="oil painting">🖼️ Oil Painting</option>
            <option value="3D render">💎 3D Render</option>
            <option value="flat design">📐 Flat Design / Vector</option>
            <option value="cinematic">🎬 Cinematic</option>
            <option value="minimalist">◻️ Minimalist</option>
          </select>
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
              <span className="animate-spin">⏳</span>
              {modelCode?.includes('pro') || modelCode?.includes('3-pro')
                ? 'กำลังสร้างภาพ Pro... (อาจใช้เวลา 30-60 วินาที หากคิวยาวจะ retry อัตโนมัติ)'
                : 'กำลังสร้างภาพ... (อาจใช้เวลา 10-30 วินาที)'}
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
