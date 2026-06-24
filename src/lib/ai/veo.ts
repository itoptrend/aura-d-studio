// src/lib/ai/veo.ts
// Google Veo 3.1 video generation
// API: generativelanguage.googleapis.com (Gemini Developer API)
// Flow: generateVideo (async) → poll operationName → download → upload to Blob

import { put } from '@vercel/blob'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VeoGenerateResponse {
  name: string  // operation name, e.g. "operations/abc123" — ใช้ poll
}

interface VeoOperationResponse {
  name:     string
  done?:    boolean
  error?:   { code: number; message: string; status: string }
  response?: {
    '@type':    string
    generateVideoResponse: {
      generatedSamples: Array<{
        video: { uri: string }  // gs:// URI หรือ base64
      }>
    }
  }
}

// Error codes ที่ไม่ควร retry
const NON_RETRYABLE_STATUSES = new Set([
  'INVALID_ARGUMENT',
  'PERMISSION_DENIED',
  'RESOURCE_EXHAUSTED',
  // Content policy rejection
  'SAFETY',
])

// ---------------------------------------------------------------------------
// Step 1: ส่ง prompt → รับ operation name
// ---------------------------------------------------------------------------

export async function startVeoGeneration(opts: {
  apiKey:        string
  prompt:        string
  negativePrompt?: string
  durationSecs:  number
  aspectRatio:   string  // '16:9' | '9:16' | '1:1'
  modelCode:     string  // 'veo-3.0-generate-preview'
}): Promise<string> {  // returns operationName
  const { apiKey, prompt, negativePrompt, durationSecs, aspectRatio, modelCode } = opts

  const body = {
    model: `models/${modelCode}`,
    instances: [{
      prompt,
      ...(negativePrompt ? { negativePrompt } : {}),
    }],
    parameters: {
      aspectRatio,
      durationSeconds: durationSecs,
      sampleCount: 1,
    },
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelCode}:generateVideo?key=${apiKey}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const status = err?.error?.status as string | undefined

    // Content policy rejection — ไม่ควร retry
    if (status && NON_RETRYABLE_STATUSES.has(status)) {
      const e = new Error(
        status === 'SAFETY'
          ? 'Prompt ไม่ผ่านนโยบายเนื้อหาของ Google Veo — กรุณาแก้ไข prompt แล้วลองใหม่'
          : `Veo API ปฏิเสธ request: ${err?.error?.message ?? status}`
      )
      ;(e as any).code = 'content_policy'
      ;(e as any).nonRetryable = true
      throw e
    }

    throw new Error(`Veo API error ${res.status}: ${err?.error?.message ?? 'Unknown error'}`)
  }

  const data: VeoGenerateResponse = await res.json()
  if (!data.name) throw new Error('Veo ไม่ return operation name')
  return data.name
}

// ---------------------------------------------------------------------------
// Step 2: Poll operation จนเสร็จ (เรียกจาก Worker ในลูป)
// ---------------------------------------------------------------------------

export async function pollVeoOperation(opts: {
  apiKey:        string
  operationName: string  // e.g. 'operations/abc123'
}): Promise<{ done: boolean; videoUri?: string; error?: string; nonRetryable?: boolean }> {
  const { apiKey, operationName } = opts

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`,
    { method: 'GET' }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return { done: false, error: `Poll error ${res.status}: ${err?.error?.message}` }
  }

  const data: VeoOperationResponse = await res.json()

  if (!data.done) return { done: false }

  if (data.error) {
    const isNonRetryable = NON_RETRYABLE_STATUSES.has(data.error.status)
    return {
      done:         true,
      error:        `Veo สร้างวิดีโอไม่สำเร็จ: ${data.error.message}`,
      nonRetryable: isNonRetryable,
    }
  }

  const uri = data.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri
  if (!uri) return { done: true, error: 'Veo ไม่ return video URI' }

  return { done: true, videoUri: uri }
}

// ---------------------------------------------------------------------------
// Step 3: Download video from Google storage → upload ไป Vercel Blob
// ---------------------------------------------------------------------------

export async function uploadVeoVideoToBlob(opts: {
  apiKey:    string
  videoUri:  string   // URI จาก Veo (อาจเป็น https หรือ base64 data URI)
  jobId:     string
}): Promise<string> {  // returns Vercel Blob public URL
  const { apiKey, videoUri, jobId } = opts

  let videoBuffer: Buffer

  if (videoUri.startsWith('data:')) {
    // base64 data URI
    const base64 = videoUri.split(',')[1]
    videoBuffer = Buffer.from(base64, 'base64')
  } else {
    // https URL — download ก่อน (แนบ API key ถ้าเป็น googleapis.com)
    const downloadUrl = videoUri.includes('googleapis.com')
      ? `${videoUri}&key=${apiKey}`
      : videoUri

    const dlRes = await fetch(downloadUrl)
    if (!dlRes.ok) throw new Error(`ดาวน์โหลดวิดีโอล้มเหลว: ${dlRes.status}`)
    videoBuffer = Buffer.from(await dlRes.arrayBuffer())
  }

  const filename = `videos/${jobId}-${Date.now()}.mp4`
  const blob = await put(filename, videoBuffer, {
    access:      'public',
    contentType: 'video/mp4',
  })

  return blob.url
}
