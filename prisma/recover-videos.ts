// prisma/recover-videos.ts
// กู้วิดีโอที่ generate สำเร็จฝั่ง OpenRouter แต่แอปรับกลับมาไม่ทัน
// (งานที่มี providerJobId แต่ไม่มี blobUrl)
//
// วิธีรัน:
//   npx tsx prisma/recover-videos.ts
//
// ถ้า decrypt key จาก DB ไม่ได้ (CREDENTIAL_ENCRYPTION_KEY ในเครื่องไม่ตรงกับ production)
// ให้ใส่ API key ของ OpenRouter ตรงๆ แบบนี้แทน:
//   $env:OPENROUTER_API_KEY="sk-or-v1-xxxx"; npx tsx prisma/recover-videos.ts
//
// วิดีโอที่กู้ได้จะถูกบันทึกลงโฟลเดอร์ ./recovered-videos/

import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'
const OUT_DIR = path.join(process.cwd(), 'recovered-videos')

function decryptSecret(ciphertext: Buffer, iv: Buffer): string {
  const raw = process.env.CREDENTIAL_ENCRYPTION_KEY
  if (!raw) throw new Error('CREDENTIAL_ENCRYPTION_KEY is not set')
  const key = Buffer.from(raw, 'base64')
  const AUTH_TAG_LENGTH = 16
  const authTag = ciphertext.subarray(ciphertext.length - AUTH_TAG_LENGTH)
  const data = ciphertext.subarray(0, ciphertext.length - AUTH_TAG_LENGTH)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

async function getApiKey(credentialId: string | null): Promise<string | null> {
  // ทางลัด: ใช้ key จาก env โดยตรงถ้ามี
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY

  if (!credentialId) return null
  const cred = await prisma.credential.findUnique({
    where: { id: credentialId },
    select: { encryptedKey: true, encryptionIv: true },
  })
  if (!cred) return null
  try {
    return decryptSecret(
      Buffer.from(cred.encryptedKey as unknown as Uint8Array),
      Buffer.from(cred.encryptionIv as unknown as Uint8Array),
    )
  } catch (e: any) {
    console.log(`    ⚠ decrypt key ไม่ได้ (${e.message}) — ลองตั้ง $env:OPENROUTER_API_KEY แทน`)
    return null
  }
}

async function main() {
  // ---- โหมดป้อน ID ด้วยมือ (จากหน้า Logs ของ openrouter.ai) ----
  // $env:OPENROUTER_API_KEY="sk-or-..."; $env:OPENROUTER_JOB_IDS="id1,id2"; npx tsx prisma/recover-videos.ts
  const manualIds = (process.env.OPENROUTER_JOB_IDS ?? '')
    .split(',').map(s => s.trim()).filter(Boolean)

  if (manualIds.length > 0) {
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) { console.log('โหมด manual ต้องตั้ง $env:OPENROUTER_API_KEY ด้วย'); return }
    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR)
    let ok = 0
    for (const id of manualIds) {
      console.log(`— generation ${id}`)
      try {
        const res = await fetch(`${OPENROUTER_BASE}/videos/${id}`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        })
        if (!res.ok) { console.log(`    ✗ HTTP ${res.status}: ${(await res.text()).slice(0, 150)}\n`); continue }
        const data = await res.json() as { status: string; unsigned_urls?: string[]; error?: { message?: string } }
        console.log(`    status: ${data.status}`)
        if (data.status !== 'completed' || !data.unsigned_urls?.[0]) {
          if (data.error?.message) console.log(`    เหตุผล: ${data.error.message}`)
          console.log(''); continue
        }
        // ดาวน์โหลด: ลอง unsigned_url แบบแนบ key → ถ้าไม่ได้ ลอง endpoint /content
        let buf: Buffer | null = null
        const candidates = [
          { url: data.unsigned_urls[0], auth: false },
          { url: data.unsigned_urls[0], auth: true },
          { url: `${OPENROUTER_BASE}/videos/${id}/content?index=0`, auth: true },
        ]
        for (const c of candidates) {
          const dl = await fetch(c.url, c.auth ? { headers: { Authorization: `Bearer ${apiKey}` } } : undefined)
          if (dl.ok) { buf = Buffer.from(await dl.arrayBuffer()); break }
          console.log(`    …ลอง ${c.auth ? 'auth' : 'no-auth'} ${c.url.slice(0, 60)} → ${dl.status}`)
        }
        if (!buf) { console.log(`    ✗ ดาวน์โหลดล้มเหลวทุกช่องทาง\n`); continue }
        const filename = path.join(OUT_DIR, `manual-${id.slice(0, 12)}.mp4`)
        fs.writeFileSync(filename, buf)
        console.log(`    ✓ กู้สำเร็จ! ${filename} (${(buf.length / 1024 / 1024).toFixed(1)} MB)\n`)
        ok++
      } catch (e: any) { console.log(`    ✗ error: ${e.message}\n`) }
    }
    console.log(`\nสรุปโหมด manual: กู้ได้ ${ok}/${manualIds.length}`)
    return
  }

  const jobs = await prisma.videoJob.findMany({
    where: {
      provider:      'openrouter',
      providerJobId: { not: null },
      blobUrl:       null,
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, status: true, prompt: true, providerJobId: true,
      credentialId: true, errorCode: true, createdAt: true,
    },
  })

  if (jobs.length === 0) {
    console.log('ไม่พบงาน openrouter ที่มี providerJobId ค้างอยู่เลย')
    console.log('(แปลว่าไม่มีวิดีโอให้กู้จากฝั่งฐานข้อมูล — ลองดูหน้า Logs ใน openrouter.ai แทน)')
    return
  }

  console.log(`พบ ${jobs.length} งานที่อาจกู้วิดีโอได้\n`)
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR)

  let recovered = 0

  for (const job of jobs) {
    console.log(`— job ${job.id}`)
    console.log(`    prompt:  ${job.prompt.slice(0, 60)}`)
    console.log(`    status:  ${job.status} / providerJobId: ${job.providerJobId}`)

    const apiKey = await getApiKey(job.credentialId)
    if (!apiKey) { console.log('    ✗ ไม่มี API key ให้ใช้ ข้ามงานนี้\n'); continue }

    // statusUrl อาจถูกเก็บไว้ใน errorCode (hack เดิมของระบบ)
    const statusUrl = job.errorCode?.startsWith('statusUrl:')
      ? job.errorCode.replace('statusUrl:', '')
      : `${OPENROUTER_BASE}/videos/${job.providerJobId}`

    try {
      const res = await fetch(statusUrl, {
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      if (!res.ok) {
        console.log(`    ✗ poll ไม่ได้: HTTP ${res.status} ${await res.text().then(t => t.slice(0, 120))}\n`)
        continue
      }
      const data = await res.json() as {
        status: string
        unsigned_urls?: string[]
        error?: { message?: string }
      }
      console.log(`    OpenRouter status: ${data.status}`)

      if (data.status !== 'completed' || !data.unsigned_urls?.[0]) {
        if (data.error?.message) console.log(`    เหตุผล: ${data.error.message}`)
        console.log('')
        continue
      }

      // ดาวน์โหลดวิดีโอ
      const videoUrl = data.unsigned_urls[0]
      const dl = await fetch(videoUrl)
      if (!dl.ok) { console.log(`    ✗ ดาวน์โหลดล้มเหลว: ${dl.status}\n`); continue }

      const buf = Buffer.from(await dl.arrayBuffer())
      const filename = path.join(OUT_DIR, `${job.createdAt.toISOString().slice(0, 10)}-${job.id.slice(0, 8)}.mp4`)
      fs.writeFileSync(filename, buf)
      console.log(`    ✓ กู้สำเร็จ! บันทึกที่ ${filename} (${(buf.length / 1024 / 1024).toFixed(1)} MB)\n`)
      recovered++
    } catch (e: any) {
      console.log(`    ✗ error: ${e.message}\n`)
    }
  }

  console.log(`\nสรุป: กู้ได้ ${recovered}/${jobs.length} วิดีโอ → ดูในโฟลเดอร์ recovered-videos/`)
  if (recovered === 0) {
    console.log('ถ้ากู้ไม่ได้เลย เป็นไปได้ว่า: (1) งานที่โดนหักเงินไม่ได้บันทึก providerJobId ไว้')
    console.log('หรือ (2) OpenRouter ลบไฟล์แล้วเพราะเกินระยะเก็บ — ลองดูหน้า Logs ที่ openrouter.ai ประกอบ')
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
