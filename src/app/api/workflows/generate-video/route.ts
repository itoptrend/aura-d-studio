// src/app/api/workflows/generate-video/run/route.ts
// POST — รับ form data → validate → rate limit → enqueue → return jobId

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentTeamId } from '@/lib/session'
import { getVideoQueue } from '@/lib/queue/videoQueue'

// ---------------------------------------------------------------------------
// ขีดจำกัดต่อ team
// ---------------------------------------------------------------------------
const MAX_ACTIVE_JOBS = 3

export async function POST(req: Request): Promise<NextResponse> {
  // — Auth
  const teamId = await getCurrentTeamId()
  if (!teamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // — Parse body
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const {
    prompt,
    negativePrompt,
    durationSecs = 8,
    aspectRatio  = '16:9',
    provider     = 'google',
    modelCode    = 'veo-3.0-generate-preview',
    credentialId,
  } = body as {
    prompt:          string
    negativePrompt?: string
    durationSecs?:   number
    aspectRatio?:    string
    provider?:       string
    modelCode?:      string
    credentialId:    string
  }

  // — Validate
  if (!prompt?.trim()) {
    return NextResponse.json({ error: 'กรุณาใส่ prompt' }, { status: 400 })
  }
  if (!credentialId) {
    return NextResponse.json({ error: 'กรุณาเลือก AI Key' }, { status: 400 })
  }

  // — Rate limit: max 3 active jobs per team
  const activeCount = await prisma.videoJob.count({
    where: {
      teamId,
      status: { in: ['pending', 'running'] },
    },
  })

  if (activeCount >= MAX_ACTIVE_JOBS) {
    return NextResponse.json(
      { error: `มีงานวิดีโอรออยู่แล้ว ${activeCount} งาน — กรุณารอให้เสร็จก่อนสร้างงานใหม่` },
      { status: 429 }
    )
  }

  // — ตรวจ credential เป็นของ team จริง
  const credential = await prisma.credential.findFirst({
    where: { id: credentialId, teamId },
  })
  if (!credential) {
    return NextResponse.json({ error: 'ไม่พบ API Key ที่ระบุ' }, { status: 404 })
  }

  // — สร้าง VideoJob record ใน DB
  const videoJob = await prisma.videoJob.create({
    data: {
      teamId,
      provider:      provider as any,
      modelCode,
      prompt:        prompt.trim(),
      negativePrompt: negativePrompt?.trim() || null,
      durationSecs:  Number(durationSecs),
      aspectRatio,
      credentialId,
      status:        'pending',
    },
  })

  // — Enqueue ใน BullMQ
  const queue = getVideoQueue()
  await queue.add(
    'generate-video',
    {
      videoJobId:    videoJob.id,
      teamId,
      provider:      provider as any,
      modelCode,
      prompt:        prompt.trim(),
      negativePrompt: negativePrompt?.trim(),
      durationSecs:  Number(durationSecs),
      aspectRatio,
      credentialId,
    },
    {
      jobId: videoJob.id,  // idempotent — ป้องกัน double-enqueue
    }
  )

  return NextResponse.json({
    jobId:  videoJob.id,
    status: 'pending',
  }, { status: 202 })
}
