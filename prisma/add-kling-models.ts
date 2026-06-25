// prisma/add-kling-models.ts
// เพิ่ม / sync Kling video models + xAI video model ใน DB
// รัน: npx tsx prisma/add-kling-models.ts

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // ตรวจสอบว่า providers มีอยู่ครบ
  const klingProvider = await prisma.aiProvider.findUnique({ where: { code: 'kling' } })
  if (!klingProvider) {
    console.error('ไม่พบ kling provider ใน DB — รัน add-providers.ts ก่อน')
    return
  }

  const xaiProvider = await prisma.aiProvider.findUnique({ where: { code: 'xai' } })
  if (!xaiProvider) {
    console.error('ไม่พบ xai provider ใน DB — รัน add-providers.ts ก่อน')
    return
  }

  const googleProvider = await prisma.aiProvider.findUnique({ where: { code: 'google' } })
  if (!googleProvider) {
    console.error('ไม่พบ google provider ใน DB — รัน add-providers.ts ก่อน')
    return
  }

  const models = [
    // Kling video models
    { providerCode: 'kling', modelCode: 'kling-v2-5-pro',    displayName: 'Kling 2.5 Pro — วิดีโอคุณภาพสูง',       capability: 'video' },
    { providerCode: 'kling', modelCode: 'kling-v2-master',   displayName: 'Kling 2.0 Master — วิดีโอระดับ Master',  capability: 'video' },
    { providerCode: 'kling', modelCode: 'kling-v1-6-pro',    displayName: 'Kling 1.6 Pro — วิดีโอประหยัด',         capability: 'video' },
    // xAI Grok video model — ต้องตรงกับ modelCode ใน grok-video.ts
    { providerCode: 'xai', modelCode: 'grok-imagine-video-1.5', displayName: 'Grok Imagine Video 1.5 — สร้างวิดีโอ', capability: 'video' },
    // Google Veo 3.1 models (เผื่อ add-models.ts ยังไม่ได้รัน)
    { providerCode: 'google', modelCode: 'veo-3.1-generate-preview',      displayName: 'Veo 3.1 — สร้างวิดีโอ',        capability: 'video' },
    { providerCode: 'google', modelCode: 'veo-3.1-fast-generate-preview', displayName: 'Veo 3.1 Fast — วิดีโอเร็ว',    capability: 'video' },
    { providerCode: 'google', modelCode: 'veo-3.1-lite-generate-preview', displayName: 'Veo 3.1 Lite — วิดีโอประหยัด', capability: 'video' },
  ]

  for (const m of models) {
    await prisma.aiModel.upsert({
      where: {
        providerCode_modelCode: { providerCode: m.providerCode, modelCode: m.modelCode },
      },
      update: { displayName: m.displayName, capability: m.capability, isActive: true },
      create: { ...m, isActive: true },
    })
    console.log(`✓ [${m.capability}] ${m.providerCode}/${m.modelCode}`)
  }

  console.log('\nเสร็จแล้ว!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
