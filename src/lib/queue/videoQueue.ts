// src/lib/queue/videoQueue.ts
import { Queue, QueueEvents } from 'bullmq'

// ---------------------------------------------------------------------------
// Job payload type
// ---------------------------------------------------------------------------

export interface VideoJobPayload {
  videoJobId:      string
  teamId:          string
  provider: 'google' | 'google-vertex' | 'kling' | 'xai' | 'runway'
  modelCode:       string
  prompt:          string
  negativePrompt?: string
  durationSecs:    number
  aspectRatio:     string
  credentialId:    string
}

// ---------------------------------------------------------------------------
// Connection options
// ---------------------------------------------------------------------------

function getConnectionOptions() {
  const url = process.env.UPSTASH_REDIS_URL
  if (!url) throw new Error('UPSTASH_REDIS_URL is not set')

  const parsed = new URL(url)

  return {
    host:     parsed.hostname,
    port:     Number(parsed.port) || 6379,
    password: parsed.password || process.env.UPSTASH_REDIS_TOKEN,
    tls:      url.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
    maxRetriesPerRequest: null as null,
    enableReadyCheck: false,
  }
}

// ---------------------------------------------------------------------------
// Queue singleton
// ---------------------------------------------------------------------------

let _queue: Queue | null = null

export function getVideoQueue(): Queue {
  if (_queue) return _queue

  _queue = new Queue('video-jobs', {
    connection: getConnectionOptions(),
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
  _queueEvents = new QueueEvents('video-jobs', {
    connection: getConnectionOptions(),
  })
  return _queueEvents
}

// ---------------------------------------------------------------------------
// getRedisConnection — ใช้ใน videoWorker.ts
// ---------------------------------------------------------------------------

export function getRedisConnection() {
  return getConnectionOptions()
}
