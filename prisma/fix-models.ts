// รัน: npx tsx prisma/fix-models.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const DEACTIVATE = [
  'imagen-3.0-generate-002',
  'gemini-2.0-flash-preview-image-generation',
  'gemini-2.5-flash-image-preview',
  'gemini-2.5-flash-preview-tts',  // old name — replaced below with correct
  'gemini-3.1-flash-preview-tts',  // wrong name
];

const ALL_MODELS = [
  // Google — image
  { providerCode: 'google', modelCode: 'gemini-2.5-flash-image',    displayName: 'Nano Banana — สร้างภาพ (รองรับทุก aspect ratio)', capability: 'image' },
  { providerCode: 'google', modelCode: 'gemini-3.1-flash-image',    displayName: 'Nano Banana 2 — สร้างภาพ HD',                       capability: 'image' },
  { providerCode: 'google', modelCode: 'gemini-3-pro-image',         displayName: 'Nano Banana Pro — 4K รองรับข้อความในภาพ',            capability: 'image' },
  // Google — audio (correct TTS model names)
  { providerCode: 'google', modelCode: 'gemini-2.5-flash-preview-tts', displayName: 'Gemini 2.5 Flash TTS — เสียงพากย์เร็ว',          capability: 'audio' },
  { providerCode: 'google', modelCode: 'gemini-3.1-flash-tts-preview', displayName: 'Gemini 3.1 Flash TTS — เสียงพากย์คุณภาพสูง',     capability: 'audio' },
  // OpenAI — image
  { providerCode: 'openai', modelCode: 'gpt-image-1',      displayName: 'GPT Image 1 — คุณภาพสูง รองรับข้อความในภาพ', capability: 'image' },
  { providerCode: 'openai', modelCode: 'gpt-image-1-mini', displayName: 'GPT Image 1 Mini — เร็ว ประหยัด',              capability: 'image' },
  { providerCode: 'openai', modelCode: 'gpt-image-2',      displayName: 'GPT Image 2 — Arbitrary Resolution สูงสุด',    capability: 'image' },
];

async function main() {
  console.log('🔧 อัปเดตโมเดล...\n');

  for (const code of DEACTIVATE) {
    const r = await prisma.aiModel.updateMany({ where: { modelCode: code }, data: { isActive: false } });
    if (r.count > 0) console.log(`❌ ปิด: ${code}`);
  }

  for (const m of ALL_MODELS) {
    await prisma.aiModel.upsert({
      where: { providerCode_modelCode: { providerCode: m.providerCode, modelCode: m.modelCode } },
      update: { displayName: m.displayName, capability: m.capability, isActive: true },
      create: { ...m, isActive: true }
    });
    console.log(`✅ [${m.capability}] ${m.displayName}`);
  }

  console.log('\nเสร็จแล้ว!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
