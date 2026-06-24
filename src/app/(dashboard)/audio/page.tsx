'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useToast } from '@/components/Toast';
import { useFormPersist, formatSavedAt } from '@/lib/useFormPersist';
import {
  OPENAI_VOICES, GEMINI_TTS_VOICES, ELEVENLABS_VOICES
} from '@/lib/ai/tts';

interface Credential { id: string; displayName: string; providerCode: string; }
interface Provider { code: string; models: { modelCode: string; displayName: string; capability: string }[]; }

const SPEED_OPTIONS = [
  { value: '0.75', label: '0.75× ช้า' },
  { value: '1.0',  label: '1.0× ปกติ' },
  { value: '1.25', label: '1.25× เร็วขึ้น' },
  { value: '1.5',  label: '1.5× เร็ว' },
];

const TEXT_EXAMPLES = [
  'สวัสดีครับ ยินดีต้อนรับสู่ Aura-D Studio แพลตฟอร์มสร้างคอนเทนต์ด้วย AI',
  'ผลิตภัณฑ์ครีมบำรุงผิวของเรา ช่วยให้ผิวชุ่มชื้น เนียนนุ่ม และกระจ่างใสใน 7 วัน',
  'สั่งซื้อวันนี้ รับส่วนลดพิเศษ 30 เปอร์เซ็นต์ จำกัดเฉพาะ 100 ออเดอร์แรกเท่านั้น',
];

function voicesForProvider(providerCode: string) {
  switch (providerCode) {
    case 'openai':      return OPENAI_VOICES;
    case 'google':      return GEMINI_TTS_VOICES;
    case 'elevenlabs':  return ELEVENLABS_VOICES;
    default:            return [];
  }
}

