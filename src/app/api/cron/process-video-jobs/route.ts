// src/app/api/cron/process-video-jobs/route.ts
// Vercel Cron — trigger ทุก 1 นาที
// ประมวลผล VideoJob โดยตรงใน Cron function (ไม่ใช้ BullMQ Worker)
// เพราะ BullMQ Worker ต้องการ long-running process ซึ่ง Vercel Serverless ไม่รองรับ

import { NextResponse }    from 'next/server'
import { prisma }          from '@/lib/db'
import { decryptSecret }   from '@/lib/encryption'
import { startVeoGeneration, pollVeoOperation, uploadVeoVideoToBlob } from '@/lib/ai/veo'
import { startKlingGeneration, pollKlingTask, uploadKlingVideoToBlob } from '@/lib/ai/kling'
import { startGrokVideoGeneration, pollGrokVideo, uploadGrokVideoToBlob } from '@/lib/ai/grok-video'

const MAX_JOBS_PER_RUN = 2   // ประมวลผลพร้อมกันสูงสุด 2 งาน
const STALL_MINUTES    = 10  // mark stalled ถ้า running นานกว่า 10 นาที

function isCronAuthorized(req: Request): boolean {
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${process.env.CRON_SECRET}`
}

// ---------------------------------------------------------------------------
// GET — entry point จาก Vercel Cron
// ---------------------------------------------------------------------------

export async function GET(req: Request): Promise<NextResponse> {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 1) Mark stalled jobs
    const stalledCutoff = new Date(Date.now() - STALL_MINUTES * 60_000)
    await prisma.videoJob.updateMany({
      where:  { status: 'running', startedAt: { lt: stalledCutoff } },
      data:   { status: 'stalled', stalledAt: new Date() },
    })

    // 2) ดึง pending jobs ที่ยังไม่เกิน maxAttempts
    const pendingJobs = await prisma.videoJob.findMany({
      where:   { status: 'pending', attempts: { lt: 3 } },
      orderBy: { createdAt: 'asc' },
      take:    MAX_JOBS_PER_RUN,
    })

    // 3) ดึง running jobs ที่มี providerJobId (กำลัง poll อยู่)
    const runningJobs = await prisma.videoJob.findMany({
      where:   { status: 'running', providerJobId: { not: null } },
      orderBy: { startedAt: 'asc' },
      take:    MAX_JOBS_PER_RUN,
    })

    const results = await Promise.allSettled([
      ...pendingJobs.map(job => processJob(job)),
      ...runningJobs.map(job => pollJob(job)),
    ])

    const succeeded = results.filter(r => r.status === 'fulfilled').length
    const failed    = results.filter(r => r.status === 'rejected').length

    return NextResponse.json({
      ok:        true,
      processed: pendingJobs.length,
      polled:    runningJobs.length,
      succeeded,
      failed,
      ts:        new Date().toISOString(),
    })
  } catch (err) {
    console.error('[Cron] process-video-jobs failed:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// processJob — เริ่มงานใหม่ (pending → running → ส่งไป provider)
// ---------------------------------------------------------------------------

async function processJob(job: {
  id: string; provider: string; modelCode: string; prompt: string
  negativePrompt: string | null; durationSecs: number; aspectRatio: string
  credentialId: string | null; teamId: string; attempts: number
}): Promise<void> {
  if (!job.credentialId) {
    await failJob(job.id, 'ไม่พบ credential', 'api_error', true)
    return
  }

  const credential = await prisma.credential.findUnique({
    where:  { id: job.credentialId },
    select: { encryptedKey: true, encryptionIv: true },
  })
  if (!credential) {
    await failJob(job.id, 'ไม่พบ API Key ในระบบ', 'api_error', true)
    return
  }

  const apiKey = decryptSecret(credential.encryptedKey, credential.encryptionIv)

  // Mark running
  await prisma.videoJob.update({
    where: { id: job.id },
    data:  { status: 'running', startedAt: new Date(), attempts: { increment: 1 } },
  })

  try {
    let providerJobId: string

    switch (job.provider) {
      case 'google':
        providerJobId = await startVeoGeneration({
          apiKey,
          modelCode:       job.modelCode,
          prompt:          job.prompt,
          negativePrompt:  job.negativePrompt ?? undefined,
          durationSecs:    job.durationSecs,
          aspectRatio:     job.aspectRatio,
        })
        break

      case 'kling':
        providerJobId = await startKlingGeneration({
          apiKey,
          prompt:          job.prompt,
          negativePrompt:  job.negativePrompt ?? undefined,
          modelCode:       job.modelCode,
          durationSecs:    job.durationSecs,
          aspectRatio:     job.aspectRatio,
        })
        break

      case 'xai':
        providerJobId = await startGrokVideoGeneration({
          apiKey,
          prompt:          job.prompt,
          modelCode:       job.modelCode,
          durationSecs:    job.durationSecs,
          aspectRatio:     job.aspectRatio,
        })
        break

      default:
        await failJob(job.id, `Provider "${job.provider}" ยังไม่รองรับ`, 'api_error', true)
        return
    }

    // บันทึก providerJobId เพื่อ poll รอบหน้า
    await prisma.videoJob.update({
      where: { id: job.id },
      data:  { providerJobId },
    })
  } catch (err: any) {
    const isNonRetryable = err?.nonRetryable === true || job.attempts >= 2
    await failJob(job.id, err?.message ?? 'Unknown error', err?.code ?? 'api_error', isNonRetryable)
    if (!isNonRetryable) {
      // reset กลับ pending เพื่อ retry รอบหน้า
      await prisma.videoJob.update({
        where: { id: job.id },
        data:  { status: 'pending', startedAt: null },
      })
    }
  }
}

// ---------------------------------------------------------------------------
// pollJob — poll งานที่กำลังรันอยู่
// ---------------------------------------------------------------------------

async function pollJob(job: {
  id: string; provider: string; modelCode: string
  providerJobId: string | null; credentialId: string | null
  teamId: string; prompt: string; attempts: number
}): Promise<void> {
  if (!job.providerJobId || !job.credentialId) return

  const credential = await prisma.credential.findUnique({
    where:  { id: job.credentialId },
    select: { encryptedKey: true, encryptionIv: true },
  })
  if (!credential) return

  const apiKey = decryptSecret(credential.encryptedKey, credential.encryptionIv)

  try {
    let result: { done: boolean; videoUrl?: string; videoUri?: string; videoBase64?: string; error?: string; nonRetryable?: boolean }

    switch (job.provider) {
      case 'google':
        result = await pollVeoOperation({ apiKey, operationName: job.providerJobId })
        break
      case 'kling':
        result = await pollKlingTask({ apiKey, taskId: job.providerJobId })
        break
      case 'xai':
        result = await pollGrokVideo({ apiKey, requestId: job.providerJobId })
        break
      default:
        return
    }

    if (!result.done) return  // ยังไม่เสร็จ รอ cron รอบหน้า

    if (result.error) {
      await failJob(job.id, result.error, 'api_error', result.nonRetryable ?? false)
      return
    }

    // Upload video → Vercel Blob
    let blobUrl: string
    switch (job.provider) {
      case 'google':
        blobUrl = await uploadVeoVideoToBlob({
          apiKey,
          videoUri:    result.videoUri,
          videoBase64: result.videoBase64,
          jobId:       job.id,
        })
        break
      case 'kling':
        blobUrl = await uploadKlingVideoToBlob({ videoUrl: result.videoUrl!, jobId: job.id })
        break
      case 'xai':
        blobUrl = await uploadGrokVideoToBlob({ videoUrl: result.videoUrl!, jobId: job.id })
        break
      default:
        return
    }

    // สร้าง Asset
    const asset = await prisma.asset.create({
      data: {
        teamId:  job.teamId,
        type:    'video',
        title:   `วิดีโอ: ${job.prompt.slice(0, 60)}${job.prompt.length > 60 ? '…' : ''}`,
        fileUrl: blobUrl,
      },
    })

    // Mark succeeded
    await prisma.videoJob.update({
      where: { id: job.id },
      data:  { status: 'succeeded', blobUrl, assetId: asset.id, finishedAt: new Date(), errorMessage: null },
    })
  } catch (err: any) {
    console.error(`[Cron] pollJob ${job.id} error:`, err)
    await failJob(job.id, err?.message ?? 'Unknown error', 'api_error', false)
  }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

async function failJob(
  jobId:         string,
  errorMessage:  string,
  errorCode:     string,
  permanent:     boolean,
): Promise<void> {
  if (permanent) {
    await prisma.videoJob.update({
      where: { id: jobId },
      data:  { status: 'failed', errorMessage, errorCode, finishedAt: new Date() },
    })
  }
  // ถ้าไม่ permanent — cron จะ retry รอบหน้าเอง (status ยังเป็น pending)
}
