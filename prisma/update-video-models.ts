// prisma/update-video-models.ts
// อัปเดต video model codes ให้ตรงกับ API จริง
// รัน: npx tsx prisma/update-video-models.ts

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('อัปเดต video models...\n')

  // ============================================================
  // Kling models — ใช้ model codes ที่ถูกต้องตาม Kling API
  // Supported: kling-v1, kling-v1-5, kling-v1-6, kling-v2-master,
  //            kling-v2-1, kling-v2-1-master, kling-v2-5-turbo, kling-v2-6, kling-v3
  // ============================================================

  const klingModels = [
    {
      old:         'kling-v2-5-pro',
      modelCode:   'kling-v2-5-pro',      // ยังเก็บ code เดิมไว้ใน DB
      displayName: 'Kling 2.5 Turbo Pro — วิดีโอ 720p คุณภาพสูง',
      capability:  'video',
    },
    {
      old:         'kling-v2-master',
      modelCode:   'kling-v2-master',
      displayName: 'Kling 2.0 Master — วิดีโอ 1080p ระดับ Master',
      capability:  'video',
    },
    {
      old:         'kling-v1-6-pro',
      modelCode:   'kling-v1-6-pro',
      displayName: 'Kling 1.6 Pro — วิดีโอ 720p ประหยัด',
      capability:  'video',
    },
  ]

  for (const m of klingModels) {
    const result = await prisma.aiModel.updateMany({
      where: { providerCode: 'kling', modelCode: m.modelCode },
      data:  { displayName: m.displayName, isActive: true },
    })
    if (result.count === 0) {
      await prisma.aiModel.create({
        data: {
          providerCode: 'kling',
          modelCode:    m.modelCode,
          displayName:  m.displayName,
          capability:   m.capability,
          isActive:     true,
        },
      })
      console.log(`✓ created: kling/${m.modelCode}`)
    } else {
      console.log(`✓ updated: kling/${m.modelCode}`)
    }
  }

  // ============================================================
  // xAI models — แก้ grok-imagine-video-1.5 (ใช้ text-to-video ไม่ได้)
  // ใช้ grok-imagine-video สำหรับ text-to-video
  // ============================================================

  // ปิด grok-imagine-video-1.5 (image-to-video only)
  await prisma.aiModel.updateMany({
    where: { providerCode: 'xai', modelCode: 'grok-imagine-video-1.5' },
    data:  {
      displayName: 'Grok Imagine Video 1.5 (image-to-video เท่านั้น)',
      isActive:    false,  // ปิดก่อน เพราะใช้กับ text-to-video ไม่ได้
    },
  })
  console.log('✓ deactivated: xai/grok-imagine-video-1.5 (ไม่รองรับ text-to-video)')

  // เพิ่ม/อัปเดต grok-imagine-video (text-to-video หลัก)
  await prisma.aiModel.upsert({
    where: { providerCode_modelCode: { providerCode: 'xai', modelCode: 'grok-imagine-video' } },
    update: {
      displayName: 'Grok Imagine Video — สร้างวิดีโอ (สูงสุด 15 วินาที)',
      capability:  'video',
      isActive:    true,
    },
    create: {
      providerCode: 'xai',
      modelCode:    'grok-imagine-video',
      displayName:  'Grok Imagine Video — สร้างวิดีโอ (สูงสุด 15 วินาที)',
      capability:   'video',
      isActive:     true,
    },
  })
  console.log('✓ upserted: xai/grok-imagine-video')

  console.log('\n✅ เสร็จแล้ว!')
  console.log('\n📌 หมายเหตุ Kling:')
  console.log('- duration รองรับแค่ "5" หรือ "10" วินาที (ไม่รองรับ "8")')
  console.log('- ค่า 8 วินาทีจะถูก map เป็น 10 วินาที อัตโนมัติในโค้ด')
  console.log('\n📌 หมายเหตุ xAI:')
  console.log('- ใช้ grok-imagine-video สำหรับ text-to-video')
  console.log('- grok-imagine-video-1.5 รองรับเฉพาะ image-to-video (ปิดไว้ก่อน)')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
