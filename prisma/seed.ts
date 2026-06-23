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
          { modelCode: 'claude-opus-4-7',           displayName: 'Claude Opus 4.7 (สูงสุด)',      capability: 'text' },
          { modelCode: 'claude-opus-4-6',           displayName: 'Claude Opus 4.6',               capability: 'text' },
          { modelCode: 'claude-sonnet-4-6',         displayName: 'Claude Sonnet 4.6 (แนะนำ)',      capability: 'text' },
          { modelCode: 'claude-haiku-4-5-20251001', displayName: 'Claude Haiku 4.5 (เร็ว/ประหยัด)', capability: 'text' }
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
      capabilities: ['text', 'vision', 'image', 'audio'],
      keyPrefixHint: 'sk-',
      models: {
        create: [
          { modelCode: 'gpt-4.1',      displayName: 'GPT-4.1 (สูงสุด)',          capability: 'text'  },
          { modelCode: 'gpt-4.1-mini', displayName: 'GPT-4.1 Mini (ประหยัด)',    capability: 'text'  },
          { modelCode: 'gpt-4o',       displayName: 'GPT-4o',                    capability: 'text'  },
          { modelCode: 'o3',           displayName: 'o3 (Reasoning)',             capability: 'text'  },
          { modelCode: 'o4-mini',      displayName: 'o4 Mini (Reasoning เร็ว)',   capability: 'text'  },
          { modelCode: 'tts-1',        displayName: 'TTS-1 — เสียงพากย์เร็ว',    capability: 'audio' },
          { modelCode: 'tts-1-hd',     displayName: 'TTS-1 HD — เสียงคุณภาพสูง', capability: 'audio' }
        ]
      }
    }
  });

  // ─── XAI GROK ───────────────────────────────────────────────────────────────
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
          { modelCode: 'grok-4.3',               displayName: 'Grok 4.3 (แนะนำ)',              capability: 'text'  },
          { modelCode: 'grok-4.20',              displayName: 'Grok 4.20 (Reasoning)',          capability: 'text'  },
          { modelCode: 'grok-4',                 displayName: 'Grok 4',                         capability: 'text'  },
          { modelCode: 'grok-imagine-image-pro', displayName: 'Grok Imagine — สร้างภาพ',        capability: 'image' },
          { modelCode: 'grok-imagine-video-1.5', displayName: 'Grok Imagine Video 1.5 — วิดีโอ', capability: 'video' }
        ]
      }
    }
  });

  // ─── GOOGLE ─────────────────────────────────────────────────────────────────
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
          { modelCode: 'gemini-3.5-flash',              displayName: 'Gemini 3.5 Flash (ใหม่ล่าสุด)',   capability: 'text'  },
          { modelCode: 'gemini-3.1-pro-preview',        displayName: 'Gemini 3.1 Pro Preview',          capability: 'text'  },
          { modelCode: 'gemini-3-flash',                displayName: 'Gemini 3 Flash (แนะนำ)',           capability: 'text'  },
          { modelCode: 'gemini-2.5-flash',              displayName: 'Gemini 2.5 Flash',                capability: 'text'  },
          { modelCode: 'gemini-2.5-pro',                displayName: 'Gemini 2.5 Pro',                  capability: 'text'  },
          { modelCode: 'gemini-2.5-flash-lite',         displayName: 'Gemini 2.5 Flash-Lite (ประหยัด)', capability: 'text'  },
          // Image
          { modelCode: 'gemini-2.5-flash-image',        displayName: 'Nano Banana — สร้างภาพ',          capability: 'image' },
          // Video (Veo)
          { modelCode: 'veo-3.1-generate-preview',      displayName: 'Veo 3.1 — สร้างวิดีโอ',           capability: 'video' },
          { modelCode: 'veo-3.1-fast-generate-preview', displayName: 'Veo 3.1 Fast — วิดีโอเร็ว',       capability: 'video' },
          { modelCode: 'veo-3.1-lite-generate-preview', displayName: 'Veo 3.1 Lite — วิดีโอประหยัด',    capability: 'video' },
          // Audio / TTS
          { modelCode: 'gemini-2.5-flash-preview-tts',  displayName: 'Gemini 2.5 Flash TTS — เสียงพากย์',      capability: 'audio' },
          { modelCode: 'gemini-3.1-flash-preview-tts',  displayName: 'Gemini 3.1 Flash TTS — เสียงพากย์ (ใหม่)', capability: 'audio' }
        ]
      }
    }
  });

  console.log('Seed complete: 4 AI providers with capability-tagged models.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
