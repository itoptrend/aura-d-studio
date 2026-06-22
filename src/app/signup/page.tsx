'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ displayName: '', teamName: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form)
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'สมัครใช้งานไม่สำเร็จ');
      setLoading(false);
      return;
    }

    const signinRes = await signIn('credentials', {
      email: form.email,
      password: form.password,
      redirect: false
    });
    setLoading(false);
    if (signinRes?.error) {
      setError('สมัครสำเร็จแล้ว แต่เข้าสู่ระบบอัตโนมัติไม่สำเร็จ ลองเข้าสู่ระบบเอง');
      return;
    }
    router.push('/seo');
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="font-serif text-3xl mb-1">Aura-D Studio</h1>
        <p className="text-sm text-[#9C9690] mb-8">สร้างบัญชีใหม่</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-[#9C9690] mb-1.5">ชื่อของคุณ</label>
            <input
              required
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-[#9C9690] mb-1.5">ชื่อทีม/แบรนด์</label>
            <input
              required
              value={form.teamName}
              onChange={(e) => setForm({ ...form, teamName: e.target.value })}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm"
              placeholder="เช่น ร้านของฉัน"
            />
          </div>
          <div>
            <label className="block text-xs text-[#9C9690] mb-1.5">อีเมล</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-[#9C9690] mb-1.5">รหัสผ่าน (อย่างน้อย 8 ตัวอักษร)</label>
            <input
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm"
            />
          </div>

          {error && <p className="text-sm text-[#C9716A]">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gold text-black font-semibold py-2.5 text-sm disabled:opacity-50"
          >
            {loading ? 'กำลังสมัคร...' : 'สมัครใช้งาน'}
          </button>
        </form>

        <p className="text-sm text-[#9C9690] mt-6">
          มีบัญชีอยู่แล้ว?{' '}
          <Link href="/login" className="text-gold">
            เข้าสู่ระบบ
          </Link>
        </p>
      </div>
    </div>
  );
}
