// Google Gemini API wrapper — minimal test-call implementation.
// Using the generateContent endpoint with gemini-2.0-flash-lite (fastest/cheapest
// model) just to verify the key is valid before saving it.

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export async function testGeminiKey(
  apiKey: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const res = await fetch(
      `${GEMINI_API_BASE}/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'ping' }] }],
          generationConfig: { maxOutputTokens: 8 }
        })
      }
    );

    if (res.ok) return { ok: true };
    if (res.status === 400) {
      // 400 from Gemini often means the key is valid but request has issues —
      // still treat as ok since the key authenticated successfully
      const body = await res.json().catch(() => ({}));
      if (body?.error?.status === 'INVALID_ARGUMENT') return { ok: true };
    }
    if (res.status === 401 || res.status === 403)
      return { ok: false, reason: 'API key ไม่ถูกต้องหรือไม่มีสิทธิ์ใช้งาน' };
    if (res.status === 429)
      return {
        ok: false,
        reason: 'Key นี้ใช้ครบโควต้าแล้ว (อาจเป็น Free Tier) แต่ key ใช้งานได้จริง'
      };

    return { ok: false, reason: `Gemini API ตอบกลับสถานะ ${res.status}` };
  } catch {
    return { ok: false, reason: 'เชื่อมต่อ Gemini API ไม่ได้ ลองใหม่อีกครั้ง' };
  }
}

export async function generateTextGemini(params: {
  apiKey: string;
  model: string;
  system?: string;
  prompt: string;
  maxTokens?: number;
}): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  // Gemini uses systemInstruction for system prompts, separate from contents[]
  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: params.prompt }] }],
    generationConfig: { maxOutputTokens: params.maxTokens ?? 2048 }
  };

  if (params.system) {
    body.systemInstruction = { parts: [{ text: params.system }] };
  }

  const res = await fetch(
    `${GEMINI_API_BASE}/${params.model}:generateContent?key=${params.apiKey}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${body}`);
  }

  const data = await res.json();
  const rawText =
    data.candidates?.[0]?.content?.parts?.map((p: { text: string }) => p.text).join('') ?? '';

  // Strip HTML tags so downloaded .txt files are clean plain text
  const text = rawText.replace(/<[^>]+>/g, '').trim();

  const inputTokens = data.usageMetadata?.promptTokenCount ?? 0;
  const outputTokens = data.usageMetadata?.candidatesTokenCount ?? 0;

  return { text, inputTokens, outputTokens };
}