export default function AudioPage() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const { success: toastSuccess, error: toastError } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    dataUrl: string; assetId: string; durationEstimate: string; mimeType: string;
  } | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const { values: form, setField, clearForm, savedAt } = useFormPersist('audio', {
    text: '', credentialId: '', modelCode: '', voice: '', speed: '1.0'
  });
  const { text, credentialId, modelCode, voice, speed } = form;

  const searchParams = useSearchParams();

  useEffect(() => {
    // Pre-fill text from URL (?text=...)
    const textParam = searchParams.get('text');
    if (textParam) setField('text', textParam);

    Promise.all([
      fetch('/api/credentials').then((r) => r.json()),
      fetch('/api/ai-providers?capability=audio').then((r) => r.json()),
    ]).then(([cred, prov]) => {
      setCredentials(cred.credentials ?? []);
      setProviders(prov.providers ?? []);
    });
  }, []);

  const selectedCredential = credentials.find((c) => c.id === credentialId);
  const selectedProvider = providers.find((p) => p.code === selectedCredential?.providerCode);
  const voices = selectedCredential ? voicesForProvider(selectedCredential.providerCode) : [];

  // When credential changes — auto-select first voice
  function handleCredentialChange(id: string) {
    setField('credentialId', id);
    setField('modelCode', '');
    setField('voice', '');
  }

  // When model changes — reset voice
  function handleModelChange(code: string) {
    setField('modelCode', code);
    setField('voice', '');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setError(null);
    setResult(null);
    setLoading(true);

    const res = await fetch('/api/workflows/generate-audio/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text, credentialId, modelCode,
        voice: voice || undefined,
        speed: parseFloat(speed)
      })
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? 'สร้างเสียงไม่สำเร็จ');
      return;
    }
    clearForm();
    toastSuccess('✓ สร้างเสียงสำเร็จ บันทึกในคลังไฟล์แล้ว');
    setResult(data);
  }

  function handleDownload() {
    if (!result) return;
    const ext = result.mimeType.includes('wav') ? 'wav' : 'mp3';
    const a = document.createElement('a');
    a.href = result.dataUrl;
    a.download = `aura-audio-${Date.now()}.${ext}`;
    a.click();
  }

  // Filter credentials to audio-capable providers
  const audioCredentials = credentials.filter((c) =>
    providers.some((p) => p.code === c.providerCode)
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="font-serif text-2xl">สร้างเสียงพากย์ AI</h1>
          <p className="text-sm text-[#9C9690] mt-1">แปลงข้อความเป็นเสียงด้วย OpenAI TTS, Gemini TTS และ ElevenLabs</p>
        </div>
        <div className="flex items-center gap-2">
          {savedAt && <span className="text-[10px] text-[#9C9690]">💾 {formatSavedAt(savedAt)}</span>}
          {text && (
            <button onClick={() => { clearForm(); setResult(null); }}
              className="text-xs text-[#9C9690] border border-[#2C2A35] rounded-lg px-2.5 py-1 hover:border-[#C9716A] hover:text-[#C9716A]">
              ล้างข้อมูล
            </button>
          )}
        </div>
      </div>

      {audioCredentials.length === 0 && (
        <div className="mt-4 p-4 rounded-2xl border border-[#2C2A35] text-sm text-[#9C9690]">
          ยังไม่มี API Key ที่รองรับการสร้างเสียง — ต้องใช้{' '}
          <strong className="text-bone">Google Gemini</strong>,{' '}
          <strong className="text-bone">OpenAI GPT</strong> หรือ{' '}
          <strong className="text-bone">ElevenLabs</strong>{' '}
          <Link href="/settings/connected-ai" className="text-gold font-semibold ml-1">ไปที่ Connected AI →</Link>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4 max-w-xl">

        {/* Text input */}
        <div>
          <label className="block text-xs text-[#9C9690] mb-1.5">
            ข้อความที่ต้องการแปลงเป็นเสียง
            <span className="ml-2 text-[10px] opacity-60">({text.length}/5000 ตัวอักษร)</span>
          </label>
          <textarea required value={text}
            onChange={(e) => setField('text', e.target.value)}
            placeholder="เช่น สวัสดีครับ ยินดีต้อนรับสู่ Aura-D Studio..."
            className="w-full rounded-xl px-3.5 py-2.5 text-sm min-h-[140px] resize-none" />

          {/* Quick examples */}
          <div className="mt-2 space-y-1.5">
            <p className="text-[10px] text-[#9C9690]">ตัวอย่างข้อความ:</p>
            {TEXT_EXAMPLES.map((ex) => (
              <button key={ex} type="button"
                onClick={() => setField('text', ex)}
                className="block w-full text-left text-[11px] text-[#9C9690] border border-[#2C2A35] rounded-lg px-3 py-2 hover:border-[#9C9690] hover:text-bone">
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* AI + Model */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[#9C9690] mb-1.5">AI ที่ใช้</label>
            <select required value={credentialId}
              onChange={(e) => handleCredentialChange(e.target.value)}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm">
              <option value="">เลือก AI</option>
              {audioCredentials.map((c) => (
                <option key={c.id} value={c.id}>{c.displayName}</option>
              ))}
            </select>
          </div>
          {selectedProvider && (
            <div>
              <label className="block text-xs text-[#9C9690] mb-1.5">โมเดล</label>
              <select required value={modelCode}
                onChange={(e) => handleModelChange(e.target.value)}
                className="w-full rounded-xl px-3.5 py-2.5 text-sm">
                <option value="">เลือกโมเดล</option>
                {selectedProvider.models
                  .filter((m) => m.capability === 'audio')
                  .map((m) => (
                    <option key={m.modelCode} value={m.modelCode}>{m.displayName}</option>
                  ))}
              </select>
            </div>
          )}
        </div>

        {/* Voice + Speed */}
        {voices.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#9C9690] mb-1.5">เสียง (Voice)</label>
              <select value={voice} onChange={(e) => setField('voice', e.target.value)}
                className="w-full rounded-xl px-3.5 py-2.5 text-sm">
                <option value="">เลือกเสียง (default)</option>
                {voices.map((v) => (
                  <option key={v.code} value={v.code}>{v.label}</option>
                ))}
              </select>
            </div>
            {selectedCredential?.providerCode === 'openai' && (
              <div>
                <label className="block text-xs text-[#9C9690] mb-1.5">ความเร็ว</label>
                <select value={speed} onChange={(e) => setField('speed', e.target.value)}
                  className="w-full rounded-xl px-3.5 py-2.5 text-sm">
                  {SPEED_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {error && <p className="text-sm text-[#C9716A]">{error}</p>}

        <button type="submit"
          disabled={loading || !text.trim() || !credentialId || !modelCode}
          className="w-full rounded-xl bg-gold text-black font-semibold py-2.5 text-sm disabled:opacity-50">
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">⏳</span> กำลังสร้างเสียงพากย์...
            </span>
          ) : '🔊 สร้างเสียงพากย์'}
        </button>
      </form>

      {/* Result */}
      {result && (
        <div className="mt-10 border-t border-[#2C2A35] pt-8 max-w-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-xl">🔊 ผลลัพธ์</h2>
            <span className="text-xs text-[#9C9690]">{result.durationEstimate}</span>
          </div>

          {/* Audio player */}
          <div className="rounded-2xl bg-[#1C1B23] border border-[#2C2A35] p-5">
            <audio
              ref={audioRef}
              src={result.dataUrl}
              controls
              className="w-full"
              style={{ accentColor: '#E4DECE' }}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-4">
            <button onClick={handleDownload}
              className="text-sm font-semibold text-gold border border-gold/40 rounded-xl px-4 py-2 hover:bg-gold/10">
              ↓ ดาวน์โหลด MP3
            </button>
            <Link href={`/assets/${result.assetId}`}
              className="text-sm font-semibold text-[#9C9690] border border-[#2C2A35] rounded-xl px-4 py-2 hover:border-[#9C9690]">
              ดู Generation Recipe →
            </Link>
          </div>

          <button onClick={() => setResult(null)}
            className="mt-4 text-xs text-[#9C9690] underline">
            สร้างเสียงใหม่อีกครั้ง
          </button>
        </div>
      )}
    </div>
  );
}
