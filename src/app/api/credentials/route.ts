import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getCurrentTeamId } from '@/lib/session';
import { encryptSecret } from '@/lib/encryption';
import { testAnthropicKey } from '@/lib/ai/anthropic';

// Only Anthropic is wired up to a real test-call in this starter slice.
// Add the equivalent test function per provider as the AI Gateway grows
// (spec §5.5 — OpenAI, Google, image-gen, video-gen).
const TESTABLE_PROVIDERS: Record<string, (key: string) => ReturnType<typeof testAnthropicKey>> = {
  anthropic: testAnthropicKey
};

export async function GET() {
  const teamId = await getCurrentTeamId();
  if (!teamId) return NextResponse.json({ error: 'ยังไม่ได้เข้าสู่ระบบ' }, { status: 401 });

  const credentials = await prisma.credential.findMany({
    where: { teamId },
    select: {
      id: true,
      providerCode: true,
      displayName: true,
      isFreeTier: true,
      capabilities: true,
      status: true,
      lastVerifiedAt: true,
      createdAt: true,
      provider: { select: { displayName: true } }
      // encryptedKey / encryptionIv intentionally never selected here —
      // the raw key never needs to leave the server after it's stored.
    },
    orderBy: { createdAt: 'desc' }
  });

  return NextResponse.json({ credentials });
}

const addCredentialSchema = z.object({
  providerCode: z.string().min(1),
  displayName: z.string().min(1),
  apiKey: z.string().min(1)
});

export async function POST(req: Request) {
  const teamId = await getCurrentTeamId();
  if (!teamId) return NextResponse.json({ error: 'ยังไม่ได้เข้าสู่ระบบ' }, { status: 401 });

  const body = await req.json();
  const parsed = addCredentialSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
  }
  const { providerCode, displayName, apiKey } = parsed.data;

  const provider = await prisma.aiProvider.findUnique({ where: { code: providerCode } });
  if (!provider) {
    return NextResponse.json({ error: 'ไม่รู้จัก AI Provider นี้' }, { status: 400 });
  }

  // spec §5.2 Auto-Detection Flow: fire a real test call before saving.
  // Don't hard-fail the whole add if we just don't have a tester for this
  // provider yet — only block when the call we DO make says the key is bad.
  const tester = TESTABLE_PROVIDERS[providerCode];
  let isFreeTier = false;
  if (tester) {
    const result = await tester(apiKey);
    if (!result.ok && !result.reason.includes('โควต้า')) {
      return NextResponse.json({ error: `ทดสอบ key ไม่สำเร็จ: ${result.reason}` }, { status: 422 });
    }
    isFreeTier = !result.ok && result.reason.includes('โควต้า'); // hit rate limit on a trivial ping → likely free tier
  }

  const { ciphertext, iv } = encryptSecret(apiKey);

  const credential = await prisma.credential.create({
    data: {
      teamId,
      providerCode,
      displayName,
      encryptedKey: ciphertext,
      encryptionIv: iv,
      isFreeTier,
      capabilities: provider.capabilities,
      status: 'active',
      lastVerifiedAt: new Date()
    },
    select: { id: true, displayName: true, providerCode: true, isFreeTier: true }
  });

  return NextResponse.json({ credential }, { status: 201 });
}
