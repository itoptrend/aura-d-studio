// src/lib/characterPrompt.ts
// แปลงข้อมูลตัวละคร → บล็อกคำบรรยายคงที่ที่แนบเข้า prompt วิดีโอทุกครั้ง
// หลักการ: ใช้คำบรรยายชุดเดียวกันเป๊ะๆ ทุกฉาก/ทุก EP → หน้าตาตัวละครออกมาใกล้เคียงกันที่สุด

export interface CharacterForPrompt {
  name:        string
  role?:       string | null
  gender?:     string | null
  ageRange?:   string | null
  skinTone?:   string | null
  appearance?: string | null
  outfit?:     string | null
  personality?: string | null
}

export const ROLE_LABELS: Record<string, string> = {
  heroine:    '👸 นางเอก',
  hero:       '🤴 พระเอก',
  supporting: '🎭 ตัวรอง',
  extra:      '👥 ตัวประกอบ',
  villain:    '😈 ตัวร้าย',
  unset:      'ไม่ระบุ',
}

/** สร้างบล็อกบรรยายตัวละคร 1 ตัว (ข้อความคงที่ ใช้ซ้ำได้ทุกฉาก) */
export function buildCharacterBlock(c: CharacterForPrompt): string {
  const parts: string[] = []
  if (c.gender?.trim())     parts.push(c.gender.trim())
  if (c.ageRange?.trim())   parts.push(`age ${c.ageRange.trim()}`)
  if (c.skinTone?.trim())   parts.push(`${c.skinTone.trim()} skin`)
  if (c.appearance?.trim()) parts.push(c.appearance.trim())
  if (c.outfit?.trim())     parts.push(`wearing ${c.outfit.trim()}`)
  if (c.personality?.trim()) parts.push(`personality: ${c.personality.trim()}`)

  const detail = parts.length > 0 ? parts.join(', ') : 'no specific appearance defined'
  return `${c.name} (${detail})`
}

/** สร้างส่วน "Characters:" สำหรับแนบท้าย prompt — รองรับหลายตัวละครในฉากเดียว */
export function buildCharactersSection(chars: CharacterForPrompt[]): string {
  if (chars.length === 0) return ''
  const lines = chars.map(c => `- ${buildCharacterBlock(c)}`)
  return `\nCharacters in this scene (keep their appearance EXACTLY consistent):\n${lines.join('\n')}`
}
