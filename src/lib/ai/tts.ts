/**
 * TTS (Text-to-Speech) Gateway — Phase 2
 * Supports:
 *   - OpenAI TTS (tts-1, tts-1-hd) — 6 voices, fast, stable
 *   - Google Gemini TTS (gemini-2.5-flash-preview-tts) — Thai support excellent
 *   - ElevenLabs — most natural voice quality
 *
 * Phase 2: returns base64 data URL stored in asset.contentText
 * Phase 3: migrate to object storage
 */

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const OPENAI_API_BASE = 'https://api.openai.com/v1';
const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';

export interface AudioResult {
  dataUrl: string;    // data:audio/mp3;base64,...
  mimeType: string;
  durationEstimate: string; // rough estimate
  provider: string;
  model: string;
  voiceUsed: string;
}

// OpenAI voices
export const OPENAI_VOICES = [
  { code: 'alloy',   label: 'Alloy — เป็นกลาง น่าฟัง' },
  { code: 'echo',    label: 'Echo — ชัดเจน เป็นทางการ' },
  { code: 'fable',   label: 'Fable — อบอุ่น เป็นมิตร' },
  { code: 'onyx',    label: 'Onyx — ทุ้ม น่าเชื่อถือ' },
  { code: 'nova',    label: 'Nova — สดใส พลังงานสูง' },
  { code: 'shimmer', label: 'Shimmer — นุ่มนวล อ่อนโยน' },
];

// Gemini TTS voices (supports Thai)
export const GEMINI_TTS_VOICES = [
  { code: 'Aoede',  label: 'Aoede — อ่อนโยน นุ่มนวล' },
  { code: 'Charon', label: 'Charon — ทุ้ม มั่นคง' },
  { code: 'Fenrir', label: 'Fenrir — พลังงาน กระฉับ' },
  { code: 'Kore',   label: 'Kore — ชัดเจน เป็นทางการ' },
  { code: 'Puck',   label: 'Puck — สนุกสนาน เป็นกันเอง' },
];

// ElevenLabs popular voice IDs
export const ELEVENLABS_VOICES = [
  { code: '21m00Tcm4TlvDq8ikWAM', label: 'Rachel — นุ่มนวล เป็นมิตร (EN)' },
  { code: 'AZnzlk1XvdvUeBnXmlld', label: 'Domi — มั่นใจ พลังงาน (EN)' },
  { code: 'EXAVITQu4vr4xnSDxMaL', label: 'Bella — อ่อนโยน (EN)' },
  { code: 'ErXwobaYiN019PkySvjV', label: 'Antoni — ทุ้ม น่าเชื่อถือ (EN)' },
  { code: 'MF3mGyEYCl7XYWbV9V6O', label: 'Elli — สดใส (EN)' },
];

