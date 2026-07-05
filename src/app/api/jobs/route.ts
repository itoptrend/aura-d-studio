// src/app/api/jobs/route.ts
// GET — รายการงานวิดีโอล่าสุดของทีม (10 รายการ)
// ใช้แสดง "งานของฉัน" ในหน้าสร้างวิดีโอ เพื่อให้ผู้ใช้กลับมาดูงานที่ค้างอยู่ได้
// แม้จะสลับหน้าไปมา — งานประมวลผลฝั่งเซิร์ฟเวอร์ ไม่หายไปไหน

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentTeamId } from '@/lib/session'

export async function GET(): Promise<NextResponse> {
  const teamId = await getCurrentTeamId()
  if (!teamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const jobs = await prisma.videoJob.findMany({
    where:   { teamId },
    orderBy: { createdAt: 'desc' },
    take:    10,
    select: {
      id:           true,
      status:       true,
      modelCode:    true,
      prompt:       true,
      assetId:      true,
      errorMessage: true,
      createdAt:    true,
    },
  })

  return NextResponse.json({ jobs })
}
