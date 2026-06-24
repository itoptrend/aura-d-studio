// รัน: npx tsx prisma/add-models.ts
// อัปเดตโมเดลทั้งหมดให้มีฟิลด์ capability ที่ถูกต้อง
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const models = [
  // Anthropic — text
  { providerCode: 'anthropic', modelCode: 'claude-opus-4-7',           displayName: 'Claude Opus 4.7 (สูงสุด)',       capability: 'text' },
  { providerCode: 'anthropic', modelCode: 'claude-opus-4-6',           displayName: 'Claude Opus 4.6',                capability: 'text' },
  { providerCode: 'anthropic', modelCode: 'claude-sonnet-4-6',         displayName: 'Claude Sonnet 4.6 (แนะนำ)',       capability: 'text' },
  { providerCode: 'anthropic', modelCode: 'claude-haiku-4-5-20251001', displayName: 'Claude Haiku 4.5 (เร็ว/ประหยัด)', capability: 'text' },
  // OpenAI — text
  { providerCode: 'openai', modelCode: 'gpt-4.1',        displayName: 'GPT-4.1 (สูงสุด)',         capability: 'text'  },
  { providerCode: 'openai', modelCode: 'gpt-4.1-mini',   displayName: 'GPT-4.1 Mini (ประหยัด)',   capability: 'text'  },
  { providerCode: 'openai', modelCode: 'gpt-4o',         displayName: 'GPT-4o',                   capability: 'text'  },
  { providerCode: 'openai', modelCode: 'o3',             displayName: 'o3 (Reasoning)',            capability: 'text'  },
  { providerCode: 'openai', modelCode: 'o4-mini',        displayName: 'o4 Mini (Reasoning เร็ว)',  capability: 'text'  },
  { providerCode: 'openai', modelCode: 'tts-1',          displayName: 'TTS-1 — เสียงพากย์เร็ว',   capability: 'audio' },
  { providerCode: 'openai', modelCode: 'tts-1-hd',       displayName: 'TTS-1 HD — เสียงคุณภาพสูง', capability: 'audio' },
  // xAI Grok
  { providerCode: 'xai', modelCode: 'grok-4.3',               displayName: 'Grok 4.3 (แนะนำ)',              capability: 'text'  },
  { providerCode: 'xai', modelCode: 'grok-4.20',              displayName: 'Grok 4.20 (Reasoning)',          capability: 'text'  },
  { providerCode: 'xai', modelCode: 'grok-4',                 displayName: 'Grok 4',                         capability: 'text'  },
  { providerCode: 'xai', modelCode: 'grok-imagine-image-pro', displayName: 'Grok Imagine — สร้างภาพ',        capability: 'image' },
  { providerCode: 'xai', modelCode: 'grok-imagine-video-1.5', displayName: 'Grok Imagine Video 1.5 — วิดีโอ', capability: 'video' },
  // Google — text
  { providerCode: 'google', modelCode: 'gemini-3.5-flash',              displayName: 'Gemini 3.5 Flash (ใหม่ล่าสุด)',   capability: 'text'  },
  { providerCode: 'google', modelCode: 'gemini-3.1-pro-preview',        displayName: 'Gemini 3.1 Pro Preview',          capability: 'text'  },
  { providerCode: 'google', modelCode: 'gemini-3-flash',                displayName: 'Gemini 3 Flash (แนะนำ)',           capability: 'text'  },
  { providerCode: 'google', modelCode: 'gemini-2.5-flash',              displayName: 'Gemini 2.5 Flash',                capability: 'text'  },
  { providerCode: 'google', modelCode: 'gemini-2.5-pro',                displayName: 'Gemini 2.5 Pro',                  capability: 'text'  },
  { providerCode: 'google', modelCode: 'gemini-2.5-flash-lite',         displayName: 'Gemini 2.5 Flash-Lite (ประหยัด)', capability: 'text'  },
  // Google — image (gemini-2.5-flash-image = Nano Banana GA, รองรับ 10 aspect ratios)
  { providerCode: 'google', modelCode: 'gemini-2.5-flash-image', displayName: 'Nano Banana — สร้างภาพ (รองรับทุก ratio)', capability: 'image' },
  // Google — video
  { providerCode: 'google', modelCode: 'veo-3.1-generate-preview',      displayName: 'Veo 3.1 — สร้างวิดีโอ',           capability: 'video' },
  { providerCode: 'google', modelCode: 'veo-3.1-fast-generate-preview', displayName: 'Veo 3.1 Fast — วิดีโอเร็ว',       capability: 'video' },
  { providerCode: 'google', modelCode: 'veo-3.1-lite-generate-preview', displayName: 'Veo 3.1 Lite — วิดีโอประหยัด',    capability: 'video' },
  // Google — audio
  { providerCode: 'google', modelCode: 'gemini-2.5-flash-preview-tts',  displayName: 'Gemini 2.5 Flash TTS — เสียงพากย์',       capability: 'audio' },
  { providerCode: 'google', modelCode: 'gemini-3.1-flash-preview-tts',  displayName: 'Gemini 3.1 Flash TTS — เสียงพากย์ (ใหม่)', capability: 'audio' },
];

async function main() {
  console.log('อัปเดตโมเดลพร้อม capability...');
  for (const m of models) {
    await prisma.aiModel.upsert({
      where: {
        providerCode_modelCode: { providerCode: m.providerCode, modelCode: m.modelCode }
      },
      update: { displayName: m.displayName, capability: m.capability },
      create: {
        providerCode: m.providerCode,
        modelCode: m.modelCode,
        displayName: m.displayName,
        capability: m.capability,
        isActive: true
      }
    });
    console.log(`✓ [${m.capability}] ${m.displayName}`);
  }
  console.log('\nเสร็จแล้ว!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
