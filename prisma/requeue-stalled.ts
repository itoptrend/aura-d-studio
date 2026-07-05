// prisma/requeue-stalled.ts
// ปลุกงาน openrouter ที่ค้าง (stalled) กลับเป็น running เพื่อให้ cron ไป poll ต่อ
// ใช้กรณีวิดีโอ generate เสร็จแล้วฝั่ง OpenRouter แต่ระบบดาวน์โหลดพลาด
// (วิดีโอยังอยู่ ~48 ชม. — ปลุกให้ทันก่อนหมดอายุ จะได้ไม่ต้องเสียเงินสร้างใหม่)
//
// วิธีรัน:  npx tsx prisma/requeue-stalled.ts

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const stalled = await prisma.videoJob.findMany({
    where: {
      status:        'stalled',
      provider:      'openrouter',
      providerJobId: { not: null },
      blobUrl:       null,
    },
    select: { id: true, prompt: true, providerJobId: true, createdAt: true },
  })

  if (stalled.length === 0) {
    console.log('ไม่พบงาน stalled ที่ปลุกได้')
    return
  }

  console.log(`พบ ${stalled.length} งานที่จะปลุกกลับเข้าคิว poll:`)
  for (const j of stalled) {
    console.log(`  - ${j.prompt.slice(0, 55)}  (${j.createdAt.toISOString().slice(0, 16)})`)
  }

  // กลับเป็น running + reset startedAt กันโดนมาร์ค stalled ซ้ำทันที
  const result = await prisma.videoJob.updateMany({
    where: { id: { in: stalled.map(j => j.id) } },
    data:  { status: 'running', startedAt: new Date(), stalledAt: null },
  })

  console.log(`\n✓ ปลุกแล้ว ${result.count} งาน — cron จะ poll ภายใน 1 นาที`)
  console.log('รอ 1-2 นาทีแล้วเช็คคลังไฟล์ (ปุ่มกรอง 🎬 วิดีโอ) ได้เลย')
}

main().catch(console.error).finally(() => prisma.$disconnect())
