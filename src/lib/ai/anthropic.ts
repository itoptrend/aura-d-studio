// Minimal wrapper around the real Anthropic Messages API. No SDK dependency —
// just fetch — so it's easy to read end-to-end for a first vertical slice.
// Docs: https://docs.claude.com/en/api/messages

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

export class AnthropicApiError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = 'AnthropicApiError';
  }
}

/**
 * Spec §5.2 Auto-Detection Flow — fires a minimal real request to confirm
 * the key actually works before saving it, rather than trusting the format
 * of the key string alone.
 */
export async function testAnthropicKey(apiKey: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 8,
        messages: [{ role: 'user', content: 'ping' }]
      })
    });

    if (res.ok) return { ok: true };

    if (res.status === 401) return { ok: false, reason: 'API key ไม่ถูกต้องหรือถูกเพิกถอนแล้ว' };
    if (res.status === 429) return { ok: false, reason: 'Key นี้ใช้ครบโควต้าแล้ว (อาจเป็น Free Tier) แต่ key ใช้งานได้จริง' };
    return { ok: false, reason: `Anthropic ตอบกลับสถานะ ${res.status}` };
  } catch {
    return { ok: false, reason: 'เชื่อมต่อ Anthropic API ไม่ได้ ลองใหม่อีกครั้ง' };
  }
}

export async function generateText(params: {
  apiKey: string;
  model: string;
  system?: string;
  prompt: string;
  maxTokens?: number;
}): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': params.apiKey,
      'anthropic-version': ANTHROPIC_VERSION
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: params.maxTokens ?? 2048,
      system: params.system,
      messages: [{ role: 'user', content: params.prompt }]
    })
  });

  if (!res.ok) {
    const body = await res.text();
    throw new AnthropicApiError(`Anthropic API error (${res.status}): ${body}`, res.status);
  }

  const data = await res.json();
  const rawText = (data.content ?? [])
    .filter((block: { type: string }) => block.type === 'text')
    .map((block: { text: string }) => block.text)
    .join('\n');

  // Strip HTML tags so downloaded .txt files are clean plain text
  const text = rawText.replace(/<[^>]+>/g, '').trim();

  return {
    text,
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0
  };
}

// Rough cost estimate in "credits" — placeholder conversion until real
// per-provider pricing is wired up (spec §19.3 Plan Preview cost estimate).
// 1 credit ≈ 1,000 output tokens, for display purposes only.
export function estimateCreditCost(outputTokens: number): number {
  return Math.round((outputTokens / 1000) * 10) / 10;
}
