// src/app/api/workflows/generate-video/run/route.ts
// POST — รับ form data จาก /video-generate → สร้าง VideoJob ใน DB → enqueue BullMQ → return jobId

import { NextResponse } from 'next/server'
import { prisma }        from '@/lib/db'
import { getCurrentTeamId } from '@/lib/session'
import { getVideoQueue }    from '@/lib/queue/videoQueue'
import type { VideoJobPayload } from '@/lib/queue/videoQueue'

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

export async function POST(req: Request): Promise<NextResponse> {
  const teamId = await getCurrentTeamId()
  if (!teamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // — Parse body
  let body: {
    prompt:          string
    negativePrompt?: string
    aspectRatio:     string
    durationSecs:    number
    credentialId:    string
    provider:        string
    modelCode:       string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { prompt, negativePrompt, aspectRatio, durationSecs, credentialId, provider, modelCode } = body

  // — Validation
  if (!prompt?.trim())    return NextResponse.json({ error: 'กรุณาใส่ prompt'   }, { status: 400 })
  if (!credentialId)      return NextResponse.json({ error: 'กรุณาเลือก AI Key' }, { status: 400 })
  if (!modelCode?.trim()) return NextResponse.json({ error: 'กรุณาเลือกโมเดล'  }, { status: 400 })
  if (!provider?.trim())  return NextResponse.json({ error: 'ไม่ระบุ provider'  }, { status: 400 })

  // — ตรวจ credential เป็นของ team นี้จริงๆ และ status = active
  const credential = await prisma.credential.findFirst({
    where: { id: credentialId, teamId, status: 'active' },
    select: { id: true, providerCode: true },
  })
  if (!credential) {
    return NextResponse.json(
      { error: 'ไม่พบ API Key หรือ Key ไม่ active — กรุณาตรวจสอบที่ Connected AI' },
      { status: 404 }
    )
  }

  // — สร้าง VideoJob record ใน DB
  const videoJob = await prisma.videoJob.create({
    data: {
      teamId,
      provider:       credential.providerCode,   // ใช้จาก DB เสมอ (ปลอดภัยกว่า client)
      modelCode,
      prompt:         prompt.trim(),
      negativePrompt: negativePrompt?.trim() || null,
      aspectRatio:    aspectRatio ?? '16:9',
      durationSecs:   Number(durationSecs) || 8,
      credentialId,
      status:         'pending',
    },
  })

  // — Enqueue งานเข้า BullMQ
  const queue = getVideoQueue()

  const payload: VideoJobPayload = {
    videoJobId:     videoJob.id,
    teamId,
    provider:       credential.providerCode as VideoJobPayload['provider'],
    modelCode,
    prompt:         prompt.trim(),
    negativePrompt: negativePrompt?.trim() || undefined,
    aspectRatio:    aspectRatio ?? '16:9',
    durationSecs:   Number(durationSecs) || 8,
    credentialId,
  }

  await queue.add('generate-video', payload, {
    jobId: videoJob.id,   // ใช้ videoJobId เป็น BullMQ job ID ด้วย
  })

  return NextResponse.json({ jobId: videoJob.id })
}
