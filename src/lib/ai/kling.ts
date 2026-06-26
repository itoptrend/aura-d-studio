// src/lib/ai/kling.ts
// Kling AI video generation — API Singapore endpoint
// Flow: POST /v1/videos/text2video → poll /v1/videos/text2video/{task_id} → upload to Blob

import { put } from '@vercel/blob'

// ---------------------------------------------------------------------------
// Kling API base URL (Singapore — ใกล้ Vercel sin1 ที่สุด)
// ---------------------------------------------------------------------------
const KLING_BASE = 'https://api-singapore.klingai.com'

// ---------------------------------------------------------------------------
// Model mapping
// DB code → Kling API params
// Kling API รองรับ duration: "5" | "10" เท่านั้น (ไม่รองรับ "8")
// V2 models ไม่รองรับ cfg_scale และ mode parameter
// ---------------------------------------------------------------------------

interface KlingApiParams {
  apiModelName:   string
  mode?:          'std' | 'pro'   // undefined = ไม่ส่ง (v2 models)
  supportsCfg:    boolean
}

const MODEL_MAP: Record<string, KlingApiParams> = {
  'kling-v1-6-pro':  { apiModelName: 'kling-v1-6',       mode: 'pro', supportsCfg: true  },
  'kling-v2-master': { apiModelName: 'kling-v2-master',                supportsCfg: false },
  'kling-v2-5-pro':  { apiModelName: 'kling-v2-5-turbo', mode: 'std', supportsCfg: false },
}

// แปลง duration ให้ตรงกับที่ Kling รองรับ: 5 หรือ 10 เท่านั้น
function toKlingDuration(secs: number): string {
  return secs <= 5 ? '5' : '10'
}

function getKlingParams(modelCode: string): KlingApiParams {
  return MODEL_MAP[modelCode] ?? { apiModelName: modelCode, mode: 'std', supportsCfg: true }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KlingCreateResponse {
  code:       number
  message:    string
  request_id: string
  data: {
    task_id:     string
    task_status: string
  }
}

interface KlingQueryResponse {
  code:       number
  message:    string
  request_id: string
  data: {
    task_id:          string
    task_status:      string
    task_status_msg?: string
    created_at:       number
    updated_at:       number
    task_result?: {
      videos?: Array<{ id: string; url: string; duration: string }>
    }
  }
}

// Error codes ที่ไม่ควร retry
const NON_RETRYABLE_CODES = new Set([
  1101, // Invalid parameter
  1102, // Content policy violation
  1103, // Insufficient credits
])

// ---------------------------------------------------------------------------
// Step 1: ส่ง prompt → รับ task_id
// ---------------------------------------------------------------------------

export async function startKlingGeneration(opts: {
  apiKey:          string
  prompt:          string
  negativePrompt?: string
  modelCode:       string
  durationSecs:    number
  aspectRatio:     string
}): Promise<string> {
  const { apiKey, prompt, negativePrompt, modelCode, durationSecs, aspectRatio } = opts

  const { apiModelName, mode, supportsCfg } = getKlingParams(modelCode)
  const duration = toKlingDuration(durationSecs)

  // สร้าง body ตาม capability ของแต่ละโมเดล
  const body: Record<string, unknown> = {
    model_name:      apiModelName,
    prompt,
    aspect_ratio:    aspectRatio,
    duration,
  }

  if (negativePrompt) body.negative_prompt = negativePrompt
  if (supportsCfg)    body.cfg_scale = 0.5
  if (mode)           body.mode = mode

  const res = await fetch(`${KLING_BASE}/v1/videos/text2video`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  const data: KlingCreateResponse = await res.json()

  if (!res.ok || data.code !== 0) {
    const isNonRetryable = NON_RETRYABLE_CODES.has(data.code)
    const message =
      data.code === 1102 ? 'Prompt ไม่ผ่านนโยบายเนื้อหาของ Kling AI — กรุณาแก้ไข prompt แล้วลองใหม่'
      : data.code === 1103 ? 'Credits ของ Kling AI ไม่เพียงพอ — กรุณาเติม credits'
      : data.code === 1101 ? `Kling API: parameter ไม่ถูกต้อง — ${data.message}`
      : `Kling API error ${data.code}: ${data.message}`

    const e = new Error(message)
    ;(e as any).code         = isNonRetryable ? 'content_policy' : 'api_error'
    ;(e as any).nonRetryable = isNonRetryable
    throw e
  }

  if (!data.data?.task_id) throw new Error('Kling ไม่ return task_id')
  return data.data.task_id
}

// ---------------------------------------------------------------------------
// Step 2: Poll task จนเสร็จ
// ---------------------------------------------------------------------------

export async function pollKlingTask(opts: {
  apiKey: string
  taskId: string
}): Promise<{ done: boolean; videoUrl?: string; error?: string; nonRetryable?: boolean }> {
  const { apiKey, taskId } = opts

  const res = await fetch(`${KLING_BASE}/v1/videos/text2video/${taskId}`, {
    method:  'GET',
    headers: { 'Authorization': `Bearer ${apiKey}` },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string }
    return { done: false, error: `Poll error ${res.status}: ${err?.message}` }
  }

  const data: KlingQueryResponse = await res.json()

  if (data.code !== 0) {
    return { done: true, error: `Kling error ${data.code}: ${data.message}` }
  }

  const status = data.data?.task_status

  if (status === 'submitted' || status === 'processing') {
    return { done: false }
  }

  if (status === 'failed') {
    const msg = data.data?.task_status_msg ?? 'Unknown error'
    const isContentPolicy = msg.toLowerCase().includes('content') || msg.toLowerCase().includes('policy')
    return {
      done:         true,
      error:        `Kling สร้างวิดีโอไม่สำเร็จ: ${msg}`,
      nonRetryable: isContentPolicy,
    }
  }

  if (status === 'succeed') {
    const videoUrl = data.data?.task_result?.videos?.[0]?.url
    if (!videoUrl) return { done: true, error: 'Kling ไม่ return video URL' }
    return { done: true, videoUrl }
  }

  return { done: false }
}

// ---------------------------------------------------------------------------
// Step 3: Download video → upload to Vercel Blob
// ---------------------------------------------------------------------------

export async function uploadKlingVideoToBlob(opts: {
  videoUrl: string
  jobId:    string
}): Promise<string> {
  const { videoUrl, jobId } = opts

  const dlRes = await fetch(videoUrl)
  if (!dlRes.ok) throw new Error(`ดาวน์โหลดวิดีโอจาก Kling ล้มเหลว: ${dlRes.status}`)

  const videoBuffer = Buffer.from(await dlRes.arrayBuffer())
  const filename    = `videos/${jobId}-${Date.now()}.mp4`

  const blob = await put(filename, videoBuffer, {
    access:      'public',
    contentType: 'video/mp4',
  })

  return blob.url
}
