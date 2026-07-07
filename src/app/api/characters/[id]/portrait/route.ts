// src/app/api/characters/[id]/portrait/route.ts
// POST   — สร้างภาพตัวละครจากข้อมูลรูปลักษณ์+บุคลิกที่กำหนดไว้ (AI image generation)
//          เรียกซ้ำได้เรื่อยๆ ถ้ายังไม่ถูกใจ (ภาพใหม่ทับภาพเก่า) — ถูกใจแล้วก็หยุด
// DELETE — ลบภาพตัวละครทิ้ง (ข้อมูลตัวละครอื่นๆ อยู่ครบ)
//
// ภาพเก็บถาวรกับตัวละคร (ไม่เข้าระบบหมดอายุ 7 วันของคลังไฟล์)

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentTeamId } from '@/lib/session'
import { decryptSecret } from '@/lib/encryption'
import { generateImage } from '@/lib/ai/imagen'

/** ประกอบ prompt ภาพจากข้อมูลตัวละคร — หน้าตาสอดคล้องกับนิสัยตามที่ผู้ใช้ตั้งใจ */
function buildPortraitPrompt(c: {
  name: string; gender: string; ageRange: string; skinTone: string
  appearance: string | null; outfit: string | null
  personality: string; description: string | null; role: string
}): string {
  const parts: string[] = []
  if (c.gender)      parts.push(c.gender)
  if (c.ageRange)    parts.push(`age ${c.ageRange}`)
  if (c.skinTone)    parts.push(`${c.skinTone} skin tone`)
  if (c.appearance)  parts.push(c.appearance)
  if (c.outfit)      parts.push(`wearing ${c.outfit}`)

  const roleHint: Record<string, string> = {
    heroine: 'leading lady presence', hero: 'leading man presence',
    villain: 'subtly intense presence', supporting: '', extra: '', unset: '',
  }

  return [
    `Professional character portrait photo of ${c.name}:`,
    parts.join(', '),
    c.personality ? `Personality reflected in expression and pose: ${c.personality}.` : '',
    roleHint[c.role] ? `${roleHint[c.role]}.` : '',
    c.description ? `Context: ${c.description}.` : '',
    'Upper body shot, facing camera, natural soft studio lighting, clean neutral background, photorealistic, high detail, cinematic color grade.',
  ].filter(Boolean).join(' ')
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const teamId = await getCurrentTeamId()
  if (!teamId) return NextResponse.json({ error: 'ยังไม่ได้เข้าสู่ระบบ' }, { status: 401 })

  let body: { credentialId?: string; modelCode?: string }
  try { body = await req.json() } catch { body = {} }
  if (!body.credentialId) return NextResponse.json({ error: 'กรุณาเลือก AI Key สำหรับสร้างภาพ' }, { status: 400 })

  const character = await prisma.character.findFirst({ where: { id, teamId } })
  if (!character) return NextResponse.json({ error: 'ไม่พบตัวละครนี้' }, { status: 404 })

  if (!character.appearance && !character.gender && !character.ageRange) {
    return NextResponse.json(
      { error: 'กรุณากรอกข้อมูลรูปลักษณ์ (เพศ/ช่วงวัย/หน้าตา) ก่อนสร้างภาพ — เพื่อให้ภาพออกมาตรงตามที่ต้องการ' },
      { status: 400 }
    )
  }

  const credential = await prisma.credential.findFirst({
    where: { id: body.credentialId, teamId, status: 'active' },
  })
  if (!credential) return NextResponse.json({ error: 'ไม่พบ API Key ที่เลือก' }, { status: 404 })

  const apiKey = decryptSecret(
    Buffer.from(credential.encryptedKey as unknown as Uint8Array),
    Buffer.from(credential.encryptionIv as unknown as Uint8Array),
  )

  // เลือกโมเดล: ใช้ตัวที่ส่งมา หรือ default โมเดลภาพตัวแรกของ provider นั้น
  let modelCode = body.modelCode
  if (!modelCode) {
    const model = await prisma.aiModel.findFirst({
      where: { providerCode: credential.providerCode, capability: 'image', isActive: true },
      orderBy: { displayName: 'asc' },
    })
    if (!model) {
      return NextResponse.json(
        { error: `Provider ${credential.providerCode} ไม่มีโมเดลสร้างภาพ — ลองใช้ Key ของ Google/xAI/OpenAI` },
        { status: 400 }
      )
    }
    modelCode = model.modelCode
  }

  const prompt = buildPortraitPrompt(character)

  try {
    const result = await generateImage(credential.providerCode, {
      apiKey, model: modelCode!, prompt, aspectRatio: '1:1',
    })

    const updated = await prisma.character.update({
      where: { id: character.id },
      data:  { portraitUrl: result.dataUrl },
      select: { id: true, portraitUrl: true },
    })

    return NextResponse.json({ ok: true, portraitUrl: updated.portraitUrl, promptUsed: prompt })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'สร้างภาพไม่สำเร็จ'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const teamId = await getCurrentTeamId()
  if (!teamId) return NextResponse.json({ error: 'ยังไม่ได้เข้าสู่ระบบ' }, { status: 401 })

  const character = await prisma.character.findFirst({ where: { id, teamId }, select: { id: true } })
  if (!character) return NextResponse.json({ error: 'ไม่พบตัวละครนี้' }, { status: 404 })

  await prisma.character.update({ where: { id }, data: { portraitUrl: null } })
  return NextResponse.json({ ok: true })
}
