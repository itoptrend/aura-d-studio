// src/lib/queue/videoWorker.ts
import { Worker, Job } from 'bullmq'
import { prisma } from '@/lib/db'
import { decryptSecret } from '@/lib/encryption'
import { getRedisConnection, VideoJobPayload } from './videoQueue'
import { startVeoGeneration, pollVeoOperation, uploadVeoVideoToBlob } from '@/lib/ai/veo'

const STALL_TIMEOUT_MS = 15 * 60 * 1000

async function processVideoJob(job: Job<VideoJobPayload>): Promise<void> {
  const { videoJobId, provider, modelCode, prompt, negativePrompt,
          durationSecs, aspectRatio, credentialId } = job.data

  await prisma.videoJob.update({
    where: { id: videoJobId },
    data:  { status: 'running', startedAt: new Date(), attempts: { increment: 1 } },
  })

  await job.updateProgress(5)

  const credential = await prisma.credential.findUnique({
    where: { id: credentialId },
  })
  if (!credential) throw new Error('ไม่พบ Credential ที่ระบุ')

  const apiKey = decryptSecret(credential.encryptedKey, credential.encryptionIv)

  let blobUrl: string

  if (provider === 'google') {
    blobUrl = await processVeoJob({ job, videoJobId, apiKey, modelCode,
      prompt, negativePrompt, durationSecs, aspectRatio })
  } else {
    throw new Error(`Provider "${provider}" ยังไม่รองรับในเวอร์ชันนี้`)
  }

  await job.updateProgress(90)

  const asset = await prisma.asset.create({
    data: {
      teamId:  job.data.teamId,
      type:    'video',
      title:   `วิดีโอ: ${prompt.slice(0, 60)}${prompt.length > 60 ? '…' : ''}`,
      fileUrl: blobUrl,
    },
  })

  await prisma.videoJob.update({
    where: { id: videoJobId },
    data: {
      status:       'succeeded',
      blobUrl,
      assetId:      asset.id,
      finishedAt:   new Date(),
      errorMessage: null,
      errorCode:    null,
    },
  })

  await job.updateProgress(100)
}

async function processVeoJob(opts: {
  job:            Job<VideoJobPayload>
  videoJobId:     string
  apiKey:         string
  modelCode:      string
  prompt:         string
  negativePrompt?: string
  durationSecs:   number
  aspectRatio:    string
}): Promise<string> {
  const { job, videoJobId, apiKey, modelCode, prompt,
          negativePrompt, durationSecs, aspectRatio } = opts

  const existingJob = await prisma.videoJob.findUnique({
    where:  { id: videoJobId },
    select: { providerJobId: true },
  })

  let operationName = existingJob?.providerJobId ?? null

  if (!operationName) {
    operationName = await startVeoGeneration({
      apiKey, modelCode, prompt, negativePrompt, durationSecs, aspectRatio,
    })
    await prisma.videoJob.update({
      where: { id: videoJobId },
      data:  { providerJobId: operationName },
    })
  }

  await job.updateProgress(20)

  const MAX_POLLS = 60
  const POLL_INTERVAL_MS = 8_000

  for (let i = 0; i < MAX_POLLS; i++) {
    await sleep(POLL_INTERVAL_MS)
    const result = await pollVeoOperation({ apiKey, operationName })

    if (!result.done) {
      await job.updateProgress(20 + Math.round((i / MAX_POLLS) * 60))
      continue
    }

    if (result.error) {
      const e = new Error(result.error)
      ;(e as any).code         = result.nonRetryable ? 'content_policy' : 'api_error'
      ;(e as any).nonRetryable = result.nonRetryable ?? false
      throw e
    }

    if (!result.videoUri) throw new Error('Veo ไม่ return video URI')

    await job.updateProgress(80)
    return await uploadVeoVideoToBlob({ apiKey, videoUri: result.videoUri, jobId: videoJobId })
  }

  const e = new Error('Veo ใช้เวลานานเกินไป (> 8 นาที) กรุณาลองใหม่')
  ;(e as any).code = 'timeout'
  throw e
}

async function handleJobFailure(job: Job<VideoJobPayload>, err: unknown): Promise<void> {
  const error = err as any
  const isNonRetryable = error?.nonRetryable === true
  const isLastAttempt   = job.attemptsMade >= (job.opts.attempts ?? 3)

  if (isNonRetryable || isLastAttempt) {
    await prisma.videoJob.update({
      where: { id: job.data.videoJobId },
      data: {
        status:       'failed',
        finishedAt:   new Date(),
        errorMessage: error?.message ?? 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ',
        errorCode:    error?.code    ?? 'api_error',
      },
    })
  }
}

export async function recoverStalledJobs(): Promise<void> {
  const cutoff = new Date(Date.now() - STALL_TIMEOUT_MS)
  const stalledJobs = await prisma.videoJob.findMany({
    where: { status: 'running', startedAt: { lt: cutoff } },
    select: { id: true },
  })
  if (stalledJobs.length === 0) return
  await prisma.videoJob.updateMany({
    where: { id: { in: stalledJobs.map(j => j.id) } },
    data:  { status: 'stalled', stalledAt: new Date() },
  })
  console.log(`[VideoWorker] Marked ${stalledJobs.length} job(s) as stalled`)
}

let _worker: Worker<VideoJobPayload> | null = null

export function startVideoWorker(): Worker<VideoJobPayload> {
  if (_worker) return _worker

  _worker = new Worker<VideoJobPayload>(
    'video-jobs',
    processVideoJob,
    {
      connection:   getRedisConnection(),
      concurrency:  2,
      lockDuration: 60_000,
    }
  )

  _worker.on('failed', (job, err) => {
    if (job) handleJobFailure(job, err)
  })

  _worker.on('error', (err) => {
    console.error('[VideoWorker] Worker error:', err)
  })

  return _worker
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}