// Seeds the AI Provider Registry (spec §5.5) with the Phase 1 provider list:
// Claude, GPT, 1 image-gen, 1 video-gen. Run with: npm run db:seed

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
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
          { modelCode: 'claude-opus-4-7', displayName: 'Claude Opus 4.7' },
          { modelCode: 'claude-sonnet-4-6', displayName: 'Claude Sonnet 4.6' },
          { modelCode: 'claude-haiku-4-5-20251001', displayName: 'Claude Haiku 4.5' }
        ]
      }
    }
  });

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
          { modelCode: 'gpt-4.1', displayName: 'GPT-4.1' },
          { modelCode: 'gpt-4.1-mini', displayName: 'GPT-4.1 Mini' }
        ]
      }
    }
  });

  await prisma.aiProvider.upsert({
    where: { code: 'google' },
    update: {},
    create: {
      code: 'google',
      displayName: 'Google Gemini',
      capabilities: ['text', 'vision', 'video'],
      keyPrefixHint: 'AIza',
      models: {
        create: [{ modelCode: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro' }]
      }
    }
  });

  console.log('Seed complete: 3 AI providers (anthropic, openai, google) with models.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
