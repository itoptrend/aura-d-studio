// src/lib/videoModelCaps.ts
// ตารางความสามารถของโมเดลวิดีโอแต่ละตัว — duration ที่รองรับจริง (วินาที)
// ใช้ร่วมกันทั้งหน้า UI (แสดงปุ่มเฉพาะค่าที่ทำได้) และ API (กันค่าเพี้ยนจาก client)
//
// อ้างอิงความสามารถจริงของแต่ละ API:
//   Kling official API        → 5 หรือ 10
//   Kling Video O1 (OpenRouter) → 5 หรือ 10
//   Kling v3.0 (OpenRouter)     → 3–15 (เลือก preset ที่ใช้บ่อย)
//   Google Veo 3.1             → 4, 6, 8
//   xAI Grok Imagine           → 1–15 (เลือก preset ที่ใช้บ่อย)

export function getSupportedDurations(providerCode: string, modelCode: string): number[] {
  const model = (modelCode ?? '').toLowerCase()

  if (providerCode === 'openrouter') {
    if (model.includes('kling-video-o1')) return [5, 10]
    if (model.includes('kling-v3'))       return [5, 8, 10, 15]
    if (model.includes('veo'))            return [4, 6, 8]
    return [5, 10]
  }
  if (providerCode === 'kling')  return [5, 10]
  if (providerCode === 'google') return [4, 6, 8]
  if (providerCode === 'xai')    return [6, 8, 10, 15]

  // provider ที่ไม่รู้จัก — ค่ากลางที่ปลอดภัย
  return [5, 8]
}

/** ปรับ duration ให้เป็นค่าที่โมเดลรองรับ (เลือกค่าที่ใกล้ที่สุด) */
export function snapDuration(providerCode: string, modelCode: string, secs: number): number {
  const supported = getSupportedDurations(providerCode, modelCode)
  if (supported.includes(secs)) return secs
  return supported.reduce((best, cur) =>
    Math.abs(cur - secs) < Math.abs(best - secs) ? cur : best
  , supported[0])
}
