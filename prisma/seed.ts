// Seeds the AI Provider Registry (spec §5.5) with current model lineups.
// Run with: npm run db:seed

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // ─── ANTHROPIC ──────────────────────────────────────────────────────────────
  await prisma.aiProvider.upsert({
    where: { code: 'anthropic' },
    update: {},
    create: {
      code: 'anthropic',
      displayName: 'Anthropic Claude',
      capabilities: ['text', 'vision'],
      keyPrefixHint: 'sk-ant-',
      models: {
        create: [
          { modelCode: 'claude-opus-4-7',              displayName: 'Claude Opus 4.7 (สูงสุด)' },
          { modelCode: 'claude-opus-4-6',              displayName: 'Claude Opus 4.6' },
          { modelCode: 'claude-sonnet-4-6',            displayName: 'Claude Sonnet 4.6 (แนะนำ)' },
          { modelCode: 'claude-haiku-4-5-20251001',    displayName: 'Claude Haiku 4.5 (เร็ว/ประหยัด)' }
        ]
      }
    }
  });

  // ─── OPENAI ─────────────────────────────────────────────────────────────────
  await prisma.aiProvider.upsert({
    where: { code: 'openai' },
    update: {},
    create: {
      code: 'openai',
      displayName: 'OpenAI GPT',
      capabilities: ['text', 'vision'],
      keyPrefixHint: 'sk-',
      models: {
        create: [
          { modelCode: 'gpt-4.1',        displayName: 'GPT-4.1 (สูงสุด)' },
          { modelCode: 'gpt-4.1-mini',   displayName: 'GPT-4.1 Mini (ประหยัด)' },
          { modelCode: 'gpt-4o',         displayName: 'GPT-4o' },
          { modelCode: 'o3',             displayName: 'o3 (Reasoning)' },
          { modelCode: 'o4-mini',        displayName: 'o4 Mini (Reasoning เร็ว)' },
          // Audio / TTS
          { modelCode: 'tts-1',          displayName: 'TTS-1 — เสียงพากย์เร็ว' },
          { modelCode: 'tts-1-hd',       displayName: 'TTS-1 HD — เสียงพากย์คุณภาพสูง' }
        ]
      }
    }
  });

  // ─── XAI GROK ───────────────────────────────────────────────────────────────
  // วางไว้ใต้ OpenAI GPT ตามที่ออกแบบไว้
  // API เป็น OpenAI-compatible (เปลี่ยนแค่ baseURL กับ key prefix "xai-")
  await prisma.aiProvider.upsert({
    where: { code: 'xai' },
    update: {},
    create: {
      code: 'xai',
      displayName: 'xAI Grok',
      capabilities: ['text', 'vision', 'image', 'video'],
      keyPrefixHint: 'xai-',
      models: {
        create: [
          { modelCode: 'grok-4.3',               displayName: 'Grok 4.3 (แนะนำ)' },
          { modelCode: 'grok-4.20',              displayName: 'Grok 4.20 (Reasoning)' },
          { modelCode: 'grok-4',                 displayName: 'Grok 4' },
          { modelCode: 'grok-imagine-image-pro', displayName: 'Grok Imagine — สร้างภาพ' },
          { modelCode: 'grok-imagine-video-1.5', displayName: 'Grok Imagine Video 1.5 — สร้างวิดีโอ' }
        ]
      }
    }
  });

  // ─── GOOGLE ─────────────────────────────────────────────────────────────────
  // Text/vision models (Gemini)
  await prisma.aiProvider.upsert({
    where: { code: 'google' },
    update: {},
    create: {
      code: 'google',
      displayName: 'Google Gemini',
      capabilities: ['text', 'vision', 'image', 'video', 'audio'],
      keyPrefixHint: 'AIza',
      models: {
        create: [
          // Text / Multimodal
          { modelCode: 'gemini-3.5-flash',              displayName: 'Gemini 3.5 Flash (ใหม่ล่าสุด)' },
          { modelCode: 'gemini-3.1-pro-preview',        displayName: 'Gemini 3.1 Pro Preview' },
          { modelCode: 'gemini-3-flash',                displayName: 'Gemini 3 Flash (แนะนำ)' },
          { modelCode: 'gemini-2.5-flash',              displayName: 'Gemini 2.5 Flash' },
          { modelCode: 'gemini-2.5-pro',                displayName: 'Gemini 2.5 Pro' },
          { modelCode: 'gemini-2.5-flash-lite',         displayName: 'Gemini 2.5 Flash-Lite (ประหยัด)' },
          // Image generation (Nano Banana)
          { modelCode: 'gemini-2.5-flash-image',        displayName: 'Nano Banana — สร้างภาพ (แนะนำ)' },
          // Video generation (Veo)
          { modelCode: 'veo-3.1-generate-preview',      displayName: 'Veo 3.1 — สร้างวิดีโอ' },
          { modelCode: 'veo-3.1-fast-generate-preview', displayName: 'Veo 3.1 Fast — วิดีโอเร็ว' },
          { modelCode: 'veo-3.1-lite-generate-preview', displayName: 'Veo 3.1 Lite — วิดีโอประหยัด' },
          // Audio / TTS
          { modelCode: 'gemini-2.5-flash-preview-tts',  displayName: 'Gemini 2.5 Flash TTS — เสียงพากย์' },
          { modelCode: 'gemini-3.1-flash-preview-tts',  displayName: 'Gemini 3.1 Flash TTS — เสียงพากย์ (ใหม่)' }
        ]
      }
    }
  });

  console.log('Seed complete: 4 AI providers (anthropic, openai, xai, google) with full model lineups.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
