// src/lib/ai/openrouter-text.ts
// สร้างข้อความผ่าน OpenRouter (chat completions — รูปแบบเดียวกับ OpenAI)
// ทำให้ Key OpenRouter ตัวเดียว ใช้ได้ทั้งวิดีโอและงานข้อความ (สร้างรายละเอียดตัวละคร, แยกคำพูด ฯลฯ)

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'

export async function generateTextOpenRouter(params: {
  apiKey: string
  model: string
  system?: string
  prompt: string
  maxTokens?: number
}): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const messages: { role: string; content: string }[] = []
  if (params.system) messages.push({ role: 'system', content: params.system })
  messages.push({ role: 'user', content: params.prompt })

  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${params.apiKey}`,
      'HTTP-Referer':  'https://aura-d-studio.vercel.app',
      'X-Title':       'Aura-D Studio',
    },
    body: JSON.stringify({
      model:      params.model,
      messages,
      max_tokens: params.maxTokens ?? 1024,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
    const msg = res.status === 401 ? 'OpenRouter: API Key ไม่ถูกต้อง'
      : res.status === 402 ? 'OpenRouter: Credits ไม่พอ — เติมได้ที่ openrouter.ai'
      : res.status === 403 ? 'OpenRouter: Key ชนเพดานการใช้จ่าย — เช็ค Credit limit ของ Key'
      : `OpenRouter error ${res.status}: ${err?.error?.message ?? 'unknown'}`
    throw new Error(msg)
  }

  const data = await res.json() as {
    choices?: { message?: { content?: string } }[]
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  }

  const text = data.choices?.[0]?.message?.content ?? ''
  if (!text) throw new Error('OpenRouter ไม่ได้ส่งข้อความกลับมา')

  return {
    text,
    inputTokens:  data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  }
}
