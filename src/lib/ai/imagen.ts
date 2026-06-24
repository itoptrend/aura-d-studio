/**
 * Image Generation Gateway (Phase 2)
 * Supports:
 *   - Google Gemini Nano Banana (gemini-2.0-flash-preview-image-generation)
 *   - xAI Grok Imagine (grok-imagine-image-pro) via OpenAI-compatible API
 *
 * Phase 2: returns base64 data URLs stored in asset.contentText
 * Phase 3: migrate to object storage (S3/R2/Supabase Storage)
 */

const GEMINI_IMAGE_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GROK_API_BASE = 'https://api.x.ai/v1';

export interface ImageResult {
  dataUrl: string;   // data:image/png;base64,...
  mimeType: string;
  provider: string;
  model: string;
  promptUsed: string;
}

// ─── GOOGLE GEMINI (Nano Banana) ────────────────────────────────────────────
export async function generateImageGemini(params: {
  apiKey: string;
  model: string;           // 'gemini-2.0-flash-preview-image-generation'
  prompt: string;
  negativePrompt?: string;
}): Promise<ImageResult> {
  const body: Record<string, unknown> = {
    contents: [{ parts: [{ text: params.prompt }] }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE']
    }
  };

  const res = await fetch(
    `${GEMINI_IMAGE_API_BASE}/${params.model}:generateContent?key=${params.apiKey}`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini Image API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts ?? [];

  // Find the image part
  const imagePart = parts.find(
    (p: { inlineData?: { mimeType: string; data: string } }) => p.inlineData?.data
  );

  if (!imagePart?.inlineData) {
    throw new Error('Gemini ไม่ได้ส่งรูปภาพกลับมา — ลองใช้ prompt อื่นหรือตรวจสอบ API key');
  }

  const { mimeType, data: base64Data } = imagePart.inlineData;
  return {
    dataUrl: `data:${mimeType};base64,${base64Data}`,
    mimeType,
    provider: 'google',
    model: params.model,
    promptUsed: params.prompt
  };
}

// ─── GROK IMAGINE ────────────────────────────────────────────────────────────
export async function generateImageGrok(params: {
  apiKey: string;
  model: string;   // 'grok-imagine-image-pro'
  prompt: string;
}): Promise<ImageResult> {
  const res = await fetch(`${GROK_API_BASE}/images/generations`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`
    },
    body: JSON.stringify({
      model: params.model,
      prompt: params.prompt,
      n: 1,
      response_format: 'b64_json'
    })
  });

  if (!res.ok) {
    const err = await res.text();
    if (res.status === 401) throw new Error('Grok API key ไม่ถูกต้อง');
    if (res.status === 429) throw new Error('Grok API เกิน rate limit — ลองใหม่ภายหลัง');
    throw new Error(`Grok Image API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const b64 = data.data?.[0]?.b64_json;

  if (!b64) throw new Error('Grok Imagine ไม่ได้ส่งรูปภาพกลับมา');

  return {
    dataUrl: `data:image/png;base64,${b64}`,
    mimeType: 'image/png',
    provider: 'xai',
    model: params.model,
    promptUsed: params.prompt
  };
}

// ─── GATEWAY ─────────────────────────────────────────────────────────────────
export async function generateImage(providerCode: string, params: {
  apiKey: string;
  model: string;
  prompt: string;
  negativePrompt?: string;
}): Promise<ImageResult> {
  switch (providerCode) {
    case 'google': return generateImageGemini(params);
    case 'xai':    return generateImageGrok(params);
    default: throw new Error(`Provider "${providerCode}" ยังไม่รองรับการสร้างภาพ`);
  }
}
