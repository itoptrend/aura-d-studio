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
  dataUrl: string;
  mimeType: string;
  provider: string;
  model: string;
  promptUsed: string;
}

// Map our aspect ratio codes to provider-specific values
const GEMINI_ASPECT: Record<string, string> = {
  '1:1':  '1:1',
  '16:9': '16:9',
  '9:16': '9:16',
  '4:3':  '4:3',
};

const GROK_SIZE: Record<string, string> = {
  '1:1':  '1024x1024',
  '16:9': '1344x768',
  '9:16': '768x1344',
  '4:3':  '1024x768',
};

// ─── GOOGLE GEMINI (Nano Banana) ────────────────────────────────────────────
export async function generateImageGemini(params: {
  apiKey: string;
  model: string;
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: string;   // '1:1' | '16:9' | '9:16' | '4:3'
}): Promise<ImageResult> {
  const body: Record<string, unknown> = {
    contents: [{ parts: [{ text: params.prompt }] }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      ...(params.aspectRatio && GEMINI_ASPECT[params.aspectRatio]
        ? { imageGenerationConfig: { aspectRatio: GEMINI_ASPECT[params.aspectRatio] } }
        : {})
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
  model: string;
  prompt: string;
  aspectRatio?: string;
}): Promise<ImageResult> {
  const size = (params.aspectRatio && GROK_SIZE[params.aspectRatio]) ? GROK_SIZE[params.aspectRatio] : '1024x1024';

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
      size,
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
  aspectRatio?: string;
}): Promise<ImageResult> {
  switch (providerCode) {
    case 'google': return generateImageGemini(params);
    case 'xai':    return generateImageGrok(params);
    default: throw new Error(`Provider "${providerCode}" ยังไม่รองรับการสร้างภาพ`);
  }
}