// ─── OPENAI TTS ───────────────────────────────────────────────────────────────
export async function generateAudioOpenAI(params: {
  apiKey: string;
  model: string;     // 'tts-1' | 'tts-1-hd'
  text: string;
  voice?: string;    // 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
  speed?: number;    // 0.25–4.0
}): Promise<AudioResult> {
  const voice = params.voice ?? 'alloy';
  const speed = params.speed ?? 1.0;

  const res = await fetch(`${OPENAI_API_BASE}/audio/speech`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`
    },
    body: JSON.stringify({
      model: params.model,
      input: params.text,
      voice,
      speed,
      response_format: 'mp3'
    })
  });

  if (!res.ok) {
    const err = await res.text();
    if (res.status === 401) throw new Error('OpenAI API key ไม่ถูกต้อง');
    if (res.status === 429) throw new Error('OpenAI API เกิน rate limit');
    throw new Error(`OpenAI TTS error (${res.status}): ${err}`);
  }

  const buffer = await res.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  const wordsPerMinute = 150 * speed;
  const words = params.text.split(/\s+/).length;
  const seconds = Math.round((words / wordsPerMinute) * 60);

  return {
    dataUrl: `data:audio/mpeg;base64,${base64}`,
    mimeType: 'audio/mpeg',
    durationEstimate: `~${seconds} วินาที`,
    provider: 'openai',
    model: params.model,
    voiceUsed: voice
  };
}

// ─── GOOGLE GEMINI TTS ────────────────────────────────────────────────────────
// Gemini TTS returns raw PCM (16-bit, 24kHz, mono) — must wrap in WAV header
// before storing/playing in browser (data:audio/wav;base64,...)
function pcmToWav(pcmBase64: string, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): string {
  const pcmBuffer = Buffer.from(pcmBase64, 'base64');
  const dataLength = pcmBuffer.length;
  const wavBuffer = Buffer.alloc(44 + dataLength);

  // RIFF header
  wavBuffer.write('RIFF', 0);
  wavBuffer.writeUInt32LE(36 + dataLength, 4);
  wavBuffer.write('WAVE', 8);

  // fmt chunk
  wavBuffer.write('fmt ', 12);
  wavBuffer.writeUInt32LE(16, 16);              // chunk size
  wavBuffer.writeUInt16LE(1, 20);               // PCM format
  wavBuffer.writeUInt16LE(numChannels, 22);
  wavBuffer.writeUInt32LE(sampleRate, 24);
  wavBuffer.writeUInt32LE(sampleRate * numChannels * bitsPerSample / 8, 28); // byte rate
  wavBuffer.writeUInt16LE(numChannels * bitsPerSample / 8, 32);              // block align
  wavBuffer.writeUInt16LE(bitsPerSample, 34);

  // data chunk
  wavBuffer.write('data', 36);
  wavBuffer.writeUInt32LE(dataLength, 40);
  pcmBuffer.copy(wavBuffer, 44);

  return wavBuffer.toString('base64');
}

export async function generateAudioGemini(params: {
  apiKey: string;
  model: string;
  text: string;
  voice?: string;
}): Promise<AudioResult> {
  const voice = params.voice ?? 'Aoede';

  const res = await fetch(
    `${GEMINI_API_BASE}/${params.model}:generateContent?key=${params.apiKey}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: params.text }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice }
            }
          }
        }
      })
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini TTS error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const audioPart = parts.find(
    (p: { inlineData?: { mimeType: string; data: string } }) => p.inlineData?.data
  );

  if (!audioPart?.inlineData) {
    throw new Error('Gemini ไม่ได้ส่งไฟล์เสียงกลับมา — ตรวจสอบ API key หรือ quota');
  }

  const { mimeType, data: base64 } = audioPart.inlineData;

  // Gemini TTS returns raw PCM — convert to WAV for browser playback
  const isPCM = mimeType.toLowerCase().includes('pcm') || mimeType.toLowerCase().includes('l16');
  const wavBase64 = isPCM ? pcmToWav(base64) : base64;
  const finalMimeType = isPCM ? 'audio/wav' : mimeType;

  return {
    dataUrl: `data:${finalMimeType};base64,${wavBase64}`,
    mimeType: finalMimeType,
    durationEstimate: `~${Math.round(params.text.length / 15)} วินาที`,
    provider: 'google',
    model: params.model,
    voiceUsed: voice
  };
}

// ─── ELEVENLABS TTS ───────────────────────────────────────────────────────────
export async function generateAudioElevenLabs(params: {
  apiKey: string;
  model: string;       // 'eleven_multilingual_v2' | 'eleven_flash_v2_5'
  text: string;
  voice?: string;      // voice_id
  stability?: number;
  similarityBoost?: number;
}): Promise<AudioResult> {
  const voiceId = params.voice ?? '21m00Tcm4TlvDq8ikWAM'; // Rachel default
  const modelId = params.model.startsWith('eleven') ? params.model : 'eleven_multilingual_v2';

  const res = await fetch(
    `${ELEVENLABS_API_BASE}/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'xi-api-key': params.apiKey
      },
      body: JSON.stringify({
        text: params.text,
        model_id: modelId,
        voice_settings: {
          stability: params.stability ?? 0.5,
          similarity_boost: params.similarityBoost ?? 0.75
        }
      })
    }
  );

  if (!res.ok) {
    const err = await res.text();
    if (res.status === 401) throw new Error('ElevenLabs API key ไม่ถูกต้อง');
    if (res.status === 429) throw new Error('ElevenLabs เกิน quota');
    throw new Error(`ElevenLabs TTS error (${res.status}): ${err}`);
  }

  const buffer = await res.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');

  return {
    dataUrl: `data:audio/mpeg;base64,${base64}`,
    mimeType: 'audio/mpeg',
    durationEstimate: `~${Math.round(params.text.length / 15)} วินาที`,
    provider: 'elevenlabs',
    model: modelId,
    voiceUsed: voiceId
  };
}

// ─── GATEWAY ─────────────────────────────────────────────────────────────────
export async function generateAudio(providerCode: string, params: {
  apiKey: string;
  model: string;
  text: string;
  voice?: string;
  speed?: number;
}): Promise<AudioResult> {
  switch (providerCode) {
    case 'openai':      return generateAudioOpenAI(params);
    case 'google':      return generateAudioGemini(params);
    case 'elevenlabs':  return generateAudioElevenLabs(params);
    default: throw new Error(`Provider "${providerCode}" ยังไม่รองรับการสร้างเสียง`);
  }
}
