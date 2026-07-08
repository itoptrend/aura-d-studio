'use client';

import { useEffect, useState } from 'react';

interface Character {
  id: string;
  name: string;
  description?: string;
  role: string;
  personality: string;
  tone: string;
  backstory?: string;
  examples?: string;
  avatarEmoji: string;
  createdAt: string;
  gender?: string;
  ageRange?: string;
  skinTone?: string;
  appearance?: string;
  outfit?: string;
  portraitUrl?: string | null;
}

interface Credential { id: string; displayName: string; providerCode: string; }

const EMOJI_OPTIONS = ['🤖','👩','👨','🦸','🧙','🎭','🌟','💫','🔥','🌸','🐯','🦋'];
const EMPTY_FORM = { name:'', description:'', role:'unset', personality:'', tone:'', backstory:'', examples:'', avatarEmoji:'🤖', gender:'', ageRange:'', skinTone:'', appearance:'', outfit:'' };

const ROLE_LABEL: Record<string,string> = {
  heroine: '👸 นางเอก', hero: '🤴 พระเอก', supporting: '🎭 ตัวรอง',
  extra: '👥 ตัวประกอบ', villain: '😈 ตัวร้าย',
  main: '⭐ ตัวหลัก', unset: ''
};

const ROLE_OPTIONS = [
  { value: 'heroine',    label: '👸 นางเอก' },
  { value: 'hero',       label: '🤴 พระเอก' },
  { value: 'supporting', label: '🎭 ตัวรอง' },
  { value: 'extra',      label: '👥 ตัวประกอบ' },
  { value: 'villain',    label: '😈 ตัวร้าย' },
  { value: 'unset',      label: 'ไม่ระบุ (ทั่วไป)' }
];

