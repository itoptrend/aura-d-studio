// prisma/check-jobs.ts
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const jobs = await prisma.videoJob.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id:           true,
      status:       true,
      provider:     true,
      modelCode:    true,
      attempts:     true,
      errorMessage: true,
      errorCode:    true,
      createdAt:    true,
      startedAt:    true,
      providerJobId: true,
    },
  })

  if (jobs.length === 0) {
    console.log('ไม่มี VideoJob ในฐานข้อมูลเลย')
  } else {
    console.log(`พบ ${jobs.length} jobs:\n`)
    jobs.forEach((j, i) => {
      console.log(`[${i + 1}] ${j.id}`)
      console.log(`    status:   ${j.status}`)
      console.log(`    provider: ${j.provider} / ${j.modelCode}`)
      console.log(`    attempts: ${j.attempts}`)
      console.log(`    error:    ${j.errorMessage ?? '-'}`)
      console.log(`    created:  ${j.createdAt.toISOString()}`)
      console.log(`    providerJobId: ${j.providerJobId ?? '-'}`)
      console.log()
    })
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
