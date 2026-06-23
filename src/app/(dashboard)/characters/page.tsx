'use client';

import { useEffect, useState } from 'react';

interface Character {
  id: string;
  name: string;
  description?: string;
  personality: string;
  tone: string;
  backstory?: string;
  examples?: string;
  avatarEmoji: string;
  createdAt: string;
}

interface Credential {
  id: string;
  displayName: string;
  providerCode: string;
}

const EMOJI_OPTIONS = ['🤖', '👩', '👨', '🦸', '🧙', '🎭', '🌟', '💫', '🔥', '🌸', '🐯', '🦋'];

const EMPTY_FORM = {
  name: '', description: '', personality: '',
  tone: '', backstory: '', examples: '', avatarEmoji: '🤖'
};

export default function CharactersPage() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genCredentialId, setGenCredentialId] = useState('');
  const [genModelCode, setGenModelCode] = useState('');
  const [providers, setProviders] = useState<{ code: string; models: { modelCode: string; displayName: string }[] }[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function loadAll() {
    const [charRes, credRes, provRes] = await Promise.all([
      fetch('/api/characters'),
      fetch('/api/credentials'),
      fetch('/api/ai-providers?capability=text')
    ]);
    const charData = await charRes.json();
    const credData = await credRes.json();
    const provData = await provRes.json();
    setCharacters(charData.characters ?? []);
    setCredentials(credData.credentials ?? []);
    setProviders(provData.providers ?? []);
  }

  useEffect(() => { loadAll(); }, []);

  const selectedCredential = credentials.find((c) => c.id === genCredentialId);
  const selectedProvider = providers.find((p) => p.code === selectedCredential?.providerCode);

  async function handleGenerateWithAI() {
    if (!genCredentialId || !genModelCode || !form.name) return;
    setGenerating(true);

    const prompt = `สร้างตัวละครแบรนด์สำหรับ "${form.name}"${form.description ? ` ซึ่ง${form.description}` : ''} ตอบในรูปแบบนี้:
บุคลิก: [อธิบาย 2-3 ประโยค]
น้ำเสียง: [อธิบาย 1-2 ประโยค]
ประวัติ: [อธิบาย 2-3 ประโยค]
ตัวอย่างประโยค: [3 ประโยคตัวอย่างที่ตัวละครนี้จะพูด]`;

    try {
      const res = await fetch('/api/workflows/generate-text', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ credentialId: genCredentialId, modelCode: genModelCode, prompt })
      });
      const data = await res.json();
      if (data.text) {
        // Parse the AI response into form fields
        const lines = data.text.split('\n').filter(Boolean);
        const get = (prefix: string) => {
          const line = lines.find((l: string) => l.startsWith(prefix));
          return line ? line.replace(prefix, '').trim() : '';
        };
        setForm((f) => ({
          ...f,
          personality: get('บุคลิก:') || f.personality,
          tone: get('น้ำเสียง:') || f.tone,
          backstory: get('ประวัติ:') || f.backstory,
          examples: get('ตัวอย่างประโยค:') || f.examples
        }));
      }
    } catch {
      alert('สร้างด้วย AI ไม่สำเร็จ ลองใหม่อีกครั้ง');
    }
    setGenerating(false);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);

    const method = editingId ? 'PATCH' : 'POST';
    const url = editingId ? `/api/characters/${editingId}` : '/api/characters';

    const res = await fetch(url, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form)
    });
    setSaving(false);
    if (res.ok) {
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      await loadAll();
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('ลบตัวละครนี้ออกจากระบบ?')) return;
    setDeleting(id);
    await fetch(`/api/characters/${id}`, { method: 'DELETE' });
    setDeleting(null);
    await loadAll();
  }

  function handleEdit(c: Character) {
    setForm({
      name: c.name, description: c.description ?? '',
      personality: c.personality, tone: c.tone,
      backstory: c.backstory ?? '', examples: c.examples ?? '',
      avatarEmoji: c.avatarEmoji
    });
    setEditingId(c.id);
    setShowForm(true);
    setExpanded(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="font-serif text-2xl">Character Engine</h1>
          <p className="text-sm text-[#9C9690] mt-1">สร้างตัวละคร/Brand Voice สำหรับสร้างคอนเทนต์ที่มีเอกลักษณ์</p>
        </div>
        {!showForm && (
          <button
            onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_FORM); }}
            className="text-sm font-semibold bg-gold text-black rounded-xl px-4 py-2"
          >
            + สร้างตัวละคร
          </button>
        )}
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div className="mt-6 rounded-2xl border border-gold/30 bg-gold/5 p-5 space-y-4">
          <h2 className="font-serif text-lg">{editingId ? 'แก้ไขตัวละคร' : 'สร้างตัวละครใหม่'}</h2>

          {/* Emoji picker */}
          <div>
            <label className="block text-xs text-[#9C9690] mb-2">Avatar</label>
            <div className="flex gap-2 flex-wrap">
              {EMOJI_OPTIONS.map((e) => (
                <button
                  key={e}
                  onClick={() => setForm({ ...form, avatarEmoji: e })}
                  className={`text-2xl w-10 h-10 rounded-xl border ${form.avatarEmoji === e ? 'border-gold bg-gold/20' : 'border-[#2C2A35]'}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#9C9690] mb-1.5">ชื่อตัวละคร *</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="เช่น น้องออร่า" className="w-full rounded-xl px-3.5 py-2.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-[#9C9690] mb-1.5">คำอธิบายสั้นๆ</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="เช่น ผู้ช่วยด้านความงาม" className="w-full rounded-xl px-3.5 py-2.5 text-sm" />
            </div>
          </div>

          {/* AI Generator section */}
          <div className="rounded-xl border border-[#2C2A35] p-3 space-y-2">
            <p className="text-xs text-[#9C9690] font-semibold">✨ สร้างรายละเอียดด้วย AI</p>
            <div className="flex gap-2">
              <select value={genCredentialId} onChange={(e) => { setGenCredentialId(e.target.value); setGenModelCode(''); }}
                className="flex-1 rounded-xl px-3 py-2 text-xs">
                <option value="">เลือก AI</option>
                {credentials.map((c) => <option key={c.id} value={c.id}>{c.displayName}</option>)}
              </select>
              {selectedProvider && (
                <select value={genModelCode} onChange={(e) => setGenModelCode(e.target.value)}
                  className="flex-1 rounded-xl px-3 py-2 text-xs">
                  <option value="">เลือกโมเดล</option>
                  {selectedProvider.models.map((m) => <option key={m.modelCode} value={m.modelCode}>{m.displayName}</option>)}
                </select>
              )}
              <button
                onClick={handleGenerateWithAI}
                disabled={generating || !genCredentialId || !genModelCode || !form.name}
                className="text-xs font-semibold bg-[#2C2A35] text-bone rounded-xl px-3 py-2 disabled:opacity-50"
              >
                {generating ? 'กำลังสร้าง...' : 'สร้าง'}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs text-[#9C9690] mb-1.5">บุคลิกนิสัย</label>
            <textarea value={form.personality} onChange={(e) => setForm({ ...form, personality: e.target.value })}
              placeholder="เช่น เป็นมิตร อบอุ่น ให้คำแนะนำอย่างตรงไปตรงมา..."
              className="w-full rounded-xl px-3.5 py-2.5 text-sm min-h-[80px] resize-none" />
          </div>
          <div>
            <label className="block text-xs text-[#9C9690] mb-1.5">น้ำเสียงการสื่อสาร</label>
            <input value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })}
              placeholder="เช่น พูดภาษาไทยกึ่งทางการ ใช้ภาษาเข้าใจง่าย ไม่เป็นทางการเกินไป"
              className="w-full rounded-xl px-3.5 py-2.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-[#9C9690] mb-1.5">ประวัติ / Backstory</label>
            <textarea value={form.backstory} onChange={(e) => setForm({ ...form, backstory: e.target.value })}
              placeholder="เช่น น้องออร่าเป็นผู้ช่วยด้านความงามที่มีประสบการณ์..."
              className="w-full rounded-xl px-3.5 py-2.5 text-sm min-h-[80px] resize-none" />
          </div>
          <div>
            <label className="block text-xs text-[#9C9690] mb-1.5">ตัวอย่างประโยค</label>
            <textarea value={form.examples} onChange={(e) => setForm({ ...form, examples: e.target.value })}
              placeholder="เช่น &#10;สวัสดีค่ะ วันนี้จะมาแนะนำผลิตภัณฑ์ที่ดีสำหรับผิวคุณนะคะ"
              className="w-full rounded-xl px-3.5 py-2.5 text-sm min-h-[80px] resize-none" />
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={handleSave} disabled={saving || !form.name}
              className="rounded-xl bg-gold text-black font-semibold px-4 py-2.5 text-sm disabled:opacity-50">
              {saving ? 'กำลังบันทึก...' : editingId ? 'บันทึกการแก้ไข' : 'สร้างตัวละคร'}
            </button>
            <button onClick={() => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); }}
              className="rounded-xl border border-[#2C2A35] text-[#9C9690] px-4 py-2.5 text-sm">
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      {/* Character list */}
      <div className="mt-8 space-y-3">
        {characters.length === 0 && !showForm && (
          <p className="text-sm text-[#9C9690]">ยังไม่มีตัวละคร — กด "สร้างตัวละคร" เพื่อเริ่มต้น</p>
        )}

        {characters.map((c) => (
          <div key={c.id} className="rounded-2xl border border-[#2C2A35] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[#1C1B23]"
              onClick={() => setExpanded(expanded === c.id ? null : c.id)}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{c.avatarEmoji}</span>
                <div>
                  <p className="text-sm font-semibold">{c.name}</p>
                  {c.description && <p className="text-xs text-[#9C9690]">{c.description}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-3">
                <button onClick={(e) => { e.stopPropagation(); handleEdit(c); }}
                  className="text-xs text-[#9C9690] border border-[#2C2A35] rounded-lg px-3 py-1.5 hover:border-[#9C9690]">
                  แก้ไข
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                  disabled={deleting === c.id}
                  className="text-xs text-[#C9716A] border border-[#C9716A]/40 rounded-lg px-3 py-1.5 disabled:opacity-50">
                  {deleting === c.id ? '...' : 'ลบ'}
                </button>
                <span className="text-[#9C9690] text-xs">{expanded === c.id ? '▲' : '▼'}</span>
              </div>
            </div>

            {expanded === c.id && (
              <div className="px-4 pb-4 border-t border-[#2C2A35] space-y-3 pt-3">
                {c.personality && (
                  <div>
                    <p className="text-[10px] text-[#9C9690] uppercase tracking-wider mb-1">บุคลิก</p>
                    <p className="text-sm leading-relaxed">{c.personality}</p>
                  </div>
                )}
                {c.tone && (
                  <div>
                    <p className="text-[10px] text-[#9C9690] uppercase tracking-wider mb-1">น้ำเสียง</p>
                    <p className="text-sm leading-relaxed">{c.tone}</p>
                  </div>
                )}
                {c.backstory && (
                  <div>
                    <p className="text-[10px] text-[#9C9690] uppercase tracking-wider mb-1">ประวัติ</p>
                    <p className="text-sm leading-relaxed">{c.backstory}</p>
                  </div>
                )}
                {c.examples && (
                  <div>
                    <p className="text-[10px] text-[#9C9690] uppercase tracking-wider mb-1">ตัวอย่างประโยค</p>
                    <p className="text-sm leading-relaxed text-[#9C9690] italic">{c.examples}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
