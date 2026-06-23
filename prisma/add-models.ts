// รัน: npx tsx prisma/add-models.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const models = [
  // Google — Text/Multimodal
  { providerCode: 'google', modelCode: 'gemini-3.5-flash',              displayName: 'Gemini 3.5 Flash (ใหม่ล่าสุด)' },
  { providerCode: 'google', modelCode: 'gemini-3.1-pro-preview',        displayName: 'Gemini 3.1 Pro Preview' },
  { providerCode: 'google', modelCode: 'gemini-3-flash',                displayName: 'Gemini 3 Flash (แนะนำ)' },
  { providerCode: 'google', modelCode: 'gemini-2.5-flash',              displayName: 'Gemini 2.5 Flash' },
  { providerCode: 'google', modelCode: 'gemini-2.5-flash-lite',         displayName: 'Gemini 2.5 Flash-Lite (ประหยัด)' },
  // Google — Image
  { providerCode: 'google', modelCode: 'gemini-2.5-flash-image',        displayName: 'Nano Banana — สร้างภาพ' },
  // Google — Video (Veo)
  { providerCode: 'google', modelCode: 'veo-3.1-generate-preview',      displayName: 'Veo 3.1 — สร้างวิดีโอ' },
  { providerCode: 'google', modelCode: 'veo-3.1-fast-generate-preview', displayName: 'Veo 3.1 Fast — วิดีโอเร็ว' },
  { providerCode: 'google', modelCode: 'veo-3.1-lite-generate-preview', displayName: 'Veo 3.1 Lite — วิดีโอประหยัด' },
  // Google — Audio / TTS
  { providerCode: 'google', modelCode: 'gemini-2.5-flash-preview-tts', displayName: 'Gemini 2.5 Flash TTS — เสียงพากย์' },
  { providerCode: 'google', modelCode: 'gemini-3.1-flash-preview-tts', displayName: 'Gemini 3.1 Flash TTS — เสียงพากย์ (ใหม่)' },
  // Anthropic
  { providerCode: 'anthropic', modelCode: 'claude-opus-4-6',            displayName: 'Claude Opus 4.6' },
  // OpenAI
  { providerCode: 'openai', modelCode: 'gpt-4o',                        displayName: 'GPT-4o' },
  { providerCode: 'openai', modelCode: 'o3',                            displayName: 'o3 (Reasoning)' },
  { providerCode: 'openai', modelCode: 'o4-mini',                       displayName: 'o4 Mini (Reasoning เร็ว)' },
  // OpenAI — Audio / TTS
  { providerCode: 'openai', modelCode: 'tts-1',                         displayName: 'TTS-1 — เสียงพากย์เร็ว' },
  { providerCode: 'openai', modelCode: 'tts-1-hd',                      displayName: 'TTS-1 HD — เสียงพากย์คุณภาพสูง' },
  // xAI Grok (อยู่ใต้ OpenAI ตามที่ต้องการ)
  { providerCode: 'xai', modelCode: 'grok-4.3',               displayName: 'Grok 4.3 (แนะนำ)' },
  { providerCode: 'xai', modelCode: 'grok-4.20',              displayName: 'Grok 4.20 (Reasoning)' },
  { providerCode: 'xai', modelCode: 'grok-4',                 displayName: 'Grok 4' },
  { providerCode: 'xai', modelCode: 'grok-imagine-image-pro', displayName: 'Grok Imagine — สร้างภาพ' },
  { providerCode: 'xai', modelCode: 'grok-imagine-video-1.5', displayName: 'Grok Imagine Video 1.5 — สร้างวิดีโอ' },
];

async function main() {
  console.log('เพิ่มโมเดลใหม่...');
  for (const m of models) {
    await prisma.aiModel.upsert({
      where: {
        providerCode_modelCode: {
          providerCode: m.providerCode,
          modelCode: m.modelCode
        }
      },
      update: { displayName: m.displayName },
      create: {
        providerCode: m.providerCode,
        modelCode: m.modelCode,
        displayName: m.displayName,
        isActive: true
      }
    });
    console.log('✓', m.displayName);
  }
  console.log('\nเสร็จแล้ว!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
