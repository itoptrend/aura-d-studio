// src/app/api/cron/process-video-jobs/route.ts
import { NextResponse }    from 'next/server'
import { prisma }          from '@/lib/db'
import { decryptSecret }   from '@/lib/encryption'
import { startVeoGeneration, pollVeoOperation, uploadVeoVideoToBlob }                         from '@/lib/ai/veo'
import { startKlingGeneration, pollKlingTask, uploadKlingVideoToBlob }                        from '@/lib/ai/kling'
import { startGrokVideoGeneration, pollGrokVideo, uploadGrokVideoToBlob }                     from '@/lib/ai/grok-video'
import { startOpenRouterVideo, pollOpenRouterVideo, uploadOpenRouterVideoToBlob }             from '@/lib/ai/openrouter-video'

// กัน function timeout ตอนดาวน์โหลดวิดีโอ + อัปโหลด Blob (ไฟล์วิดีโอใหญ่)
export const maxDuration = 300
export const dynamic     = 'force-dynamic'

const MAX_JOBS_PER_RUN = 2
const STALL_MINUTES    = 10

function isCronAuthorized(req: Request): boolean {
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${process.env.CRON_SECRET}`
}

export async function GET(req: Request): Promise<NextResponse> {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Mark stalled
    const stalledCutoff = new Date(Date.now() - STALL_MINUTES * 60_000)
    await prisma.videoJob.updateMany({
      where: { status: 'running', startedAt: { lt: stalledCutoff } },
      data:  { status: 'stalled', stalledAt: new Date() },
    })

    // ปิดงานที่ retry ครบแล้ว (attempts >= 3) ไม่ให้ค้าง pending ตลอดไป
    await prisma.videoJob.updateMany({
      where: { status: 'pending', attempts: { gte: 3 } },
      data:  {
        status: 'failed',
        errorMessage: 'ลองใหม่ครบ 3 ครั้งแล้วยังไม่สำเร็จ — กรุณาตรวจสอบ API Key / prompt',
        errorCode: 'max_attempts',
        finishedAt: new Date(),
      },
    })

    // Pending jobs
    const pendingJobs = await prisma.videoJob.findMany({
      where:   { status: 'pending', attempts: { lt: 3 } },
      orderBy: { createdAt: 'asc' },
      take:    MAX_JOBS_PER_RUN,
    })

    // Running jobs (poll)
    const runningJobs = await prisma.videoJob.findMany({
      where:   { status: 'running', providerJobId: { not: null } },
      orderBy: { startedAt: 'asc' },
      take:    MAX_JOBS_PER_RUN,
    })

    const results = await Promise.allSettled([
      ...pendingJobs.map(job => processJob(job)),
      ...runningJobs.map(job => pollJob(job)),
    ])

    return NextResponse.json({
      ok:        true,
      processed: pendingJobs.length,
      polled:    runningJobs.length,
      succeeded: results.filter(r => r.status === 'fulfilled').length,
      failed:    results.filter(r => r.status === 'rejected').length,
      ts:        new Date().toISOString(),
    })
  } catch (err) {
    console.error('[Cron] process-video-jobs failed:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// processJob — start new job
// ---------------------------------------------------------------------------

async function processJob(job: {
  id: string; provider: string; modelCode: string; prompt: string
  negativePrompt: string | null; durationSecs: number; aspectRatio: string
  credentialId: string | null; teamId: string; attempts: number
}): Promise<void> {
  if (!job.credentialId) { await failJob(job.id, 'ไม่พบ credential', 'api_error', true); return }

  const credential = await prisma.credential.findUnique({
    where:  { id: job.credentialId },
    select: { encryptedKey: true, encryptionIv: true },
  })
  if (!credential) { await failJob(job.id, 'ไม่พบ API Key ในระบบ', 'api_error', true); return }

  const apiKey = decryptSecret(credential.encryptedKey, credential.encryptionIv)

  await prisma.videoJob.update({
    where: { id: job.id },
    data:  { status: 'running', startedAt: new Date(), attempts: { increment: 1 } },
  })

  try {
    let providerJobId: string
    let statusUrl:     string | undefined

    switch (job.provider) {
      case 'google':
        providerJobId = await startVeoGeneration({
          apiKey, modelCode: job.modelCode, prompt: job.prompt,
          negativePrompt: job.negativePrompt ?? undefined,
          durationSecs: job.durationSecs, aspectRatio: job.aspectRatio,
        })
        break

      case 'kling':
        providerJobId = await startKlingGeneration({
          apiKey, prompt: job.prompt, negativePrompt: job.negativePrompt ?? undefined,
          modelCode: job.modelCode, durationSecs: job.durationSecs, aspectRatio: job.aspectRatio,
        })
        break

      case 'xai':
        providerJobId = await startGrokVideoGeneration({
          apiKey, prompt: job.prompt, modelCode: job.modelCode,
          durationSecs: job.durationSecs, aspectRatio: job.aspectRatio,
        })
        break

      case 'openrouter': {
        const result = await startOpenRouterVideo({
          apiKey, modelCode: job.modelCode, prompt: job.prompt,
          negativePrompt: job.negativePrompt ?? undefined,
          durationSecs: job.durationSecs, aspectRatio: job.aspectRatio,
        })
        providerJobId = result.jobId
        statusUrl     = result.statusUrl
        break
      }

      default:
        await failJob(job.id, `Provider "${job.provider}" ยังไม่รองรับ`, 'api_error', true)
        return
    }

    // บันทึก providerJobId (และ statusUrl ใน errorMessage ชั่วคราวสำหรับ openrouter)
    await prisma.videoJob.update({
      where: { id: job.id },
      data:  {
        providerJobId,
        // เก็บ statusUrl ไว้ใน errorCode field ชั่วคราว (ถ้าเป็น openrouter)
        errorCode: statusUrl ? `statusUrl:${statusUrl}` : null,
      },
    })
  } catch (err: any) {
    const isNonRetryable = err?.nonRetryable === true || job.attempts >= 2
    if (isNonRetryable) {
      await failJob(job.id, err?.message ?? 'Unknown error', err?.code ?? 'api_error', true)
    } else {
      await prisma.videoJob.update({
        where: { id: job.id },
        data:  { status: 'pending', startedAt: null },
      })
    }
  }
}

// ---------------------------------------------------------------------------
// pollJob — poll running job
// ---------------------------------------------------------------------------

async function pollJob(job: {
  id: string; provider: string; modelCode: string
  providerJobId: string | null; credentialId: string | null
  teamId: string; prompt: string; attempts: number
  errorCode: string | null
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
      case 'openrouter': {
        // ดึง statusUrl จาก errorCode field
        const statusUrl = job.errorCode?.startsWith('statusUrl:')
          ? job.errorCode.replace('statusUrl:', '')
          : `https://openrouter.ai/api/v1/videos/${job.providerJobId}`
        result = await pollOpenRouterVideo({ apiKey, jobId: job.providerJobId, statusUrl })
        break
      }
      default:
        return
    }

    if (!result.done) return

    if (result.error) {
      await failJob(job.id, result.error, 'api_error', result.nonRetryable ?? false)
      return
    }

    // Upload → Blob
    let blobUrl: string
    switch (job.provider) {
      case 'google':
        blobUrl = await uploadVeoVideoToBlob({ apiKey, videoUri: result.videoUri, videoBase64: result.videoBase64, jobId: job.id })
        break
      case 'kling':
        blobUrl = await uploadKlingVideoToBlob({ videoUrl: result.videoUrl!, jobId: job.id })
        break
      case 'xai':
        blobUrl = await uploadGrokVideoToBlob({ videoUrl: result.videoUrl!, jobId: job.id })
        break
      case 'openrouter':
        blobUrl = await uploadOpenRouterVideoToBlob({ videoUrl: result.videoUrl!, jobId: job.id })
        break
      default:
        return
    }

    const asset = await prisma.asset.create({
      data: {
        teamId:  job.teamId,
        type:    'video',
        title:   `วิดีโอ: ${job.prompt.slice(0, 60)}${job.prompt.length > 60 ? '…' : ''}`,
        fileUrl: blobUrl,
      },
    })

    await prisma.videoJob.update({
      where: { id: job.id },
      data:  { status: 'succeeded', blobUrl, assetId: asset.id, finishedAt: new Date(), errorMessage: null, errorCode: null },
    })
  } catch (err: any) {
    console.error(`[Cron] pollJob ${job.id} error:`, err)
    await failJob(job.id, err?.message ?? 'Unknown error', 'api_error', false)
  }
}

async function failJob(jobId: string, errorMessage: string, errorCode: string, permanent: boolean): Promise<void> {
  if (permanent) {
    await prisma.videoJob.update({
      where: { id: jobId },
      data:  { status: 'failed', errorMessage, errorCode, finishedAt: new Date() },
    })
  }
}
