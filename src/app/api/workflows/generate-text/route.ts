import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getCurrentTeamId } from '@/lib/session';
import { decryptSecret } from '@/lib/encryption';
import { generateText, estimateCreditCost } from '@/lib/ai/anthropic';
import { generateTextGemini } from '@/lib/ai/google';
import { generateTextGrok } from '@/lib/ai/grok';

type GenerateParams = { apiKey: string; model: string; system?: string; prompt: string; maxTokens?: number };

async function callAI(providerCode: string, params: GenerateParams) {
  switch (providerCode) {
    case 'anthropic': return generateText(params);
    case 'google':    return generateTextGemini(params);
    case 'xai':       return generateTextGrok(params);
    default: throw new Error(`ยังไม่รองรับ provider "${providerCode}"`);
  }
}

const schema = z.object({
  credentialId: z.string().uuid(),
  modelCode: z.string().min(1),
  prompt: z.string().min(1),
  system: z.string().optional()
});

export async function POST(req: Request) {
  const teamId = await getCurrentTeamId();
  if (!teamId) return NextResponse.json({ error: 'ยังไม่ได้เข้าสู่ระบบ' }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
  }
  const { credentialId, modelCode, prompt, system } = parsed.data;

  const credential = await prisma.credential.findFirst({ where: { id: credentialId, teamId } });
  if (!credential) return NextResponse.json({ error: 'ไม่พบ API Key นี้' }, { status: 404 });

  const apiKey = decryptSecret(credential.encryptedKey, credential.encryptionIv);
  const result = await callAI(credential.providerCode, { apiKey, model: modelCode, system, prompt, maxTokens: 1024 });
  const costCredit = estimateCreditCost(result.outputTokens);

  return NextResponse.json({ text: result.text, costCredit });
}
