'use client';

import { useEffect, useState } from 'react';

interface Provider {
  code: string;
  displayName: string;
  capabilities: string[];
  models: { modelCode: string; displayName: string }[];
}

interface CredentialRow {
  id: string;
  providerCode: string;
  displayName: string;
  isFreeTier: boolean;
  status: string;
  lastVerifiedAt: string | null;
  provider: { displayName: string };
}

export default function ConnectedAiPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [credentials, setCredentials] = useState<CredentialRow[]>([]);
  const [form, setForm] = useState({ providerCode: '', displayName: '', apiKey: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  async function loadAll() {
    const [providersRes, credentialsRes] = await Promise.all([fetch('/api/ai-providers'), fetch('/api/credentials')]);
    const providersData = await providersRes.json();
    const credentialsData = await credentialsRes.json();
    setProviders(providersData.providers ?? []);
    setCredentials(credentialsData.credentials ?? []);
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await fetch('/api/credentials', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form)
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'เพิ่ม API Key ไม่สำเร็จ');
      return;
    }
    setForm({ providerCode: '', displayName: '', apiKey: '' });
    await loadAll();
  }

  async function handleTest(credentialId: string) {
    setTestingId(credentialId);
    const res = await fetch('/api/credentials/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ credentialId })
    });
    const data = await res.json();
    setTestingId(null);
    alert(data.ok ? 'Key ใช้งานได้ปกติ' : `ทดสอบไม่ผ่าน: ${data.reason}`);
    await loadAll();
  }

  return (
    <div>
      <h1 className="font-serif text-2xl mb-1">Connected AI</h1>
      <p className="text-sm text-[#9C9690] mb-8">
        เพิ่ม API Key ของผู้ให้บริการ AI ที่คุณมีสิทธิ์ใช้งานเอง — Aura-D Studio ไม่ขายเครดิต AI (spec §1.6)
      </p>

      <div className="space-y-3 mb-10">
        {credentials.length === 0 && <p className="text-sm text-[#9C9690]">ยังไม่ได้เชื่อมต่อ AI ตัวไหนเลย</p>}
        {credentials.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-2xl border border-[#2C2A35] px-4 py-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{c.displayName}</span>
                {c.isFreeTier && (
                  <span className="text-[10px] font-bold text-gold bg-gold/10 px-2 py-0.5 rounded-full">
                    Free Tier
                  </span>
                )}
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    c.status === 'active' ? 'text-sage bg-sage/10' : 'text-red bg-red/10'
                  }`}
                >
                  {c.status}
                </span>
              </div>
              <p className="text-xs text-[#9C9690] mt-1">
                {c.provider.displayName} ·{' '}
                {c.lastVerifiedAt ? `ทดสอบล่าสุด ${new Date(c.lastVerifiedAt).toLocaleString('th-TH')}` : 'ยังไม่ทดสอบ'}
              </p>
            </div>
            <button
              onClick={() => handleTest(c.id)}
              disabled={testingId === c.id}
              className="text-xs font-semibold text-gold border border-gold/40 rounded-lg px-3 py-1.5 disabled:opacity-50"
            >
              {testingId === c.id ? 'กำลังทดสอบ...' : 'ทดสอบ'}
            </button>
          </div>
        ))}
      </div>

      <h2 className="text-sm font-semibold mb-3">เชื่อมต่อ AI Provider ใหม่</h2>
      <form onSubmit={handleAdd} className="space-y-3 max-w-md">
        <select
          required
          value={form.providerCode}
          onChange={(e) => setForm({ ...form, providerCode: e.target.value })}
          className="w-full rounded-xl px-3.5 py-2.5 text-sm"
        >
          <option value="">เลือก AI Provider</option>
          {providers.map((p) => (
            <option key={p.code} value={p.code}>
              {p.displayName}
            </option>
          ))}
        </select>
        <input
          required
          placeholder="ตั้งชื่อ เช่น Claude บัญชีบริษัท"
          value={form.displayName}
          onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          className="w-full rounded-xl px-3.5 py-2.5 text-sm"
        />
        <input
          required
          type="password"
          placeholder="วาง API Key ที่นี่"
          value={form.apiKey}
          onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
          className="w-full rounded-xl px-3.5 py-2.5 text-sm font-mono"
        />
        {error && <p className="text-sm text-[#C9716A]">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-gold text-black font-semibold px-4 py-2.5 text-sm disabled:opacity-50"
        >
          {submitting ? 'กำลังทดสอบและบันทึก...' : 'เพิ่ม API Key'}
        </button>
      </form>
    </div>
  );
}
