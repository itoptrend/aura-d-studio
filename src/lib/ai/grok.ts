// xAI Grok API wrapper
// Grok's API is OpenAI-compatible — same format, different baseURL and key prefix.
// API key format: xai-xxxxxxxx (from console.x.ai)

const GROK_API_BASE = 'https://api.x.ai/v1';

export class GrokApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'GrokApiError';
  }
}

export async function testGrokKey(
  apiKey: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const res = await fetch(`${GROK_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'grok-4.3',
        max_tokens: 8,
        messages: [{ role: 'user', content: 'ping' }]
      })
    });

    if (res.ok) return { ok: true };
    if (res.status === 401) return { ok: false, reason: 'API key ไม่ถูกต้องหรือถูกเพิกถอนแล้ว' };
    if (res.status === 429) return { ok: false, reason: 'Key นี้ใช้ครบโควต้าแล้ว แต่ key ใช้งานได้จริง' };
    return { ok: false, reason: `xAI API ตอบกลับสถานะ ${res.status}` };
  } catch {
    return { ok: false, reason: 'เชื่อมต่อ xAI API ไม่ได้ ลองใหม่อีกครั้ง' };
  }
}

export async function generateTextGrok(params: {
  apiKey: string;
  model: string;
  system?: string;
  prompt: string;
  maxTokens?: number;
}): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const messages = [];
  if (params.system) messages.push({ role: 'system', content: params.system });
  messages.push({ role: 'user', content: params.prompt });

  const res = await fetch(`${GROK_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: params.maxTokens ?? 2048,
      messages
    })
  });

  if (!res.ok) {
    const body = await res.text();
    throw new GrokApiError(`Grok API error (${res.status}): ${body}`, res.status);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? '';
  return {
    text,
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0
  };
}
