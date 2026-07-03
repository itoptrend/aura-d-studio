// src/lib/ai/openrouter-video.ts
// OpenRouter Video Generation API
// Docs: https://openrouter.ai/docs/guides/overview/multimodal/video-generation
//
// Flow:
//   1. POST /api/v1/videos → รับ { id, status_url }
//   2. GET  status_url (poll) → รับ { status, unsigned_urls }
//   3. Download video → upload Vercel Blob

import { put } from '@vercel/blob'

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'

// ---------------------------------------------------------------------------
// Model codes ใน DB → OpenRouter model ID
// ---------------------------------------------------------------------------

const MODEL_MAP: Record<string, string> = {
  // Kling via OpenRouter
  'openrouter/kling-v3-pro':      'kwaivgi/kling-v3.0-pro',
  'openrouter/kling-v3-standard': 'kwaivgi/kling-v3.0-std',
  'openrouter/kling-video-o1':    'kwaivgi/kling-video-o1',
  // Veo via OpenRouter (ถ้ามี)
  'openrouter/veo-3-1-fast':      'google/veo-3.1-fast',
}

function resolveModel(modelCode: string): string {
  return MODEL_MAP[modelCode] ?? modelCode
}

// ---------------------------------------------------------------------------
// Duration normalization — แต่ละโมเดลรองรับ duration ไม่เหมือนกัน
// (เช็คได้จาก GET /api/v1/videos/models)
//   kwaivgi/kling-video-o1  → 5 หรือ 10 วินาที เท่านั้น
//   kwaivgi/kling-v3.0-*    → 3–15 วินาที
//   google/veo-3.1-*        → 4–8 วินาที
// ---------------------------------------------------------------------------

function normalizeDuration(apiModel: string, secs: number): number {
  // Kling Video O1: รับแค่ 5 หรือ 10 — ปัดไปค่าที่ใกล้ที่สุด
  if (apiModel === 'kwaivgi/kling-video-o1') {
    return secs <= 7 ? 5 : 10
  }
  // Kling v3.0 Pro/Std: 3–15 วินาที
  if (apiModel.startsWith('kwaivgi/kling-v3')) {
    return Math.min(15, Math.max(3, Math.round(secs)))
  }
  // Veo 3.1 (Fast/Lite): 4–8 วินาที
  if (apiModel.startsWith('google/veo')) {
    return Math.min(8, Math.max(4, Math.round(secs)))
  }
  return Math.round(secs)
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VideoCreateResponse {
  id:          string
  status:      string
  status_url?: string
}

interface VideoStatusResponse {
  id:           string
  status:       string   // 'queued' | 'processing' | 'completed' | 'failed'
  unsigned_urls?: string[]
  error?:       { message: string }
}

// ---------------------------------------------------------------------------
// Step 1: ส่ง prompt → รับ job id + status_url
// ---------------------------------------------------------------------------

export async function startOpenRouterVideo(opts: {
  apiKey:          string
  modelCode:       string
  prompt:          string
  negativePrompt?: string
  durationSecs:    number
  aspectRatio:     string
}): Promise<{ jobId: string; statusUrl: string }> {
  const { apiKey, modelCode, prompt, negativePrompt, durationSecs, aspectRatio } = opts

  const apiModel = resolveModel(modelCode)
  const duration = normalizeDuration(apiModel, durationSecs)

  const body: Record<string, unknown> = {
    model:        apiModel,
    prompt,
    duration,
    aspect_ratio: aspectRatio,
    resolution:   '720p',
  }

  if (negativePrompt) body.negative_prompt = negativePrompt

  const res = await fetch(`${OPENROUTER_BASE}/videos`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer':  'https://aura-d-studio.vercel.app',
      'X-Title':       'Aura-D Studio',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
    const msg = err?.error?.message ?? `OpenRouter API error ${res.status}`
    const isNonRetryable = res.status === 400 || res.status === 402 || res.status === 403

    const e = new Error(
      res.status === 402
        ? 'OpenRouter: Credits ไม่พอ — กรุณาเติม credits ที่ openrouter.ai'
        : res.status === 403
        ? 'OpenRouter: Prompt อาจโดน content filter หรือ Key ไม่มีสิทธิ์ — ลองแก้ prompt หรือตรวจสอบ Key/Credits ที่ openrouter.ai'
        : msg
    )
    ;(e as any).code         = isNonRetryable ? 'content_policy' : 'api_error'
    ;(e as any).nonRetryable = isNonRetryable
    throw e
  }

  const data = await res.json() as VideoCreateResponse

  if (!data.id) throw new Error('OpenRouter ไม่ return job id')

  // status_url อาจไม่มีใน response — สร้างจาก id แทน
  const statusUrl = data.status_url ?? `${OPENROUTER_BASE}/videos/${data.id}`

  return { jobId: data.id, statusUrl }
}

// ---------------------------------------------------------------------------
// Step 2: Poll status
// ---------------------------------------------------------------------------

export async function pollOpenRouterVideo(opts: {
  apiKey:    string
  jobId:     string
  statusUrl: string
}): Promise<{
  done:          boolean
  videoUrl?:     string
  error?:        string
  nonRetryable?: boolean
}> {
  const { apiKey, jobId, statusUrl } = opts

  // ใช้ statusUrl ถ้ามี ไม่งั้น fallback ไป /videos/{id}
  const pollUrl = statusUrl || `${OPENROUTER_BASE}/videos/${jobId}`

  const res = await fetch(pollUrl, {
    method:  'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer':  'https://aura-d-studio.vercel.app',
    },
  })

  if (!res.ok) {
    return { done: false, error: `Poll error ${res.status}` }
  }

  const data = await res.json() as VideoStatusResponse

  switch (data.status) {
    case 'queued':
    case 'processing':
      return { done: false }

    case 'completed': {
      const videoUrl = data.unsigned_urls?.[0]
      if (!videoUrl) return { done: true, error: 'OpenRouter ไม่ return video URL' }
      return { done: true, videoUrl }
    }

    case 'failed':
      return {
        done:  true,
        error: data.error?.message ?? 'OpenRouter สร้างวิดีโอไม่สำเร็จ',
      }

    default:
      return { done: false }
  }
}

// ---------------------------------------------------------------------------
// Step 3: Download → Vercel Blob
// ---------------------------------------------------------------------------

export async function uploadOpenRouterVideoToBlob(opts: {
  videoUrl: string
  jobId:    string
}): Promise<string> {
  const { videoUrl, jobId } = opts

  const dlRes = await fetch(videoUrl)
  if (!dlRes.ok) throw new Error(`ดาวน์โหลดวิดีโอจาก OpenRouter ล้มเหลว: ${dlRes.status}`)

  const buffer   = Buffer.from(await dlRes.arrayBuffer())
  const filename = `videos/${jobId}-${Date.now()}.mp4`

  const blob = await put(filename, buffer, {
    access:      'public',
    contentType: 'video/mp4',
  })

  return blob.url
}
