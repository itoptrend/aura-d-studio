// src/app/api/jobs/[id]/route.ts
// GET — polling endpoint
// DELETE — ยกเลิกงาน (เฉพาะ status = pending เท่านั้น)
// Next.js 16: async params

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentTeamId } from '@/lib/session'

// ---------------------------------------------------------------------------
// GET — polling
// ---------------------------------------------------------------------------

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params
  const teamId = await getCurrentTeamId()
  if (!teamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const job = await prisma.videoJob.findFirst({
    where: { id, teamId },
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

  return NextResponse.json({ ...job, progress: estimateProgress(job) })
}

// ---------------------------------------------------------------------------
// DELETE — ยกเลิกงาน
// ---------------------------------------------------------------------------

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params
  const teamId = await getCurrentTeamId()
  if (!teamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const job = await prisma.videoJob.findFirst({
    where:  { id, teamId },
    select: { id: true, status: true },
  })

  if (!job) return NextResponse.json({ error: 'ไม่พบงานนี้' }, { status: 404 })

  // running → ยกเลิกไม่ได้ แจ้งกลับไปให้ UI แสดง toast
  if (job.status === 'running') {
    return NextResponse.json(
      { error: 'กำลังสร้างวิดีโออยู่ กรุณารอสักครู่', cannotCancel: true },
      { status: 409 }
    )
  }

  // succeeded / failed / stalled / cancelled → ไม่จำเป็นต้องยกเลิก
  if (!['pending'].includes(job.status)) {
    return NextResponse.json(
      { error: 'งานนี้ไม่สามารถยกเลิกได้แล้ว' },
      { status: 409 }
    )
  }

  // pending → mark cancelled
  await prisma.videoJob.update({
    where: { id },
    data:  { status: 'cancelled', finishedAt: new Date() },
  })

  return NextResponse.json({ ok: true, status: 'cancelled' })
}

// ---------------------------------------------------------------------------
// Util
// ---------------------------------------------------------------------------

function estimateProgress(job: {
  status:       string
  startedAt:    Date | null
  durationSecs: number
}): number {
  switch (job.status) {
    case 'pending':   return 0
    case 'succeeded': return 100
    case 'failed':
    case 'cancelled':
    case 'stalled':   return 0
    case 'running': {
      if (!job.startedAt) return 5
      const elapsed   = Date.now() - job.startedAt.getTime()
      return Math.min(90, Math.round((elapsed / 180_000) * 85) + 5)
    }
    default: return 0
  }
}
