// prisma/add-vertex-provider.ts
// เพิ่ม google-vertex provider + Veo 3.1 models ใน DB
// รัน: npx tsx prisma/add-vertex-provider.ts

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // เพิ่ม google-vertex provider
  await prisma.aiProvider.upsert({
    where: { code: 'google-vertex' },
    update: { displayName: 'Google Vertex AI (Veo)', capabilities: ['video'], isActive: true },
    create: {
      code:         'google-vertex',
      displayName:  'Google Vertex AI (Veo)',
      capabilities: ['video'],
      keyPrefixHint: null,  // ไม่มี prefix — เป็น JSON
      isActive:     true,
    },
  })
  console.log('✓ provider: google-vertex')

  // เพิ่ม Veo models ภายใต้ google-vertex
  const models = [
    {
      providerCode: 'google-vertex',
      modelCode:    'veo-3.1-generate-preview',
      displayName:  'Veo 3.1 — คุณภาพสูงสุด (720p–4K)',
      capability:   'video',
    },
    {
      providerCode: 'google-vertex',
      modelCode:    'veo-3.1-fast-generate-preview',
      displayName:  'Veo 3.1 Fast — เร็ว / ประหยัด',
      capability:   'video',
    },
    {
      providerCode: 'google-vertex',
      modelCode:    'veo-3.0-generate-preview',
      displayName:  'Veo 3.0 — รุ่นก่อนหน้า',
      capability:   'video',
    },
  ]

  for (const m of models) {
    await prisma.aiModel.upsert({
      where: {
        providerCode_modelCode: { providerCode: m.providerCode, modelCode: m.modelCode },
      },
      update: { displayName: m.displayName, capability: m.capability, isActive: true },
      create: { ...m, isActive: true },
    })
    console.log(`✓ model: ${m.modelCode}`)
  }

  console.log('\n✅ เสร็จแล้ว!')
  console.log('\n📌 ขั้นตอนถัดไป:')
  console.log('1. ไปที่ Connected AI → Add API Key')
  console.log('2. เลือก Provider: "Google Vertex AI (Veo)"')
  console.log('3. Paste Service Account Key JSON ทั้งหมด (ไม่ใช่ API Key ธรรมดา)')
  console.log('   รูปแบบ: { "type": "service_account", "project_id": "...", "private_key": "...", ... }')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
