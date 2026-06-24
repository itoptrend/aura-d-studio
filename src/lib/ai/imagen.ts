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

// ─── GOOGLE IMAGEN 3 (/predict endpoint — supports aspectRatio natively) ────
async function generateImageImagen3(params: {
  apiKey: string;
  model: string;
  prompt: string;
  aspectRatio: string;
}): Promise<ImageResult> {
  const res = await fetch(
    `${GEMINI_API_BASE}/${params.model}:predict?key=${params.apiKey}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt: params.prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: params.aspectRatio   // '1:1' | '16:9' | '9:16' | '4:3' | '3:4'
        }
      })
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Imagen 3 API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const prediction = data.predictions?.[0];
  if (!prediction?.bytesBase64Encoded) {
    throw new Error('Imagen 3 ไม่ได้ส่งรูปภาพกลับมา — ลองใหม่อีกครั้ง');
  }

  const mimeType = prediction.mimeType ?? 'image/png';
  return {
    dataUrl: `data:${mimeType};base64,${prediction.bytesBase64Encoded}`,
    mimeType,
    provider: 'google',
    model: params.model,
    promptUsed: params.prompt
  };
}

// ─── GOOGLE GEMINI FLASH IMAGE (generateContent — 1:1 only) ─────────────────
async function generateImageGeminiFlash(params: {
  apiKey: string;
  model: string;
  prompt: string;
}): Promise<ImageResult> {
  const res = await fetch(
    `${GEMINI_API_BASE}/${params.model}:generateContent?key=${params.apiKey}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: params.prompt }] }],
        generationConfig: { responseModalities: ['IMAGE'] }
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
    throw new Error('Gemini ไม่ได้ส่งรูปภาพกลับมา — ลองใช้ Imagen 3 แทน');
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

// ─── GOOGLE — auto-route by model ────────────────────────────────────────────
export async function generateImageGemini(params: {
  apiKey: string;
  model: string;
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: string;
}): Promise<ImageResult> {
  const ar = params.aspectRatio ?? '1:1';

  // Imagen 3 models use /predict and support aspectRatio natively
  if (params.model.startsWith('imagen')) {
    return generateImageImagen3({ ...params, aspectRatio: ar });
  }

  // Gemini Flash image model — 1:1 only, warn user
  if (ar !== '1:1') {
    throw new Error(
      `โมเดล ${params.model} รองรับแค่ 1:1 เท่านั้น\n` +
      `ถ้าต้องการ ${ar} กรุณาเลือกโมเดล "Imagen 3 — สร้างภาพ HD"`
    );
  }
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

