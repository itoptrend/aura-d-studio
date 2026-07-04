// src/app/api/workflows/lip-sync/run/route.ts
// POST — สร้างงาน Lip Sync: เอาวิดีโอที่มีอยู่ + เสียงพูด (หรือข้อความ en/zh)
// → Kling ขยับปากตัวละครให้ตรงเสียง → ผลลัพธ์เข้าคลังไฟล์เหมือนวิดีโอปกติ
//
// รับได้ 2 แบบต่อสื่อแต่ละชนิด:
//   วิดีโอ: videoAssetId (จากคลังไฟล์) หรือ videoUrl (ลิงก์สาธารณะ)
//   เสียง:  audioAssetId (จากหน้า "สร้างเสียง") หรือ audioUrl หรือ text (en/zh, ≤120 ตัวอักษร)
// เสียงจากคลังถูกเก็บเป็น data URL → ระบบอัปโหลดเข้า Blob ให้เป็นลิงก์สาธารณะอัตโนมัติ

import { NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { prisma } from '@/lib/db'
import { getCurrentTeamId } from '@/lib/session'

export async function POST(req: Request): Promise<NextResponse> {
  const teamId = await getCurrentTeamId()
  if (!teamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    videoAssetId?: string
    videoUrl?:     string
    audioAssetId?: string
    audioUrl?:     string
    text?:         string
    credentialId:  string
  }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { videoAssetId, videoUrl, audioAssetId, audioUrl, text, credentialId } = body

  if (!credentialId) return NextResponse.json({ error: 'กรุณาเลือก Kling API Key' }, { status: 400 })

  // ต้องมีวิดีโอต้นทาง
  let finalVideoUrl = videoUrl?.trim() || null
  if (!finalVideoUrl && videoAssetId) {
    const va = await prisma.asset.findFirst({
      where: { id: videoAssetId, teamId, type: 'video' },
      select: { fileUrl: true },
    })
    finalVideoUrl = va?.fileUrl ?? null
  }
  if (!finalVideoUrl) {
    return NextResponse.json({ error: 'กรุณาเลือกวิดีโอจากคลังไฟล์ หรือใส่ลิงก์วิดีโอ' }, { status: 400 })
  }

  // ต้องมีเสียง (ไฟล์/ลิงก์/ข้อความ) อย่างใดอย่างหนึ่ง
  let finalAudioUrl = audioUrl?.trim() || null
  const finalText   = text?.trim() || null

  if (!finalAudioUrl && audioAssetId) {
    const aa = await prisma.asset.findFirst({
      where: { id: audioAssetId, teamId, type: 'audio' },
      select: { contentText: true, title: true },
    })
    if (!aa?.contentText?.startsWith('data:audio')) {
      return NextResponse.json({ error: 'ไฟล์เสียงที่เลือกไม่ถูกต้อง' }, { status: 400 })
    }
    // แปลง data URL → ไฟล์จริงบน Blob (Kling ต้องการลิงก์สาธารณะ)
    const [meta, b64] = aa.contentText.split(',')
    const mime = meta.match(/data:(audio\/[^;]+)/)?.[1] ?? 'audio/mpeg'
    const ext  = mime.includes('wav') ? 'wav' : mime.includes('mp4') || mime.includes('m4a') ? 'm4a' : 'mp3'
    const buf  = Buffer.from(b64, 'base64')
    if (buf.length > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'ไฟล์เสียงใหญ่เกิน 5MB (ข้อจำกัดของ Kling Lip Sync)' }, { status: 400 })
    }
    const blob = await put(`lipsync-audio/${audioAssetId}.${ext}`, buf, {
      access: 'public', contentType: mime,
    })
    finalAudioUrl = blob.url
  }

  if (!finalAudioUrl && !finalText) {
    return NextResponse.json({ error: 'กรุณาเลือกไฟล์เสียง หรือพิมพ์ข้อความ (en/zh) อย่างใดอย่างหนึ่ง' }, { status: 400 })
  }

  // ตรวจ credential — Lip Sync ใช้ Kling official API เท่านั้น
  const credential = await prisma.credential.findFirst({
    where: { id: credentialId, teamId, status: 'active', providerCode: 'kling' },
    select: { id: true },
  })
  if (!credential) {
    return NextResponse.json(
      { error: 'Lip Sync ต้องใช้ API Key ของ Kling AI (official) — เพิ่มได้ที่ Connected AI' },
      { status: 404 }
    )
  }

  const videoJob = await prisma.videoJob.create({
    data: {
      teamId,
      provider:      'kling',
      modelCode:     'kling-lip-sync',
      prompt:        finalText ?? 'Lip Sync (audio mode)',
      inputVideoUrl: finalVideoUrl,
      inputAudioUrl: finalAudioUrl,
      durationSecs:  5,
      aspectRatio:   '16:9',
      credentialId,
      status:        'pending',
    },
  })

  return NextResponse.json({ jobId: videoJob.id })
}
