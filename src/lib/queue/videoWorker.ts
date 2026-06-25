// src/lib/queue/videoWorker.ts
import { Worker, Job } from 'bullmq'
import { prisma } from '@/lib/db'
import { decryptSecret } from '@/lib/encryption'
import { getRedisConnection, VideoJobPayload } from './videoQueue'
import { startVeoGeneration, pollVeoOperation, uploadVeoVideoToBlob } from '@/lib/ai/veo'
import {
  startVeoVertexGeneration,
  pollVeoVertexOperation,
  uploadVeoVertexVideoToBlob,
} from '@/lib/ai/veo-vertex'
import { startKlingGeneration, pollKlingTask, uploadKlingVideoToBlob } from '@/lib/ai/kling'
import { startGrokVideoGeneration, pollGrokVideo, uploadGrokVideoToBlob } from '@/lib/ai/grok-video'

const STALL_TIMEOUT_MS = 15 * 60 * 1000

// ---------------------------------------------------------------------------
// Main processor
// ---------------------------------------------------------------------------

async function processVideoJob(job: Job<VideoJobPayload>): Promise<void> {
  const { videoJobId, provider, modelCode, prompt, negativePrompt,
          durationSecs, aspectRatio, credentialId } = job.data

  await prisma.videoJob.update({
    where: { id: videoJobId },
    data:  { status: 'running', startedAt: new Date(), attempts: { increment: 1 } },
  })

  await job.updateProgress(5)

  const credential = await prisma.credential.findUnique({ where: { id: credentialId } })
  if (!credential) throw new Error('ไม่พบ Credential ที่ระบุ')

  const apiKey = decryptSecret(credential.encryptedKey, credential.encryptionIv)

  let blobUrl: string

  switch (provider) {
    case 'google':
      // AI Studio Key (generativelanguage.googleapis.com) — ใช้ veo.ts เดิม
      blobUrl = await processVeoJob({ job, videoJobId, apiKey, modelCode, prompt, negativePrompt, durationSecs, aspectRatio })
      break

    case 'google-vertex':
      // Service Account JSON (aiplatform.googleapis.com) — ใช้ veo-vertex.ts
      blobUrl = await processVeoVertexJob({ job, videoJobId, serviceAccountJson: apiKey, modelCode, prompt, negativePrompt, durationSecs, aspectRatio })
      break

    case 'kling':
      blobUrl = await processKlingJob({ job, videoJobId, apiKey, modelCode, prompt, negativePrompt, durationSecs, aspectRatio })
      break

    case 'xai':
      blobUrl = await processGrokJob({ job, videoJobId, apiKey, modelCode, prompt, durationSecs, aspectRatio })
      break

    default:
      throw new Error(`Provider "${provider}" ยังไม่รองรับ`)
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
    data:  { status: 'succeeded', blobUrl, assetId: asset.id, finishedAt: new Date(), errorMessage: null, errorCode: null },
  })

  await job.updateProgress(100)
}

// ---------------------------------------------------------------------------
// Veo (AI Studio) processor
// ---------------------------------------------------------------------------

async function processVeoJob(opts: {
  job: Job<VideoJobPayload>; videoJobId: string; apiKey: string
  modelCode: string; prompt: string; negativePrompt?: string
  durationSecs: number; aspectRatio: string
}): Promise<string> {
  const { job, videoJobId, apiKey, modelCode, prompt, negativePrompt, durationSecs, aspectRatio } = opts

  const existing = await prisma.videoJob.findUnique({ where: { id: videoJobId }, select: { providerJobId: true } })
  let operationName = existing?.providerJobId ?? null

  if (!operationName) {
    operationName = await startVeoGeneration({ apiKey, modelCode, prompt, negativePrompt, durationSecs, aspectRatio })
    await prisma.videoJob.update({ where: { id: videoJobId }, data: { providerJobId: operationName } })
  }

  await job.updateProgress(20)

  for (let i = 0; i < 60; i++) {
    await sleep(8_000)
    const result = await pollVeoOperation({ apiKey, operationName })
    if (!result.done) { await job.updateProgress(20 + Math.round((i / 60) * 60)); continue }
    if (result.error) { throwError(result.error, result.nonRetryable) }
    await job.updateProgress(80)
    return await uploadVeoVideoToBlob({ apiKey, videoUri: result.videoUri!, jobId: videoJobId })
  }
  throwError('Veo ใช้เวลานานเกินไป (> 8 นาที)', false, 'timeout')
}

// ---------------------------------------------------------------------------
// Veo (Vertex AI) processor
// ---------------------------------------------------------------------------

async function processVeoVertexJob(opts: {
  job: Job<VideoJobPayload>; videoJobId: string; serviceAccountJson: string
  modelCode: string; prompt: string; negativePrompt?: string
  durationSecs: number; aspectRatio: string
}): Promise<string> {
  const { job, videoJobId, serviceAccountJson, modelCode, prompt, negativePrompt, durationSecs, aspectRatio } = opts

  const existing = await prisma.videoJob.findUnique({ where: { id: videoJobId }, select: { providerJobId: true } })
  let operationName = existing?.providerJobId ?? null

  if (!operationName) {
    operationName = await startVeoVertexGeneration({
      serviceAccountJson,
      modelCode,
      prompt,
      negativePrompt,
      durationSecs,
      aspectRatio,
    })
    await prisma.videoJob.update({ where: { id: videoJobId }, data: { providerJobId: operationName } })
  }

  await job.updateProgress(20)

  // Veo Vertex ใช้เวลา ~2-8 นาที poll ทุก 8 วินาที max 70 รอบ
  for (let i = 0; i < 70; i++) {
    await sleep(8_000)
    const result = await pollVeoVertexOperation({ serviceAccountJson, operationName, modelCode })
    if (!result.done) { await job.updateProgress(20 + Math.round((i / 70) * 60)); continue }
    if (result.error) { throwError(result.error, result.nonRetryable) }
    await job.updateProgress(80)
    return await uploadVeoVertexVideoToBlob({
      videoBase64: result.videoBase64,
      gcsUri:      result.gcsUri,
      jobId:       videoJobId,
    })
  }
  throwError('Veo Vertex ใช้เวลานานเกินไป (> 9 นาที)', false, 'timeout')
}