export default function CharactersPage() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [providers, setProviders] = useState<{code:string;models:{modelCode:string;displayName:string}[]}[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string|null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genCredentialId, setGenCredentialId] = useState('');
  const [genModelCode, setGenModelCode] = useState('');
  const [expanded, setExpanded] = useState<string|null>(null);
  const [deleting, setDeleting] = useState<string|null>(null);
  const [portraitBusy, setPortraitBusy] = useState<string|null>(null);  // characterId ที่กำลังสร้าง/ลบภาพ
  const [portraitCredId, setPortraitCredId] = useState('');  // Key สำหรับสร้างภาพ (google/xai/openai)

  async function loadAll() {
    const [charRes, credRes, provRes] = await Promise.all([
      fetch('/api/characters'),
      fetch('/api/credentials'),
      fetch('/api/ai-providers?capability=text')
    ]);
    setCharacters((await charRes.json()).characters ?? []);
    setCredentials((await credRes.json()).credentials ?? []);
    setProviders((await provRes.json()).providers ?? []);
  }
  useEffect(() => { loadAll(); }, []);

  const selectedCredential = credentials.find((c) => c.id === genCredentialId);

  // Key ที่ใช้สร้าง "ภาพ" ได้จริง — Google Gemini / xAI / OpenAI เท่านั้น
  const imageCredentials = credentials.filter((c) => ['google', 'xai', 'openai'].includes(c.providerCode));
  useEffect(() => {
    if (!portraitCredId && imageCredentials.length > 0) setPortraitCredId(imageCredentials[0].id);
  }, [credentials]); // eslint-disable-line react-hooks/exhaustive-deps
  const selectedProvider = providers.find((p) => p.code === selectedCredential?.providerCode);

  async function handleGenerateWithAI() {
    if (!genCredentialId || !genModelCode || !form.name) return;
    setGenerating(true);
    try {
      const prompt = `สร้างตัวละครแบรนด์สำหรับ "${form.name}"${form.description ? ` ซึ่ง${form.description}` : ''} ตอบในรูปแบบนี้:
บุคลิก: [อธิบาย 2-3 ประโยค]
น้ำเสียง: [อธิบาย 1-2 ประโยค]
ประวัติ: [อธิบาย 2-3 ประโยค]
ตัวอย่างประโยค: [3 ประโยคที่ตัวละครนี้จะพูด คั่นด้วย / ]`;
      const res = await fetch('/api/workflows/generate-text', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ credentialId: genCredentialId, modelCode: genModelCode, prompt })
      });
      const data = await res.json();
      if (data.text) {
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
    } catch { alert('สร้างด้วย AI ไม่สำเร็จ ลองใหม่'); }
    setGenerating(false);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    const method = editingId ? 'PATCH' : 'POST';
    const url = editingId ? `/api/characters/${editingId}` : '/api/characters';
    const res = await fetch(url, {
      method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(form)
    });
    setSaving(false);
    if (res.ok) { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); await loadAll(); }
  }

  async function handleDelete(id: string) {
    if (!confirm('ลบตัวละครนี้ออกจากระบบ?')) return;
    setDeleting(id);
    await fetch(`/api/characters/${id}`, { method: 'DELETE' });
    setDeleting(null);
    await loadAll();
  }

  function handleEdit(c: Character) {
    setForm({ name:c.name, description:c.description??'', role:c.role,
      personality:c.personality, tone:c.tone, backstory:c.backstory??'',
      examples:c.examples??'', avatarEmoji:c.avatarEmoji,
      gender:c.gender??'', ageRange:c.ageRange??'', skinTone:c.skinTone??'',
      appearance:c.appearance??'', outfit:c.outfit??'' });
    setEditingId(c.id); setShowForm(true); setExpanded(null);
  }

  // Group characters by role for display
  const main = characters.filter((c) => ['heroine','hero','main'].includes(c.role));
  const supporting = characters.filter((c) => ['supporting','extra','villain'].includes(c.role));
  const unset = characters.filter((c) => c.role === 'unset');
  const hasGroups = main.length > 0 || supporting.length > 0;

  async function generatePortrait(characterId: string) {
    if (!portraitCredId) { alert('ไม่พบ AI Key ที่สร้างภาพได้ — เพิ่ม Key ของ Google Gemini / xAI / OpenAI ที่เมนู Connected AI ก่อน'); return; }
    setPortraitBusy(characterId);
    try {
      const res = await fetch(`/api/characters/${characterId}/portrait`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ credentialId: portraitCredId })
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error ?? 'สร้างภาพไม่สำเร็จ'); return; }
      await loadAll();
    } catch { alert('เกิดข้อผิดพลาดในการสร้างภาพ'); }
    finally { setPortraitBusy(null); }
  }

  async function deletePortrait(characterId: string) {
    setPortraitBusy(characterId);
    try {
      await fetch(`/api/characters/${characterId}/portrait`, { method: 'DELETE' });
      await loadAll();
    } finally { setPortraitBusy(null); }
  }

  const CharacterCard = ({ c }: { c: Character }) => (
    <div className="rounded-2xl border border-[#2C2A35] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[#1C1B23]"
        onClick={() => setExpanded(expanded === c.id ? null : c.id)}>
        <div className="flex items-center gap-3">
          {c.portraitUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.portraitUrl} alt={c.name} className="w-10 h-10 rounded-full object-cover border border-gold/40" />
          ) : (
            <span className="text-2xl">{c.avatarEmoji}</span>
          )}
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">{c.name}</p>
              {c.role !== 'unset' && (
                <span className="text-[9px] font-bold text-gold bg-gold/10 px-1.5 py-0.5 rounded-full">
                  {ROLE_LABEL[c.role]}
                </span>
              )}
            </div>
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
          {/* ภาพตัวละคร — สร้างจากรูปลักษณ์+นิสัยที่กำหนด เก็บถาวรจนกว่าจะลบเอง */}
          <div>
            <p className="text-[10px] text-[#9C9690] uppercase tracking-wider mb-2">ภาพตัวละคร</p>
            {imageCredentials.length > 0 ? (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] text-[#9C9690]">ใช้ AI:</span>
                <select value={portraitCredId} onChange={(e) => setPortraitCredId(e.target.value)}
                  className="rounded-lg px-2 py-1 text-[11px]">
                  {imageCredentials.map((cr) => <option key={cr.id} value={cr.id}>{cr.displayName}</option>)}
                </select>
              </div>
            ) : (
              <p className="text-[10px] text-amber-400/80 mb-2">
                ⚠ ยังไม่มี Key ที่สร้างภาพได้ — เพิ่ม Key ของ Google Gemini / xAI / OpenAI ที่เมนู Connected AI ก่อน
              </p>
            )}
            {c.portraitUrl ? (
              <div className="flex items-start gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.portraitUrl} alt={c.name} className="w-40 h-40 rounded-xl object-cover border border-[#2C2A35]" />
                <div className="flex flex-col gap-2">
                  <button onClick={() => generatePortrait(c.id)} disabled={portraitBusy === c.id}
                    className="text-xs text-gold border border-gold/40 rounded-lg px-3 py-1.5 disabled:opacity-50">
                    {portraitBusy === c.id ? '⏳ กำลังสร้าง...' : '🎲 สร้างใหม่ (ไม่ถูกใจภาพนี้)'}
                  </button>
                  <button onClick={() => deletePortrait(c.id)} disabled={portraitBusy === c.id}
                    className="text-xs text-[#C9716A] border border-[#C9716A]/40 rounded-lg px-3 py-1.5 disabled:opacity-50">
                    🗑 ลบภาพ
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => generatePortrait(c.id)} disabled={portraitBusy === c.id}
                className="text-xs text-gold border border-gold/40 rounded-lg px-3 py-1.5 disabled:opacity-50">
                {portraitBusy === c.id ? '⏳ กำลังสร้างภาพ (10-30 วิ)...' : '🎨 สร้างภาพตัวละครจากข้อมูลด้านล่าง'}
              </button>
            )}
          </div>
          {c.personality && <div><p className="text-[10px] text-[#9C9690] uppercase tracking-wider mb-1">บุคลิก</p><p className="text-sm leading-relaxed">{c.personality}</p></div>}
          {c.tone && <div><p className="text-[10px] text-[#9C9690] uppercase tracking-wider mb-1">น้ำเสียง</p><p className="text-sm leading-relaxed">{c.tone}</p></div>}
          {c.backstory && <div><p className="text-[10px] text-[#9C9690] uppercase tracking-wider mb-1">ประวัติ</p><p className="text-sm leading-relaxed">{c.backstory}</p></div>}
          {c.examples && <div><p className="text-[10px] text-[#9C9690] uppercase tracking-wider mb-1">ตัวอย่างประโยค</p><p className="text-sm leading-relaxed text-[#9C9690] italic">{c.examples}</p></div>}

          {/* Quick create content buttons */}
          <div className="pt-2 border-t border-[#2C2A35]">
            <p className="text-[10px] text-[#9C9690] uppercase tracking-wider mb-2">สร้างเนื้อหาด้วย {c.name}</p>
            <div className="flex gap-2 flex-wrap">
              <a href={`/seo?characterId=${c.id}`}
                className="text-xs text-bone border border-[#2C2A35] rounded-xl px-3 py-1.5 hover:border-gold hover:text-gold transition-colors">
                ✍️ SEO Article
              </a>
              <a href={`/social?characterId=${c.id}`}
                className="text-xs text-bone border border-[#2C2A35] rounded-xl px-3 py-1.5 hover:border-gold hover:text-gold transition-colors">
                📱 Social Content
              </a>
              <a href={`/video?characterId=${c.id}`}
                className="text-xs text-bone border border-[#2C2A35] rounded-xl px-3 py-1.5 hover:border-gold hover:text-gold transition-colors">
                🎬 Video/Ad
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="font-serif text-2xl">Character Engine</h1>
          <p className="text-sm text-[#9C9690] mt-1">สร้างตัวละคร/Brand Voice สำหรับสร้างคอนเทนต์ที่มีเอกลักษณ์</p>
        </div>
        {!showForm && (
          <button onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_FORM); }}
            className="text-sm font-semibold bg-gold text-black rounded-xl px-4 py-2">
            + สร้างตัวละคร
          </button>
        )}
      </div>

      {/* AI Key selector — ใช้ทั้งสร้างรายละเอียดตัวละคร และสร้างภาพตัวละคร */}
      {!showForm && credentials.length > 0 && (
        <div className="flex items-center gap-2 mb-4 rounded-xl border border-[#2C2A35] px-3.5 py-2.5">
          <span className="text-xs text-[#9C9690] whitespace-nowrap">🤖 AI สำหรับสร้างภาพ:</span>
          <select value={genCredentialId}
            onChange={(e) => { setGenCredentialId(e.target.value); setGenModelCode(''); }}
            className="flex-1 rounded-lg px-2.5 py-1.5 text-xs">
            <option value="">— เลือก AI Key —</option>
            {credentials.map((c) => <option key={c.id} value={c.id}>{c.displayName}</option>)}
          </select>
          {genCredentialId && <span className="text-[10px] text-emerald-400">✓ พร้อมสร้างภาพ</span>}
        </div>
      )}

      {/* Create/Edit Form */}
      {showForm && (
        <div className="mt-6 rounded-2xl border border-gold/30 bg-gold/5 p-5 space-y-4">
          <h2 className="font-serif text-lg">{editingId ? 'แก้ไขตัวละคร' : 'สร้างตัวละครใหม่'}</h2>

          {/* Emoji picker */}
          <div>
            <label className="block text-xs text-[#9C9690] mb-2">Avatar</label>
            <div className="flex gap-2 flex-wrap">
              {EMOJI_OPTIONS.map((e) => (
                <button key={e} onClick={() => setForm({...form, avatarEmoji:e})}
                  className={`text-2xl w-10 h-10 rounded-xl border ${form.avatarEmoji===e ? 'border-gold bg-gold/20' : 'border-[#2C2A35]'}`}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#9C9690] mb-1.5">ชื่อตัวละคร *</label>
              <input required value={form.name} onChange={(e) => setForm({...form, name:e.target.value})}
                placeholder="เช่น น้องออร่า" className="w-full rounded-xl px-3.5 py-2.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-[#9C9690] mb-1.5">คำอธิบายสั้นๆ</label>
              <input value={form.description} onChange={(e) => setForm({...form, description:e.target.value})}
                placeholder="เช่น ผู้ช่วยด้านความงาม" className="w-full rounded-xl px-3.5 py-2.5 text-sm" />
            </div>
          </div>

          {/* Role selector */}
          <div>
            <label className="block text-xs text-[#9C9690] mb-1.5">บทบาท (optional)</label>
            <div className="flex gap-2 flex-wrap">
              {ROLE_OPTIONS.map((r) => (
                <button key={r.value} onClick={() => setForm({...form, role:r.value})}
                  className={`text-xs px-3 py-2 rounded-xl border transition-colors ${
                    form.role===r.value ? 'border-gold bg-gold/10 text-gold font-semibold' : 'border-[#2C2A35] text-[#9C9690]'
                  }`}>
                  {r.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-[#9C9690] mt-1.5">
              ไม่เลือกก็ได้ — ระบบจะแสดงตัวละครทั้งหมดรวมกัน เลือกเพื่อจัดหมวดหมู่เท่านั้น
            </p>
          </div>

          {/* รูปลักษณ์ — หัวใจของความต่อเนื่องทุกฉาก/ทุก EP */}
          <div className="rounded-xl border border-gold/20 bg-gold/5 p-3.5 space-y-3">
            <p className="text-xs text-gold font-semibold">🎨 รูปลักษณ์ (ใช้ล็อกหน้าตาให้เหมือนกันทุกฉาก — ยิ่งละเอียดยิ่งนิ่ง)</p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] text-[#9C9690] mb-1">เพศ</label>
                <input value={form.gender} onChange={(e) => setForm({...form, gender:e.target.value})}
                  placeholder="หญิง / ชาย" className="w-full rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-[11px] text-[#9C9690] mb-1">ช่วงวัย</label>
                <input value={form.ageRange} onChange={(e) => setForm({...form, ageRange:e.target.value})}
                  placeholder="25-30 ปี" className="w-full rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-[11px] text-[#9C9690] mb-1">สีผิว</label>
                <input value={form.skinTone} onChange={(e) => setForm({...form, skinTone:e.target.value})}
                  placeholder="ผิวสองสี" className="w-full rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] text-[#9C9690] mb-1">หน้าตา ทรงผม รูปร่าง จุดเด่น</label>
              <textarea value={form.appearance} onChange={(e) => setForm({...form, appearance:e.target.value})} rows={2}
                placeholder="เช่น: ผมยาวสีดำตรง หน้ารูปไข่ ตากลมโต ยิ้มมีลักยิ้ม รูปร่างสมส่วน สูง 165 ซม."
                className="w-full rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-[11px] text-[#9C9690] mb-1">ชุด / สไตล์ประจำตัว</label>
              <input value={form.outfit} onChange={(e) => setForm({...form, outfit:e.target.value})}
                placeholder="เช่น: เดรสสีครีมมินิมอล / ชุดหมอสีขาว" className="w-full rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          {/* AI Generator */}
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
              <button onClick={handleGenerateWithAI}
                disabled={generating || !genCredentialId || !genModelCode || !form.name}
                className="text-xs font-semibold bg-[#2C2A35] text-bone rounded-xl px-3 py-2 disabled:opacity-50">
                {generating ? 'กำลังสร้าง...' : 'สร้าง'}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs text-[#9C9690] mb-1.5">บุคลิกนิสัย</label>
            <textarea value={form.personality} onChange={(e) => setForm({...form, personality:e.target.value})}
              placeholder="เช่น เป็นมิตร อบอุ่น ให้คำแนะนำอย่างตรงไปตรงมา..."
              className="w-full rounded-xl px-3.5 py-2.5 text-sm min-h-[80px] resize-none" />
          </div>
          <div>
            <label className="block text-xs text-[#9C9690] mb-1.5">น้ำเสียงการสื่อสาร</label>
            <input value={form.tone} onChange={(e) => setForm({...form, tone:e.target.value})}
              placeholder="เช่น พูดภาษาไทยกึ่งทางการ ใช้ภาษาเข้าใจง่าย"
              className="w-full rounded-xl px-3.5 py-2.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-[#9C9690] mb-1.5">ประวัติ / Backstory</label>
            <textarea value={form.backstory} onChange={(e) => setForm({...form, backstory:e.target.value})}
              placeholder="เช่น น้องออร่าเป็นผู้ช่วยด้านความงามที่มีประสบการณ์..."
              className="w-full rounded-xl px-3.5 py-2.5 text-sm min-h-[80px] resize-none" />
          </div>
          <div>
            <label className="block text-xs text-[#9C9690] mb-1.5">ตัวอย่างประโยค</label>
            <textarea value={form.examples} onChange={(e) => setForm({...form, examples:e.target.value})}
              placeholder="เช่น สวัสดีค่ะ วันนี้จะมาแนะนำผลิตภัณฑ์ที่ดีสำหรับผิวคุณนะคะ"
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

      {/* Character list — grouped if user chose roles, flat if not */}
      <div className="mt-8 space-y-6">
        {characters.length === 0 && !showForm && (
          <p className="text-sm text-[#9C9690]">ยังไม่มีตัวละคร — กด "+ สร้างตัวละคร" เพื่อเริ่มต้น</p>
        )}

        {hasGroups ? (
          <>
            {main.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[#9C9690] uppercase tracking-wider mb-3">⭐ ตัวหลัก</p>
                <div className="space-y-2">{main.map((c) => <CharacterCard key={c.id} c={c} />)}</div>
              </div>
            )}
            {supporting.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[#9C9690] uppercase tracking-wider mb-3">🎭 ตัวประกอบ</p>
                <div className="space-y-2">{supporting.map((c) => <CharacterCard key={c.id} c={c} />)}</div>
              </div>
            )}
            {unset.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[#9C9690] uppercase tracking-wider mb-3">ตัวละครอื่นๆ</p>
                <div className="space-y-2">{unset.map((c) => <CharacterCard key={c.id} c={c} />)}</div>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-2">{characters.map((c) => <CharacterCard key={c.id} c={c} />)}</div>
        )}
      </div>
    </div>
  );
}