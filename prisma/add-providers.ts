import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const providers = [
    { code: 'xai',        displayName: 'xAI Grok',   capabilities: ['text','vision','image','video'], keyPrefixHint: 'xai-' },
    { code: 'elevenlabs', displayName: 'ElevenLabs',  capabilities: ['audio'],  keyPrefixHint: null },
    { code: 'kling',      displayName: 'Kling AI',    capabilities: ['video'],  keyPrefixHint: null },
    { code: 'runway',     displayName: 'Runway',      capabilities: ['video'],  keyPrefixHint: null },
  ];
  for (const prov of providers) {
    await prisma.aiProvider.upsert({
      where: { code: prov.code },
      update: {},
      create: { ...prov, isActive: true }
    });
    console.log('✓ เพิ่มแล้ว:', prov.displayName);
  }
  console.log('\nเสร็จแล้ว!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });