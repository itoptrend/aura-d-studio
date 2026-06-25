// src/lib/ai/veo-vertex.ts
// Google Veo 3.1 via Vertex AI (ต้องใช้ Service Account JSON — ไม่ใช่ AI Studio API Key)
//
// Flow:
//   1. แปลง Service Account JSON → Bearer token (Google OAuth2)
//   2. POST :predictLongRunning → รับ operationName
//   3. POST :fetchPredictOperation (poll) → รับ video bytes หรือ gcsUri
//   4. Upload → Vercel Blob → return URL
//
// Credential format ที่ user ต้อง paste ใน Connected AI:
//   JSON ทั้งหมดของ Service Account key file (ไม่ใช่ API Key string)
//   รูปแบบ: { "type": "service_account", "project_id": "...", "private_key": "...", ... }

import { put } from '@vercel/blob'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ServiceAccountKey {
  type:                        string
  project_id:                  string
  private_key_id:              string
  private_key:                 string
  client_email:                string
  client_id:                   string
  auth_uri:                    string
  token_uri:                   string
  auth_provider_x509_cert_url: string
  client_x509_cert_url:        string
}

interface PredictLongRunningResponse {
  name: string // e.g. "projects/PROJECT/locations/us-central1/publishers/google/models/MODEL/operations/OP_ID"
}

interface FetchPredictOperationResponse {
  name:  string
  done?: boolean
  error?: { code: number; message: string; status: string }
  response?: {
    '@type': string
    videos?: Array<{
      bytesBase64Encoded?: string
      gcsUri?:             string
      mimeType?:           string
    }>
    raiMediaFilteredCount?: number
  }
}

const VERTEX_LOCATION = 'us-central1'
const NON_RETRYABLE_STATUSES = new Set(['INVALID_ARGUMENT', 'PERMISSION_DENIED', 'SAFETY', 'RESOURCE_EXHAUSTED'])

// ---------------------------------------------------------------------------
// Auth: Service Account JSON → Bearer token
// ---------------------------------------------------------------------------

async function getVertexBearerToken(serviceAccountJson: string): Promise<string> {
  let sa: ServiceAccountKey
  try {
    sa = JSON.parse(serviceAccountJson) as ServiceAccountKey
  } catch {
    throw new Error('Vertex AI Credential ไม่ใช่ JSON ที่ถูกต้อง — กรุณา paste Service Account Key JSON')
  }

  if (sa.type !== 'service_account') {
    throw new Error('Credential ไม่ใช่ Service Account type — ตรวจสอบว่า paste ถูก JSON หรือยัง')
  }

  // สร้าง JWT assertion สำหรับแลก Bearer token
  const now   = Math.floor(Date.now() / 1000)
  const scope = 'https://www.googleapis.com/auth/cloud-platform'

  const header  = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: sa.client_email,
    sub: sa.client_email,
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
    scope,
  }

  const b64url = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url')

  const signingInput = `${b64url(header)}.${b64url(payload)}`

  // Sign ด้วย RS256 (Web Crypto API — available ใน Next.js edge/node)
  const privateKey = await importRsaPrivateKey(sa.private_key)
  const signature  = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    privateKey,
    new TextEncoder().encode(signingInput)
  )
  const jwt = `${signingInput}.${Buffer.from(signature).toString('base64url')}`

  // แลก JWT → Access Token
  const tokenRes = await fetch(sa.token_uri, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:  jwt,
    }),
  })

  if (!tokenRes.ok) {
    const err = await tokenRes.text()
    throw new Error(`แลก Vertex AI token ไม่สำเร็จ: ${tokenRes.status} — ${err}`)
  }

  const tokenData = await tokenRes.json() as { access_token: string }
  return tokenData.access_token
}

// Import RSA private key จาก PEM format
async function importRsaPrivateKey(pem: string): Promise<CryptoKey> {
  // ลบ header/footer และ newlines ออก
  const pemBody = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\n/g, '')
    .trim()

  const keyData = Buffer.from(pemBody, 'base64')

  return crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )
}

// ---------------------------------------------------------------------------
// Step 1: ส่ง prompt → รับ operationName
// ---------------------------------------------------------------------------

export async function startVeoVertexGeneration(opts: {
  serviceAccountJson: string   // Service Account Key JSON string (decrypted)
  modelCode:          string   // 'veo-3.1-generate-preview'
  prompt:             string
  negativePrompt?:    string
  durationSecs:       number
  aspectRatio:        string
}): Promise<string> {
  const { serviceAccountJson, modelCode, prompt, negativePrompt, durationSecs, aspectRatio } = opts

  const sa          = JSON.parse(serviceAccountJson) as ServiceAccountKey
  const projectId   = sa.project_id
  const bearerToken = await getVertexBearerToken(serviceAccountJson)

  const endpoint = `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${VERTEX_LOCATION}/publishers/google/models/${modelCode}:predictLongRunning`

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
      resolution:      '720p',
      generateAudio:   false,  // ปิด audio เพื่อความเร็ว (เปิดได้ถ้าต้องการ)
    },
  }

  const res = await fetch(endpoint, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${bearerToken}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string; status?: string } }
    const status = err?.error?.status ?? ''
    const isNonRetryable = NON_RETRYABLE_STATUSES.has(status) || res.status === 400

    const e = new Error(
      status === 'SAFETY'
        ? 'Prompt ไม่ผ่านนโยบายเนื้อหาของ Google Veo — กรุณาแก้ไข prompt แล้วลองใหม่'
        : status === 'PERMISSION_DENIED'
        ? 'Service Account ไม่มีสิทธิ์ใช้ Vertex AI Veo — ตรวจสอบ IAM Role (Vertex AI User)'
        : `Vertex AI Veo error ${res.status}: ${err?.error?.message ?? 'Unknown error'}`
    )
    ;(e as any).code         = isNonRetryable ? 'content_policy' : 'api_error'
    ;(e as any).nonRetryable = isNonRetryable
    throw e
  }

  const data = await res.json() as PredictLongRunningResponse
  if (!data.name) throw new Error('Vertex AI Veo ไม่ return operation name')
  return data.name
}

// ---------------------------------------------------------------------------
// Step 2: Poll operation
// ---------------------------------------------------------------------------

export async function pollVeoVertexOperation(opts: {
  serviceAccountJson: string
  operationName:      string   // full operation name จาก step 1
  modelCode:          string
}): Promise<{ done: boolean; videoBase64?: string; gcsUri?: string; error?: string; nonRetryable?: boolean }> {
  const { serviceAccountJson, operationName, modelCode } = opts

  const sa          = JSON.parse(serviceAccountJson) as ServiceAccountKey
  const projectId   = sa.project_id
  const bearerToken = await getVertexBearerToken(serviceAccountJson)

  const endpoint = `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${VERTEX_LOCATION}/publishers/google/models/${modelCode}:fetchPredictOperation`

  const res = await fetch(endpoint, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${bearerToken}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ operationName }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
    return { done: false, error: `Poll error ${res.status}: ${err?.error?.message}` }
  }

  const data = await res.json() as FetchPredictOperationResponse

  if (!data.done) return { done: false }

  if (data.error) {
    const isNonRetryable = NON_RETRYABLE_STATUSES.has(data.error.status)
    return {
      done:         true,
      error:        `Veo สร้างวิดีโอไม่สำเร็จ: ${data.error.message}`,
      nonRetryable: isNonRetryable,
    }
  }

  const video = data.response?.videos?.[0]
  if (!video) return { done: true, error: 'Vertex AI Veo ไม่ return video data' }

  return {
    done:        true,
    videoBase64: video.bytesBase64Encoded,
    gcsUri:      video.gcsUri,
  }
}

// ---------------------------------------------------------------------------
// Step 3: Upload to Vercel Blob
// ---------------------------------------------------------------------------

export async function uploadVeoVertexVideoToBlob(opts: {
  videoBase64?: string
  gcsUri?:      string
  jobId:        string
}): Promise<string> {
  const { videoBase64, gcsUri, jobId } = opts

  let videoBuffer: Buffer

  if (videoBase64) {
    videoBuffer = Buffer.from(videoBase64, 'base64')
  } else if (gcsUri) {
    // GCS URI — ต้อง download ผ่าน Google Storage JSON API
    // แต่ในกรณีนี้เราไม่ได้ pass token มา — throw แล้วให้ caller handle
    throw new Error(
      'Vertex AI ส่ง GCS URI กลับมา — กรุณาตั้งค่า Cloud Storage bucket ใน parameters.storageUri ' +
      'หรือไม่ระบุ storageUri เพื่อรับ base64 แทน'
    )
  } else {
    throw new Error('ไม่มีข้อมูลวิดีโอจาก Vertex AI')
  }

  const filename = `videos/${jobId}-${Date.now()}.mp4`
  const blob = await put(filename, videoBuffer, {
    access:      'public',
    contentType: 'video/mp4',
  })

  return blob.url
}
