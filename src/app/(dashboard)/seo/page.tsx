'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Provider {
  code: string;
  displayName: string;
  models: { modelCode: string; displayName: string }[];
}

interface CredentialOption {
  id: string;
  providerCode: string;
  displayName: string;
}

export default function SeoArticlePage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [credentials, setCredentials] = useState<CredentialOption[]>([]);
  const [topic, setTopic] = useState('');
  const [keyword, setKeyword] = useState('');
  const [credentialId, setCredentialId] = useState('');
  const [modelCode, setModelCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ text: string; costCredit: number; assetId: string } | null>(null);

  useEffect(() => {
    async function load() {
      const [providersRes, credentialsRes] = await Promise.all([fetch('/api/ai-providers'), fetch('/api/credentials')]);
      const providersData = await providersRes.json();
      const credentialsData = await credentialsRes.json();
      setProviders(providersData.providers ?? []);
      setCredentials(credentialsData.credentials ?? []);
    }
    load();
  }, []);

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
      body: JSON.stringify({ topic, keyword, credentialId, modelCode })
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? 'สร้างบทความไม่สำเร็จ');
      return;
    }
    setResult(data);
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
      <h1 className="font-serif text-2xl mb-1">เขียนบทความ SEO</h1>
      <p className="text-sm text-[#9C9690] mb-8">Wizard Mode — กรอกหัวข้อ เลือก AI แล้วกดสร้างได้เลย</p>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
        <div>
          <label className="block text-xs text-[#9C9690] mb-1.5">หัวข้อบทความ</label>
          <input
            required
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="เช่น วิธีเลือกเซรั่มบำรุงผิวหน้าสำหรับผิวมัน"
            className="w-full rounded-xl px-3.5 py-2.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-[#9C9690] mb-1.5">คีย์เวิร์ดหลัก</label>
          <input
            required
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="เช่น เซรั่มผิวมัน"
            className="w-full rounded-xl px-3.5 py-2.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-[#9C9690] mb-1.5">AI ที่ใช้</label>
          <select
            required
            value={credentialId}
            onChange={(e) => {
              setCredentialId(e.target.value);
              setModelCode('');
            }}
            className="w-full rounded-xl px-3.5 py-2.5 text-sm"
          >
            <option value="">เลือก AI ที่เชื่อมต่อไว้</option>
            {credentials.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName}
              </option>
            ))}
          </select>
        </div>
        {selectedProvider && (
          <div>
            <label className="block text-xs text-[#9C9690] mb-1.5">โมเดล</label>
            <select
              required
              value={modelCode}
              onChange={(e) => setModelCode(e.target.value)}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm"
            >
              <option value="">เลือกโมเดล</option>
              {selectedProvider.models.map((m) => (
                <option key={m.modelCode} value={m.modelCode}>
                  {m.displayName}
                </option>
              ))}
            </select>
          </div>
        )}

        {error && <p className="text-sm text-[#C9716A]">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-gold text-black font-semibold px-5 py-2.5 text-sm disabled:opacity-50"
        >
          {loading ? 'กำลังสร้างบทความ...' : 'สร้างบทความ'}
        </button>
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
