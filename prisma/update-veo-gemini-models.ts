// prisma/update-veo-gemini-models.ts
// เพิ่ม Veo models ภายใต้ google provider (ใช้ AI Studio Key ธรรมดา)
// รัน: npx tsx prisma/update-veo-gemini-models.ts

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('อัปเดต Veo models สำหรับ Gemini API...\n')

  // ตรวจสอบว่า google provider มีอยู่
  const googleProvider = await prisma.aiProvider.findUnique({ where: { code: 'google' } })
  if (!googleProvider) {
    console.error('ไม่พบ google provider — รัน add-providers.ts ก่อน')
    return
  }

  // เพิ่ม/อัปเดต Veo video models ภายใต้ google provider
  const veoModels = [
    {
      modelCode:   'veo-3.1-generate-preview',
      displayName: 'Veo 3.1 — คุณภาพสูงสุด 4K (Gemini API Key)',
      capability:  'video',
      isActive:    true,
    },
    {
      modelCode:   'veo-3.1-fast-generate-preview',
      displayName: 'Veo 3.1 Fast — เร็ว / ประหยัด (Gemini API Key)',
      capability:  'video',
      isActive:    true,
    },
    {
      modelCode:   'veo-3.0-generate-preview',
      displayName: 'Veo 3.0 — รุ่นก่อนหน้า (Gemini API Key)',
      capability:  'video',
      isActive:    true,
    },
  ]

  for (const m of veoModels) {
    await prisma.aiModel.upsert({
      where: {
        providerCode_modelCode: { providerCode: 'google', modelCode: m.modelCode },
      },
      update: { displayName: m.displayName, isActive: m.isActive },
      create: { providerCode: 'google', ...m },
    })
    console.log(`✓ ${m.modelCode}`)
  }

  // ปิด google-vertex provider (ไม่ใช้แล้ว เปลี่ยนไปใช้ Gemini API แทน)
  await prisma.aiProvider.updateMany({
    where: { code: 'google-vertex' },
    data:  { isActive: false },
  })
  console.log('\n✓ ปิด google-vertex provider (ใช้ Gemini API แทนแล้ว)')

  console.log('\n✅ เสร็จแล้ว!')
  console.log('\n📌 ขั้นตอนถัดไป:')
  console.log('ไปที่ Connected AI → เพิ่ม Gemini API Key ธรรมดา')
  console.log('แล้วที่หน้า video-generate เลือก AI: Gemini และโมเดล Veo 3.1')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
