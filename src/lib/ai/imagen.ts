/**
 * Image Generation Gateway (Phase 2)
 * Supports:
 *   - Google Imagen 3 (imagen-3.0-generate-002) via /predict endpoint — full aspect ratio support
 *   - Google Gemini Flash Image (gemini-2.0-flash-preview-image-generation) — 1:1 only
 *   - xAI Grok Imagine (grok-imagine-image-pro) via OpenAI-compatible API
 */

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GROK_API_BASE = 'https://api.x.ai/v1';

export interface ImageResult {
  dataUrl: string;
  mimeType: string;
  provider: string;
  model: string;
  promptUsed: string;
}

// Grok: map aspect ratio to pixel size
const GROK_SIZE: Record<string, string> = {
  '1:1':  '1024x1024',
  '16:9': '1344x768',
  '9:16': '768x1344',
  '4:3':  '1024x768',
};

// ─── GOOGLE GEMINI (Nano Banana - gemini-2.5-flash-image) ────────────────────
// Correct aspectRatio field: generationConfig.imageConfig.aspectRatio
// Supported: "1:1" | "16:9" | "9:16" | "4:3" | "3:4" | "4:5" | "5:4" | "2:3" | "3:2" | "21:9"
async function generateImageGeminiFlash(params: {
  apiKey: string;
  model: string;
  prompt: string;
  aspectRatio?: string;
}): Promise<ImageResult> {
  const ar = params.aspectRatio ?? '1:1';

  const res = await fetch(
    `${GEMINI_API_BASE}/${params.model}:generateContent?key=${params.apiKey}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: params.prompt }] }],
        generationConfig: {
          responseModalities: ['IMAGE'],
          imageConfig: { aspectRatio: ar }   // ✅ correct field (not imageGenerationConfig)
        }
      })
    }
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
    throw new Error('Gemini ไม่ได้ส่งรูปภาพกลับมา — ลองใช้ prompt อื่น');
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

// ─── GOOGLE — gateway ─────────────────────────────────────────────────────────
export async function generateImageGemini(params: {
  apiKey: string;
  model: string;
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: string;
}): Promise<ImageResult> {
  return generateImageGeminiFlash(params);
}

// ─── GROK IMAGINE ────────────────────────────────────────────────────────────
export async function generateImageGrok(params: {
  apiKey: string;
  model: string;
  prompt: string;
  aspectRatio?: string;
}): Promise<ImageResult> {
  const size = (params.aspectRatio && GROK_SIZE[params.aspectRatio])
    ? GROK_SIZE[params.aspectRatio]
    : '1024x1024';

  const res = await fetch(`${GROK_API_BASE}/images/generations`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${params.apiKey}` },
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

