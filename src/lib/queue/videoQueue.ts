// src/lib/queue/videoQueue.ts
// BullMQ Queue + Job type definitions สำหรับ video generation
// Redis connection ใช้ Upstash (compatible กับ ioredis interface)

import { Queue, QueueEvents } from 'bullmq'
import IORedis from 'ioredis'

// ---------------------------------------------------------------------------
// Redis connection (Upstash)
// ---------------------------------------------------------------------------

export function getRedisConnection() {
  const url = process.env.UPSTASH_REDIS_URL
  if (!url) throw new Error('UPSTASH_REDIS_URL is not set')

  return new IORedis(url, {
    password: process.env.UPSTASH_REDIS_TOKEN,
    tls: { rejectUnauthorized: false }, // Upstash ต้องการ TLS
    maxRetriesPerRequest: null,         // required by BullMQ
    enableReadyCheck: false,
    lazyConnect: true,
  })
}

// ---------------------------------------------------------------------------
// Job payload type
// ---------------------------------------------------------------------------

export interface VideoJobPayload {
  videoJobId: string       // PK ของ VideoJob ใน DB — Worker ใช้ update status
  teamId:     string
  provider:   'google' | 'kling' | 'runway'
  modelCode:  string       // e.g. 'veo-3.0-generate-preview'
  prompt:     string
  negativePrompt?: string
  durationSecs:    number  // 5 | 8
  aspectRatio:     string  // '16:9' | '9:16' | '1:1'
  credentialId:    string  // ใช้ดึง API key จาก DB
}

// ---------------------------------------------------------------------------
// Queue singleton (lazy-init เพื่อกัน cold-start crash ถ้า Redis ยังไม่พร้อม)
// ---------------------------------------------------------------------------

let _queue: Queue<VideoJobPayload> | null = null

export function getVideoQueue(): Queue<VideoJobPayload> {
  if (_queue) return _queue

  const connection = getRedisConnection()

  _queue = new Queue<VideoJobPayload>('video-jobs', {
    connection,
    defaultJobOptions: {
      attempts:    3,
      backoff: {
        type:  'exponential',
        delay: 10_000,  // 10s → 20s → 40s
      },
      removeOnComplete: { age: 3600 },       // เก็บ completed jobs ไว้ 1 ชม.
      removeOnFail:     { age: 86_400 },     // เก็บ failed jobs ไว้ 1 วัน
    },
  })

  return _queue
}

// ---------------------------------------------------------------------------
// QueueEvents — ใช้ใน polling endpoint เพื่อ subscribe completion events
// ---------------------------------------------------------------------------

let _queueEvents: QueueEvents | null = null

export function getVideoQueueEvents(): QueueEvents {
  if (_queueEvents) return _queueEvents
  const connection = getRedisConnection()
  _queueEvents = new QueueEvents('video-jobs', { connection })
  return _queueEvents
}
