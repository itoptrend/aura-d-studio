'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

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
  seo: '✏️ SEO',
  social: '📱 Social Media',
  character: '🎭 Character',
  video: '🎬 Video',
  general: '⚡ ทั่วไป'
};

export default function SkillsPage() {
  const router = useRouter();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const url = activeCategory ? `/api/skills?category=${activeCategory}` : '/api/skills';
      const res = await fetch(url);
      const data = await res.json();
      setSkills(data.skills ?? []);
      setLoading(false);
    }
    load();
  }, [activeCategory]);

  // Group by category for display
  const grouped = skills.reduce<Record<string, Skill[]>>((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex items-start justify-between mb-1">
        <div>
          <h1 className="font-serif text-2xl">Official Skill Library</h1>
          <p className="text-sm text-[#9C9690] mt-1">
            Skill สำเร็จรูปที่ Aura-D Studio ดูแลให้ — ใช้ได้ทันที อัปเดตรายเดือน
          </p>
        </div>
        <span className="text-xs text-[#9C9690] border border-[#2C2A35] rounded-full px-2.5 py-1 flex-shrink-0 mt-1">
          อ่านได้อย่างเดียว
        </span>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap mt-6 mb-8">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.code}
            onClick={() => setActiveCategory(cat.code)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              activeCategory === cat.code
                ? 'bg-gold text-black border-gold font-semibold'
                : 'border-[#2C2A35] text-[#9C9690] hover:border-[#9C9690]'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-[#9C9690]">กำลังโหลด...</p>}

      {!loading && skills.length === 0 && (
        <p className="text-sm text-[#9C9690]">ไม่พบ Skill ในหมวดนี้</p>
      )}

      {/* Skill cards grouped by category */}
      {!loading && Object.entries(grouped).map(([category, catSkills]) => (
        <div key={category} className="mb-8">
          <p className="text-xs font-semibold text-[#9C9690] uppercase tracking-wider mb-3">
            {CATEGORY_LABEL[category] ?? category}
          </p>
          <div className="space-y-2">
            {catSkills.map((skill) => (
              <div
                key={skill.id}
                className="rounded-2xl border border-[#2C2A35] overflow-hidden"
              >
                {/* Header row */}
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[#1C1B23]"
                  onClick={() => setExpanded(expanded === skill.id ? null : skill.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{skill.name}</p>
                      {skill.isOfficial && (
                        <span className="text-[9px] font-bold text-gold bg-gold/10 px-1.5 py-0.5 rounded-full flex-shrink-0">
                          OFFICIAL
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#9C9690] mt-0.5 truncate">{skill.description}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/seo?skillId=${skill.id}`);
                      }}
                      className="text-xs font-semibold text-gold border border-gold/40 rounded-lg px-3 py-1.5 hover:bg-gold/10"
                    >
                      ใช้ Skill นี้
                    </button>
                    <span className="text-[#9C9690] text-xs">
                      {expanded === skill.id ? '▲' : '▼'}
                    </span>
                  </div>
                </div>

                {/* Expanded prompt template */}
                {expanded === skill.id && (
                  <div className="px-4 pb-4 border-t border-[#2C2A35]">
                    <p className="text-xs text-[#9C9690] mt-3 mb-1.5 font-semibold uppercase tracking-wider">
                      System Prompt
                    </p>
                    <p className="text-xs text-[#9C9690] leading-relaxed bg-[#15151A] rounded-xl p-3 border border-[#2C2A35]">
                      {skill.promptTemplate}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
