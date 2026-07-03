// prisma/add-openrouter-provider.ts
// เพิ่ม OpenRouter provider + Kling video models ที่ใช้งานผ่าน OpenRouter
// รัน: npx tsx prisma/add-openrouter-provider.ts

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // เพิ่ม openrouter provider
  await prisma.aiProvider.upsert({
    where:  { code: 'openrouter' },
    update: { displayName: 'OpenRouter (Kling / Veo)', capabilities: ['video'], isActive: true },
    create: {
      code:         'openrouter',
      displayName:  'OpenRouter (Kling / Veo)',
      capabilities: ['video'],
      isActive:     true,
    },
  })
  console.log('✓ provider: openrouter')

  // เพิ่ม video models
  const models = [
    {
      modelCode:   'openrouter/kling-v3-pro',
      displayName: 'Kling v3.0 Pro — คุณภาพสูง 720p ($0.168/วินาที)',
      capability:  'video',
    },
    {
      modelCode:   'openrouter/kling-v3-standard',
      displayName: 'Kling v3.0 Standard — มาตรฐาน 720p ($0.126/วินาที)',
      capability:  'video',
    },
    {
      modelCode:   'openrouter/kling-video-o1',
      displayName: 'Kling Video O1 — Cinematic ($0.112/วินาที)',
      capability:  'video',
    },
  ]

  for (const m of models) {
    await prisma.aiModel.upsert({
      where: { providerCode_modelCode: { providerCode: 'openrouter', modelCode: m.modelCode } },
      update: { displayName: m.displayName, isActive: true },
      create: { providerCode: 'openrouter', ...m, isActive: true },
    })
    console.log(`✓ model: ${m.modelCode}`)
  }

  console.log('\n✅ เสร็จแล้ว!')
  console.log('\n📌 ขั้นตอนถัดไป:')
  console.log('1. ไปที่ Connected AI → Add API Key')
  console.log('2. เลือก Provider: "OpenRouter (Kling / Veo)"')
  console.log('3. ใส่ OpenRouter API Key (sk-or-v1-...)')
  console.log('4. ไปที่ สร้างวิดีโอ AI → เลือก AI: OpenRouter → เลือกโมเดล Kling')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
