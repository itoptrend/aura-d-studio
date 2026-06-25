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
    tls: { rejectUnauthorized: false },
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
  })
}

// ---------------------------------------------------------------------------
// Job payload type
// ---------------------------------------------------------------------------

export interface VideoJobPayload {
  videoJobId:      string
  teamId:          string
  provider:        'google' | 'kling' | 'runway'
  modelCode:       string
  prompt:          string
  negativePrompt?: string
  durationSecs:    number
  aspectRatio:     string
  credentialId:    string
}

// ---------------------------------------------------------------------------
// Queue singleton
// ---------------------------------------------------------------------------

let _queue: Queue | null = null

export function getVideoQueue(): Queue {
  if (_queue) return _queue

  const connection = getRedisConnection()

  _queue = new Queue('video-jobs', {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type:  'exponential',
        delay: 10_000,
      },
      removeOnComplete: { age: 3600 },
      removeOnFail:     { age: 86_400 },
    },
  })

  return _queue
}

// ---------------------------------------------------------------------------
// QueueEvents singleton
// ---------------------------------------------------------------------------

let _queueEvents: QueueEvents | null = null

export function getVideoQueueEvents(): QueueEvents {
  if (_queueEvents) return _queueEvents
  const connection = getRedisConnection()
  _queueEvents = new QueueEvents('video-jobs', { connection })
  return _queueEvents
}
