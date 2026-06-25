// src/lib/ai/kling.ts
// Kling AI video generation
// API: api.klingai.com
// Flow: POST /v1/videos/text2video → poll /v1/videos/text2video/{task_id} → upload to Blob

import { put } from '@vercel/blob'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KlingCreateResponse {
  code:       number
  message:    string
  request_id: string
  data: {
    task_id:     string
    task_status: string  // submitted | processing | succeed | failed
  }
}

interface KlingQueryResponse {
  code:       number
  message:    string
  request_id: string
  data: {
    task_id:     string
    task_status: string
    task_status_msg?: string
    created_at:  number
    updated_at:  number
    task_result?: {
      videos?: Array<{
        id:       string
        url:      string
        duration: string
      }>
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
  apiKey:        string
  prompt:        string
  negativePrompt?: string
  modelCode:     string   // 'kling-v2-5-pro' | 'kling-v2-master' | 'kling-v1-6-pro'
  durationSecs:  number   // 5 | 10
  aspectRatio:   string   // '16:9' | '9:16' | '1:1'
}): Promise<string> {  // returns task_id
  const { apiKey, prompt, negativePrompt, modelCode, durationSecs, aspectRatio } = opts

  const body = {
    model_name:      modelCode,
    prompt:          prompt,
    negative_prompt: negativePrompt || undefined,
    cfg_scale:       0.5,
    mode:            'std',          // std | pro
    aspect_ratio:    aspectRatio,
    duration:        String(durationSecs),
  }

  const res = await fetch('https://api.klingai.com/v1/videos/text2video', {
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
    const e = new Error(
      data.code === 1102
        ? 'Prompt ไม่ผ่านนโยบายเนื้อหาของ Kling AI — กรุณาแก้ไข prompt แล้วลองใหม่'
        : data.code === 1103
        ? 'Credits ของ Kling AI ไม่เพียงพอ — กรุณาเติม credits'
        : `Kling API error ${data.code}: ${data.message}`
    )
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

  const res = await fetch(`https://api.klingai.com/v1/videos/text2video/${taskId}`, {
    method:  'GET',
    headers: { 'Authorization': `Bearer ${apiKey}` },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
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
    const isContentPolicy = data.data?.task_status_msg?.includes('content')
    return {
      done:         true,
      error:        `Kling สร้างวิดีโอไม่สำเร็จ: ${data.data?.task_status_msg ?? 'Unknown error'}`,
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
