// src/app/api/jobs/[id]/route.ts
// GET — polling endpoint สำหรับ client ตรวจสอบสถานะ VideoJob
// Next.js 16: async params

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentTeamId } from '@/lib/session'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params

  const teamId = await getCurrentTeamId()
  if (!teamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const job = await prisma.videoJob.findFirst({
    where: { id, teamId },  // scoped ตาม team — ป้องกัน IDOR
    select: {
      id:           true,
      status:       true,
      provider:     true,
      modelCode:    true,
      prompt:       true,
      aspectRatio:  true,
      durationSecs: true,
      blobUrl:      true,
      assetId:      true,
      errorMessage: true,
      errorCode:    true,
      attempts:     true,
      maxAttempts:  true,
      createdAt:    true,
      startedAt:    true,
      finishedAt:   true,
    },
  })

  if (!job) return NextResponse.json({ error: 'ไม่พบงานนี้' }, { status: 404 })

  // คำนวณ progress โดยประมาณจาก status + เวลาที่ผ่านไป
  const progress = estimateProgress(job)

  return NextResponse.json({
    ...job,
    progress,  // 0–100
  })
}

// ---------------------------------------------------------------------------
// ประมาณ progress จาก status + elapsed time
// ---------------------------------------------------------------------------

function estimateProgress(job: {
  status:    string
  startedAt: Date | null
  durationSecs: number
}): number {
  switch (job.status) {
    case 'pending':   return 0
    case 'succeeded': return 100
    case 'failed':    return 0
    case 'cancelled': return 0
    case 'stalled':   return 0
    case 'running': {
      if (!job.startedAt) return 5
      const elapsed = Date.now() - job.startedAt.getTime()
      // Veo ใช้เวลาประมาณ 2–4 นาที — estimate จาก elapsed / 3 นาที
      const estimated = Math.min(90, Math.round((elapsed / 180_000) * 85) + 5)
      return estimated
    }
    default: return 0
  }
}
