// prisma/add-kling-models.ts
// เพิ่ม Kling video models + xAI video model ใน DB
// รัน: npx tsx prisma/add-kling-models.ts

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // ตรวจสอบว่า kling provider มีอยู่ไหม
  const klingProvider = await prisma.aiProvider.findUnique({ where: { code: 'kling' } })
  if (!klingProvider) {
    console.error('ไม่พบ kling provider ใน DB')
    return
  }

  const xaiProvider = await prisma.aiProvider.findUnique({ where: { code: 'xai' } })
  if (!xaiProvider) {
    console.error('ไม่พบ xai provider ใน DB')
    return
  }

  // Kling video models
  const klingModels = [
    { providerCode: 'kling', modelCode: 'kling-v2-5-pro',    displayName: 'Kling 2.5 Pro — วิดีโอคุณภาพสูง',   capability: 'video' },
    { providerCode: 'kling', modelCode: 'kling-v2-master',   displayName: 'Kling 2.0 Master — วิดีโอระดับ Master', capability: 'video' },
    { providerCode: 'kling', modelCode: 'kling-v1-6-pro',    displayName: 'Kling 1.6 Pro — วิดีโอประหยัด',    capability: 'video' },
  ]

  // xAI Grok video model
  const xaiVideoModels = [
    { providerCode: 'xai', modelCode: 'grok-imagine-video', displayName: 'Grok Imagine Video — สร้างวิดีโอ', capability: 'video' },
  ]

  const allModels = [...klingModels, ...xaiVideoModels]

  for (const m of allModels) {
    const existing = await prisma.aiModel.findFirst({
      where: { providerCode: m.providerCode, modelCode: m.modelCode }
    })
    if (existing) {
      console.log(`✓ already exists: ${m.modelCode}`)
      continue
    }
    await prisma.aiModel.create({ data: { ...m, isActive: true } })
    console.log(`✓ added: ${m.modelCode}`)
  }

  console.log('\nเสร็จแล้ว!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
