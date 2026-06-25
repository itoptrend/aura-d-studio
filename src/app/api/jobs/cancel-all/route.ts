// src/app/api/jobs/cancel-all/route.ts
// DELETE — ยกเลิก pending jobs ทั้งหมดของ team

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentTeamId } from '@/lib/session'

export async function DELETE(): Promise<NextResponse> {
  const teamId = await getCurrentTeamId()
  if (!teamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await prisma.videoJob.updateMany({
    where: {
      teamId,
      status: { in: ['pending'] }, // running ยกเลิกไม่ได้
    },
    data: {
      status:     'cancelled',
      finishedAt: new Date(),
    },
  })

  return NextResponse.json({ cancelled: result.count })
}
