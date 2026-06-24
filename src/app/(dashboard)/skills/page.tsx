'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';

interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  promptTemplate: string;
  isOfficial: boolean;
}

const CATEGORIES = [
  { code: '',          label: 'ทั้งหมด' },
  { code: 'seo',       label: '✏️ SEO' },
  { code: 'social',    label: '📱 Social Media' },
  { code: 'character', label: '🎭 Character' },
  { code: 'video',     label: '🎬 Video' },
  { code: 'general',   label: '⚡ ทั่วไป' }
];

const CATEGORY_LABEL: Record<string, string> = {
  seo: '✏️ SEO', social: '📱 Social', character: '🎭 Character', video: '🎬 Video', general: '⚡ ทั่วไป'
};

const EMPTY_FORM = { name: '', description: '', category: 'general', promptTemplate: '' };

export default function SkillsPage() {
  const router = useRouter();
  const { success: toastSuccess, error: toastError } = useToast();
  const [officialSkills, setOfficialSkills] = useState<Skill[]>([]);
  const [customSkills, setCustomSkills] = useState<Skill[]>([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const url = `/api/skills?includeCustom=true${activeCategory ? `&category=${activeCategory}` : ''}`;
    const res = await fetch(url);
    const data = await res.json();
    setOfficialSkills(data.officialSkills ?? []);
    setCustomSkills(data.customSkills ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [activeCategory]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    const res = await fetch('/api/skills', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form)
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setFormError(data.error ?? 'สร้างไม่สำเร็จ'); return; }
    toastSuccess('✓ สร้าง Skill สำเร็จ');
    setForm(EMPTY_FORM);
    setShowForm(false);
    await load();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`ลบ Skill "${name}"?`)) return;
    const res = await fetch(`/api/skills/${id}`, { method: 'DELETE' });
    if (res.ok) {
      toastSuccess(`ลบ "${name}" แล้ว`);
      setCustomSkills((prev) => prev.filter((s) => s.id !== id));
    } else {
      const data = await res.json();
      toastError(data.error ?? 'ลบไม่สำเร็จ');
    }
  }

  function useSkill(skill: Skill) {
    router.push(`/seo?skillId=${skill.id}`);
  }

  function SkillCard({ skill, isCustom }: { skill: Skill; isCustom?: boolean }) {
    const isExp = expanded === skill.id;
    return (
      <div className={`rounded-2xl border p-4 transition-colors ${isCustom ? 'border-gold/30 bg-gold/5' : 'border-[#2C2A35]'}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold">{skill.name}</p>
              {isCustom && (
                <span className="text-[9px] font-bold text-gold bg-gold/20 px-1.5 py-0.5 rounded-full">MY SKILL</span>
              )}
              <span className="text-[10px] text-[#9C9690] border border-[#2C2A35] rounded px-1.5 py-0.5">
                {CATEGORY_LABEL[skill.category] ?? skill.category}
              </span>
            </div>
            <p className="text-xs text-[#9C9690] mt-1">{skill.description}</p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button onClick={() => useSkill(skill)}
              className="text-xs font-semibold text-gold border border-gold/40 rounded-xl px-3 py-1.5 hover:bg-gold/10 transition-colors">
              ใช้ Skill →
            </button>
            {isCustom && (
              <button onClick={() => handleDelete(skill.id, skill.name)}
                className="text-xs text-[#9C9690] hover:text-red-400 border border-[#2C2A35] hover:border-red-500/60 rounded-xl px-2 py-1.5 transition-colors"
                title="ลบ Skill นี้">
                🗑️
              </button>
            )}
          </div>
        </div>

        {/* Expand prompt */}
        <button
          onClick={() => setExpanded(isExp ? null : skill.id)}
          className="mt-2 text-[10px] text-[#9C9690] hover:text-bone flex items-center gap-1">
          {isExp ? '▲ ซ่อน Prompt' : '▼ ดู Prompt Template'}
        </button>
        {isExp && (
          <pre className="mt-2 text-[10px] text-[#9C9690] bg-[#15151A] rounded-xl p-3 whitespace-pre-wrap leading-relaxed border border-[#2C2A35]">
            {skill.promptTemplate}
          </pre>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl">Skill Library</h1>
          <p className="text-sm text-[#9C9690] mt-1">Prompt template สำเร็จรูป ใช้กับทุกโมดูล</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setFormError(null); }}
          className={`text-sm font-semibold px-4 py-2 rounded-xl border transition-colors ${
            showForm ? 'border-gold bg-gold/10 text-gold' : 'border-[#2C2A35] text-[#9C9690] hover:border-gold hover:text-gold'
          }`}>
          {showForm ? '✕ ยกเลิก' : '+ สร้าง Skill ของตัวเอง'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="rounded-2xl border border-gold/30 bg-gold/5 p-5 mb-6 space-y-3">
          <h2 className="font-serif text-lg text-gold">✨ สร้าง Skill ใหม่</h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#9C9690] mb-1.5">ชื่อ Skill *</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="เช่น เขียนรีวิวสินค้า Amazon"
                className="w-full rounded-xl px-3.5 py-2.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-[#9C9690] mb-1.5">หมวดหมู่ *</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full rounded-xl px-3.5 py-2.5 text-sm">
                <option value="seo">✏️ SEO</option>
                <option value="social">📱 Social Media</option>
                <option value="video">🎬 Video</option>
                <option value="character">🎭 Character</option>
                <option value="general">⚡ ทั่วไป</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-[#9C9690] mb-1.5">คำอธิบาย *</label>
            <input required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="เช่น เขียนรีวิวสินค้าแบบ honest เน้นข้อดีข้อเสีย"
              className="w-full rounded-xl px-3.5 py-2.5 text-sm" />
          </div>

          <div>
            <label className="block text-xs text-[#9C9690] mb-1.5">
              Prompt Template * <span className="text-[10px] opacity-60">— System prompt ที่จะส่งให้ AI</span>
            </label>
            <textarea required value={form.promptTemplate}
              onChange={(e) => setForm({ ...form, promptTemplate: e.target.value })}
              placeholder={`เช่น คุณเป็นผู้เชี่ยวชาญรีวิวสินค้า เขียนรีวิวแบบ honest ครอบคลุมข้อดี ข้อเสีย ราคา กลุ่มเป้าหมาย ความยาว 300-500 คำ ใช้ภาษาไทยที่เป็นธรรมชาติ`}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm min-h-[120px] resize-none" />
            <p className="text-[10px] text-[#9C9690] mt-1">{form.promptTemplate.length}/2000 ตัวอักษร</p>
          </div>

          {formError && <p className="text-sm text-[#C9716A]">{formError}</p>}

          <button type="submit" disabled={saving}
            className="rounded-xl bg-gold text-black font-semibold px-5 py-2.5 text-sm disabled:opacity-50">
            {saving ? 'กำลังบันทึก...' : '✓ บันทึก Skill'}
          </button>
        </form>
      )}

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap mb-6">
        {CATEGORIES.map((c) => (
          <button key={c.code} onClick={() => setActiveCategory(c.code)}
            className={`text-xs px-3 py-1.5 rounded-xl border transition-colors ${
              activeCategory === c.code ? 'border-gold bg-gold/10 text-gold font-semibold' : 'border-[#2C2A35] text-[#9C9690] hover:border-[#9C9690]'
            }`}>
            {c.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-[#9C9690]">กำลังโหลด...</p>}

      {/* My Skills */}
      {customSkills.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-gold uppercase tracking-wider mb-3">
            My Skills ({customSkills.length})
          </h2>
          <div className="space-y-3">
            {customSkills.map((s) => <SkillCard key={s.id} skill={s} isCustom />)}
          </div>
        </div>
      )}

      {/* Official Skills */}
      {officialSkills.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-[#9C9690] uppercase tracking-wider mb-3">
            Official Skills ({officialSkills.length})
          </h2>
          <div className="space-y-3">
            {officialSkills.map((s) => <SkillCard key={s.id} skill={s} />)}
          </div>
        </div>
      )}

      {!loading && officialSkills.length === 0 && customSkills.length === 0 && (
        <p className="text-sm text-[#9C9690]">ไม่พบ Skill ในหมวดนี้</p>
      )}
    </div>
  );
}
