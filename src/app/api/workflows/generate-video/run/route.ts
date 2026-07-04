// src/app/api/workflows/generate-video/run/route.ts
// POST — รับ form data จาก /video-generate → สร้าง VideoJob (status: pending) ใน DB
// จากนั้น Vercel Cron (/api/cron/process-video-jobs) จะหยิบไปประมวลผลเอง
// *ไม่ใช้ BullMQ/Redis แล้ว* — บน Vercel serverless ไม่มี worker process รันค้างไว้

import { NextResponse } from 'next/server'
import { prisma }        from '@/lib/db'
import { getCurrentTeamId } from '@/lib/session'
import { snapDuration } from '@/lib/videoModelCaps'


export async function POST(req: Request): Promise<NextResponse> {
  const teamId = await getCurrentTeamId()
  if (!teamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

  const { prompt, negativePrompt, aspectRatio, durationSecs, credentialId, modelCode } = body

  if (!prompt?.trim())    return NextResponse.json({ error: 'กรุณาใส่ prompt'   }, { status: 400 })
  if (!credentialId)      return NextResponse.json({ error: 'กรุณาเลือก AI Key' }, { status: 400 })
  if (!modelCode?.trim()) return NextResponse.json({ error: 'กรุณาเลือกโมเดล'  }, { status: 400 })

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

  // ปรับ duration ให้ตรงกับที่โมเดลรองรับ (ตารางเดียวกับที่ UI ใช้แสดงปุ่ม)
  const safeDuration = snapDuration(
    credential.providerCode,
    modelCode,
    Number(durationSecs) || 8
  )

  const videoJob = await prisma.videoJob.create({
    data: {
      teamId,
      provider:       credential.providerCode,   // ใช้จาก DB เสมอ (ปลอดภัยกว่า client)
      modelCode,
      prompt:         prompt.trim(),
      negativePrompt: negativePrompt?.trim() || null,
      aspectRatio:    aspectRatio ?? '16:9',
      durationSecs:   safeDuration,
      credentialId,
      status:         'pending',
    },
  })

  return NextResponse.json({ jobId: videoJob.id })
}
