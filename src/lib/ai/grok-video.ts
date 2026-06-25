// src/lib/ai/grok-video.ts
// xAI Grok Imagine Video generation
// API: api.x.ai/v1/videos
// Flow: POST /v1/videos/generations → poll /v1/videos/{request_id} → upload to Blob

import { put } from '@vercel/blob'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GrokVideoCreateResponse {
  request_id: string
  status:     string  // 'queued' | 'processing' | 'done' | 'failed' | 'expired'
}

interface GrokVideoQueryResponse {
  request_id: string
  status:     string
  video?: {
    url:      string
    duration: number
  }
  error?: string
}

// ---------------------------------------------------------------------------
// Step 1: ส่ง prompt → รับ request_id
// ---------------------------------------------------------------------------

export async function startGrokVideoGeneration(opts: {
  apiKey:       string
  prompt:       string
  modelCode:    string   // 'grok-imagine-video'
  durationSecs: number   // 5 | 8 | 10
  aspectRatio:  string   // '16:9' | '9:16' | '1:1'
}): Promise<string> {  // returns request_id
  const { apiKey, prompt, modelCode, durationSecs, aspectRatio } = opts

  const body = {
    model:        modelCode,
    prompt:       prompt,
    duration:     durationSecs,
    aspect_ratio: aspectRatio,
    resolution:   '720p',
  }

  const res = await fetch('https://api.x.ai/v1/videos/generations', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const isContentPolicy = res.status === 400 || err?.error?.includes('content')
    const e = new Error(
      isContentPolicy
        ? 'Prompt ไม่ผ่านนโยบายเนื้อหาของ xAI Grok — กรุณาแก้ไข prompt'
        : `Grok Video API error ${res.status}: ${err?.error ?? 'Unknown error'}`
    )
    ;(e as any).code         = isContentPolicy ? 'content_policy' : 'api_error'
    ;(e as any).nonRetryable = isContentPolicy
    throw e
  }

  const data: GrokVideoCreateResponse = await res.json()
  if (!data.request_id) throw new Error('Grok ไม่ return request_id')
  return data.request_id
}

// ---------------------------------------------------------------------------
// Step 2: Poll จนเสร็จ
// ---------------------------------------------------------------------------

export async function pollGrokVideo(opts: {
  apiKey:    string
  requestId: string
}): Promise<{ done: boolean; videoUrl?: string; error?: string; nonRetryable?: boolean }> {
  const { apiKey, requestId } = opts

  const res = await fetch(`https://api.x.ai/v1/videos/${requestId}`, {
    method:  'GET',
    headers: { 'Authorization': `Bearer ${apiKey}` },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return { done: false, error: `Poll error ${res.status}: ${err?.error}` }
  }

  const data: GrokVideoQueryResponse = await res.json()

  switch (data.status) {
    case 'queued':
    case 'processing':
      return { done: false }

    case 'done': {
      const videoUrl = data.video?.url
      if (!videoUrl) return { done: true, error: 'Grok ไม่ return video URL' }
      return { done: true, videoUrl }
    }

    case 'failed':
      return { done: true, error: `Grok สร้างวิดีโอไม่สำเร็จ: ${data.error ?? 'Unknown error'}` }

    case 'expired':
      return { done: true, error: 'Grok request หมดอายุก่อนเสร็จ — กรุณาลองใหม่', nonRetryable: false }

    default:
      return { done: false }
  }
}

// ---------------------------------------------------------------------------
// Step 3: Download → upload to Vercel Blob
// ---------------------------------------------------------------------------

export async function uploadGrokVideoToBlob(opts: {
  videoUrl: string
  jobId:    string
}): Promise<string> {
  const { videoUrl, jobId } = opts

  const dlRes = await fetch(videoUrl)
  if (!dlRes.ok) throw new Error(`ดาวน์โหลดวิดีโอจาก Grok ล้มเหลว: ${dlRes.status}`)

  const videoBuffer = Buffer.from(await dlRes.arrayBuffer())
  const filename    = `videos/${jobId}-${Date.now()}.mp4`

  const blob = await put(filename, videoBuffer, {
    access:      'public',
    contentType: 'video/mp4',
  })

  return blob.url
}
