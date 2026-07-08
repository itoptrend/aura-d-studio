// src/lib/videoCredits.ts
// ประมาณการเครดิตของวิดีโอที่สร้าง — คิดตามโมเดล × ความยาว (วินาที)
// มาตรฐานเดียวกับส่วนอื่นของแอป: 1 เครดิต ≈ $0.01 USD
// (ตัวเลขต่อวินาทีอิงราคาจริงของแต่ละ API — ปรับได้ที่นี่ที่เดียว)

const CREDITS_PER_SECOND: Record<string, number> = {
  // OpenRouter
  'openrouter/kling-video-o1':    11.2,  // $0.112/วินาที
  'openrouter/kling-v3-pro':      15,
  'openrouter/kling-v3-standard': 5,
  'openrouter/veo-3.1-fast':      15,
  // Kling official
  'kling-v2-5-pro':               9,
  'kling-v2-master':              14,
  'kling-v1-6-pro':               5,
  'kling-lip-sync':               0.3,   // Lip Sync ถูกมาก (~$0.014/5วิ)
  // xAI
  'grok-imagine-video-1.5':       7,
  // Google Veo
  'veo-3.1-fast-generate-preview': 15,
  'veo-3.1-generate-preview':      40,
}

const DEFAULT_CREDITS_PER_SECOND = 10

/** เครดิตประมาณการของวิดีโอ 1 คลิป */
export function getVideoCredits(modelCode: string, durationSecs: number): number {
  const perSec = CREDITS_PER_SECOND[modelCode] ?? DEFAULT_CREDITS_PER_SECOND
  return Math.round(perSec * durationSecs)
}