// ---------------------------------------------------------------------------
// Kling processor
// ---------------------------------------------------------------------------

async function processKlingJob(opts: {
  job: Job<VideoJobPayload>; videoJobId: string; apiKey: string
  modelCode: string; prompt: string; negativePrompt?: string
  durationSecs: number; aspectRatio: string
}): Promise<string> {
  const { job, videoJobId, apiKey, modelCode, prompt, negativePrompt, durationSecs, aspectRatio } = opts

  const existing = await prisma.videoJob.findUnique({ where: { id: videoJobId }, select: { providerJobId: true } })
  let taskId = existing?.providerJobId ?? null

  if (!taskId) {
    taskId = await startKlingGeneration({ apiKey, prompt, negativePrompt, modelCode, durationSecs, aspectRatio })
    await prisma.videoJob.update({ where: { id: videoJobId }, data: { providerJobId: taskId } })
  }

  await job.updateProgress(20)

  for (let i = 0; i < 50; i++) {
    await sleep(8_000)
    const result = await pollKlingTask({ apiKey, taskId })
    if (!result.done) { await job.updateProgress(20 + Math.round((i / 50) * 60)); continue }
    if (result.error) { throwError(result.error, result.nonRetryable) }
    await job.updateProgress(80)
    return await uploadKlingVideoToBlob({ videoUrl: result.videoUrl!, jobId: videoJobId })
  }
  throwError('Kling ใช้เวลานานเกินไป (> 7 นาที)', false, 'timeout')
}

// ---------------------------------------------------------------------------
// Grok processor
// ---------------------------------------------------------------------------

async function processGrokJob(opts: {
  job: Job<VideoJobPayload>; videoJobId: string; apiKey: string
  modelCode: string; prompt: string; durationSecs: number; aspectRatio: string
}): Promise<string> {
  const { job, videoJobId, apiKey, modelCode, prompt, durationSecs, aspectRatio } = opts

  const existing = await prisma.videoJob.findUnique({ where: { id: videoJobId }, select: { providerJobId: true } })
  let requestId = existing?.providerJobId ?? null

  if (!requestId) {
    requestId = await startGrokVideoGeneration({ apiKey, prompt, modelCode, durationSecs, aspectRatio })
    await prisma.videoJob.update({ where: { id: videoJobId }, data: { providerJobId: requestId } })
  }

  await job.updateProgress(20)

  for (let i = 0; i < 40; i++) {
    await sleep(5_000)
    const result = await pollGrokVideo({ apiKey, requestId })
    if (!result.done) { await job.updateProgress(20 + Math.round((i / 40) * 60)); continue }
    if (result.error) { throwError(result.error, result.nonRetryable) }
    await job.updateProgress(80)
    return await uploadGrokVideoToBlob({ videoUrl: result.videoUrl!, jobId: videoJobId })
  }
  throwError('Grok ใช้เวลานานเกินไป (> 3 นาที)', false, 'timeout')
}

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

function throwError(message: string, nonRetryable?: boolean, code = 'api_error'): never {
  const e = new Error(message)
  ;(e as any).code         = nonRetryable ? 'content_policy' : code
  ;(e as any).nonRetryable = nonRetryable ?? false
  throw e
}

async function handleJobFailure(job: Job<VideoJobPayload>, err: unknown): Promise<void> {
  const error         = err as any
  const isLastAttempt = job.attemptsMade >= (job.opts.attempts ?? 3)
  if (error?.nonRetryable || isLastAttempt) {
    await prisma.videoJob.update({
      where: { id: job.data.videoJobId },
      data:  { status: 'failed', finishedAt: new Date(), errorMessage: error?.message ?? 'เกิดข้อผิดพลาด', errorCode: error?.code ?? 'api_error' },
    })
  }
}

// ---------------------------------------------------------------------------
// Stall recovery
// ---------------------------------------------------------------------------

export async function recoverStalledJobs(): Promise<void> {
  const cutoff      = new Date(Date.now() - STALL_TIMEOUT_MS)
  const stalledJobs = await prisma.videoJob.findMany({
    where:  { status: 'running', startedAt: { lt: cutoff } },
    select: { id: true },
  })
  if (stalledJobs.length === 0) return
  await prisma.videoJob.updateMany({
    where: { id: { in: stalledJobs.map(j => j.id) } },
    data:  { status: 'stalled', stalledAt: new Date() },
  })
}

// ---------------------------------------------------------------------------
// Worker factory
// ---------------------------------------------------------------------------

let _worker: Worker<VideoJobPayload> | null = null

export function startVideoWorker(): Worker<VideoJobPayload> {
  if (_worker) return _worker
  _worker = new Worker<VideoJobPayload>('video-jobs', processVideoJob, {
    connection:   getRedisConnection(),
    concurrency:  2,
    lockDuration: 60_000,
  })
  _worker.on('failed', (job, err) => { if (job) handleJobFailure(job, err) })
  _worker.on('error',  (err) => console.error('[VideoWorker] error:', err))
  return _worker
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}
