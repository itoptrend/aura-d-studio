'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useFormPersist, formatSavedAt } from '@/lib/useFormPersist';

interface Provider {
  code: string;
  displayName: string;
  models: { modelCode: string; displayName: string; capability: string }[];
}

interface CredentialOption {
  id: string;
  providerCode: string;
  displayName: string;
}

interface Skill {
  id: string;
  name: string;
  promptTemplate: string;
}

export default function SeoArticlePage() {
  const searchParams = useSearchParams();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [credentials, setCredentials] = useState<CredentialOption[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ text: string; costCredit: number; assetId: string } | null>(null);

  // Persist form data across navigation — บันทึกลง localStorage อัตโนมัติทุกครั้งที่พิมพ์
  const { values: form, setField, clearForm, saveForm, savedAt } = useFormPersist('seo', {
    topic: '', keyword: '', credentialId: '', modelCode: ''
  });
  const { topic, keyword, credentialId, modelCode } = form;

  useEffect(() => {
    async function load() {
      const [providersRes, credentialsRes] = await Promise.all([
        fetch('/api/ai-providers?capability=text'),
        fetch('/api/credentials')
      ]);
      const providersData = await providersRes.json();
      const credentialsData = await credentialsRes.json();
      setProviders(providersData.providers ?? []);
      setCredentials(credentialsData.credentials ?? []);
    }
    load();

    // Load skill from URL param if provided (from Skill Library "ใช้ Skill นี้" button)
    const skillId = searchParams.get('skillId');
    if (skillId) {
      fetch(`/api/skills?category=`).then((r) => r.json()).then((data) => {
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
      body: JSON.stringify({ topic, keyword, credentialId, modelCode, skillId: selectedSkill?.id })
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? 'สร้างบทความไม่สำเร็จ');
      return;
    }
    setResult(data); // ไม่ล้าง form อัตโนมัติ — ผู้ใช้กด "ล้างข้อมูล" เองเมื่อต้องการ
  }

  if (credentials.length === 0) {
    return (
      <div>
        <h1 className="font-serif text-2xl mb-3">เขียนบทความ SEO</h1>
        <p className="text-sm text-[#9C9690] mb-4">ยังไม่ได้เชื่อมต่อ AI Provider ไหนเลย ต้องเพิ่ม API Key ก่อนเริ่มสร้างคอนเทนต์</p>
        <Link href="/settings/connected-ai" className="text-sm font-semibold text-gold">
          ไปที่หน้า Connected AI →
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-serif text-2xl">เขียนบทความ SEO</h1>
        <div className="flex items-center gap-2">
          {savedAt && (
            <span className="text-[10px] text-[#9C9690]">
              💾 บันทึกอัตโนมัติ {formatSavedAt(savedAt)}
            </span>
          )}
          {(topic || keyword) && (
            <button onClick={() => { clearForm(); setSelectedSkill(null); setResult(null); }}
              className="text-xs text-[#9C9690] border border-[#2C2A35] rounded-lg px-2.5 py-1 hover:border-[#C9716A] hover:text-[#C9716A]">
              ล้างข้อมูล
            </button>
          )}
        </div>
      </div>
      <p className="text-sm text-[#9C9690] mb-8">Wizard Mode — กรอกหัวข้อ เลือก AI แล้วกดสร้างได้เลย</p>

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

      <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
        <div>
          <label className="block text-xs text-[#9C9690] mb-1.5">หัวข้อบทความ</label>
          <input
            required
            value={topic}
            onChange={(e) => setField('topic', e.target.value)}
            placeholder="เช่น วิธีเลือกเซรั่มบำรุงผิวหน้าสำหรับผิวมัน"
            className="w-full rounded-xl px-3.5 py-2.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-[#9C9690] mb-1.5">คีย์เวิร์ดหลัก</label>
          <input
            required
            value={keyword}
            onChange={(e) => setField('keyword', e.target.value)}
            placeholder="เช่น เซรั่มผิวมัน"
            className="w-full rounded-xl px-3.5 py-2.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-[#9C9690] mb-1.5">AI ที่ใช้</label>
          <select
            required
            value={credentialId}
            onChange={(e) => { setField('credentialId', e.target.value); setField('modelCode', ''); }}
            className="w-full rounded-xl px-3.5 py-2.5 text-sm"
          >
            <option value="">เลือก AI ที่เชื่อมต่อไว้</option>
            {credentials.map((c) => (
              <option key={c.id} value={c.id}>{c.displayName}</option>
            ))}
          </select>
        </div>
        {selectedProvider && (
          <div>
            <label className="block text-xs text-[#9C9690] mb-1.5">โมเดล</label>
            <select
              required
              value={modelCode}
              onChange={(e) => setField('modelCode', e.target.value)}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm"
            >
              <option value="">เลือกโมเดล</option>
              {selectedProvider.models.map((m) => (
                <option key={m.modelCode} value={m.modelCode}>{m.displayName}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-3">
          {!selectedSkill && (
            <Link href="/skills" className="text-xs text-[#9C9690] hover:text-gold border border-[#2C2A35] rounded-xl px-3 py-2">
              เลือก Skill →
            </Link>
          )}
        </div>

        {error && <p className="text-sm text-[#C9716A]">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-gold text-black font-semibold px-5 py-2.5 text-sm disabled:opacity-50"
          >
            {loading ? 'กำลังสร้างบทความ...' : 'สร้างบทความ'}
          </button>
          <button
            type="button"
            onClick={saveForm}
            className="rounded-xl border border-[#2C2A35] text-[#9C9690] hover:border-[#9C9690] px-4 py-2.5 text-sm"
          >
            💾 บันทึก
          </button>
          {savedAt && (
            <span className="text-xs text-[#9C9690]">
              บันทึกแล้ว {new Date(savedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
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
          <div className="flex gap-3 mt-4">
            <Link href={`/assets/${result.assetId}`} className="text-sm font-semibold text-gold">
              ดู Generation Recipe →
            </Link>
            <a
              href={`data:text/plain;charset=utf-8,${encodeURIComponent(result.text)}`}
              download={`${topic}.txt`}
              className="text-sm font-semibold text-[#9C9690]"
            >
              ดาวน์โหลด .txt
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
