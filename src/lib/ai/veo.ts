// src/lib/ai/veo.ts
// Google Veo 3.1 via Gemini API (AI Studio Key ธรรมดา — ไม่ต้องใช้ Vertex AI)
//
// Endpoint: generativelanguage.googleapis.com/v1beta/models/{model}:predictLongRunning
// Auth: x-goog-api-key header (AI Studio Key)
//
// Flow:
//   1. POST :predictLongRunning → รับ operationName
//   2. GET  :operations/{name}  → poll จนเสร็จ
//   3. video bytes → upload → Vercel Blob

import { put } from '@vercel/blob'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'

// Model codes ที่รองรับ
const VALID_MODELS = [
  'veo-3.1-generate-preview',
  'veo-3.1-fast-generate-preview',
  'veo-3.0-generate-preview',
] as const

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LongRunningOperation {
  name:     string
  done?:    boolean
  error?:   { code: number; message: string; status: string }
  response?: {
    '@type':           string
    generatedSamples?: Array<{
      video?: {
        uri?:              string
        videoMetadata?:    { durationSeconds: number }
      }
      encodedVideo?: string   // base64
      mimeType?:     string
    }>
  }
}

// ---------------------------------------------------------------------------
// Step 1: ส่ง prompt → รับ operationName
// ---------------------------------------------------------------------------

export async function startVeoGeneration(opts: {
  apiKey:          string
  modelCode:       string
  prompt:          string
  negativePrompt?: string
  durationSecs:    number
  aspectRatio:     string
}): Promise<string> {
  const { apiKey, prompt, negativePrompt, durationSecs, aspectRatio } = opts

  // ใช้ model ที่ valid เท่านั้น
  const modelCode = VALID_MODELS.includes(opts.modelCode as any)
    ? opts.modelCode
    : 'veo-3.1-generate-preview'

  const url = `${GEMINI_BASE}/models/${modelCode}:predictLongRunning?key=${apiKey}`

  const body = {
    instances: [
      {
        prompt,
        ...(negativePrompt ? { negativePrompt } : {}),
      },
    ],
    parameters: {
      aspectRatio,
      durationSeconds: String(durationSecs),
      sampleCount:     1,
    },
  }

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string; status?: string } }
    const status  = err?.error?.status ?? ''
    const message = err?.error?.message ?? 'Unknown error'

    const isContentPolicy = status === 'INVALID_ARGUMENT' || message.toLowerCase().includes('safety')
    const e = new Error(
      isContentPolicy
        ? 'Prompt ไม่ผ่านนโยบายเนื้อหาของ Google Veo — กรุณาแก้ไข prompt'
        : status === 'PERMISSION_DENIED'
        ? 'API Key ไม่มีสิทธิ์ใช้ Veo — ตรวจสอบว่า Key มาจาก AI Studio และมี Veo access'
        : `Veo API error ${res.status}: ${message}`
    )
    ;(e as any).code         = isContentPolicy ? 'content_policy' : 'api_error'
    ;(e as any).nonRetryable = isContentPolicy || status === 'PERMISSION_DENIED'
    throw e
  }

  const data = await res.json() as LongRunningOperation
  if (!data.name) throw new Error('Veo ไม่ return operation name')
  return data.name
}

// ---------------------------------------------------------------------------
// Step 2: Poll operation จนเสร็จ
// ---------------------------------------------------------------------------

export async function pollVeoOperation(opts: {
  apiKey:        string
  operationName: string
}): Promise<{
  done:          boolean
  videoUri?:     string
  videoBase64?:  string
  error?:        string
  nonRetryable?: boolean
}> {
  const { apiKey, operationName } = opts

  // operationName format: "operations/xxxx" หรือ full path
  const opPath = operationName.startsWith('operations/')
    ? operationName
    : `operations/${operationName.split('/').pop()}`

  const url = `${GEMINI_BASE}/${opPath}?key=${apiKey}`

  const res = await fetch(url, {
    method:  'GET',
    headers: { 'Content-Type': 'application/json' },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
    return { done: false, error: `Poll error ${res.status}: ${err?.error?.message}` }
  }

  const data = await res.json() as LongRunningOperation

  if (!data.done) return { done: false }

  if (data.error) {
    const isNonRetryable = ['INVALID_ARGUMENT', 'PERMISSION_DENIED', 'SAFETY'].includes(data.error.status)
    return {
      done:         true,
      error:        `Veo error: ${data.error.message}`,
      nonRetryable: isNonRetryable,
    }
  }

  const sample = data.response?.generatedSamples?.[0]
  if (!sample) return { done: true, error: 'Veo ไม่ return video data' }

  return {
    done:         true,
    videoUri:     sample.video?.uri,
    videoBase64:  sample.encodedVideo,
  }
}

// ---------------------------------------------------------------------------
// Step 3: Upload to Vercel Blob
// ---------------------------------------------------------------------------

export async function uploadVeoVideoToBlob(opts: {
  apiKey?:       string
  videoUri?:     string
  videoBase64?:  string
  jobId:         string
}): Promise<string> {
  const { apiKey, videoUri, videoBase64, jobId } = opts

  let videoBuffer: Buffer

  if (videoBase64) {
    // กรณีที่ได้ base64 กลับมาโดยตรง
    videoBuffer = Buffer.from(videoBase64, 'base64')
  } else if (videoUri) {
    // กรณีที่ได้ URI — ต้อง download พร้อม API Key
    const dlUrl = videoUri.includes('?')
      ? `${videoUri}&key=${apiKey}`
      : `${videoUri}?key=${apiKey}`

    const dlRes = await fetch(dlUrl)
    if (!dlRes.ok) throw new Error(`ดาวน์โหลดวิดีโอจาก Veo ล้มเหลว: ${dlRes.status}`)
    videoBuffer = Buffer.from(await dlRes.arrayBuffer())
  } else {
    throw new Error('ไม่มีข้อมูลวิดีโอจาก Veo')
  }

  const filename = `videos/${jobId}-${Date.now()}.mp4`
  const blob = await put(filename, videoBuffer, {
    access:      'public',
    contentType: 'video/mp4',
  })

  return blob.url
}
