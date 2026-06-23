import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getCurrentTeamId } from '@/lib/session';
import { encryptSecret } from '@/lib/encryption';
import { testAnthropicKey } from '@/lib/ai/anthropic';
import { testGeminiKey } from '@/lib/ai/google';
import { testGrokKey } from '@/lib/ai/grok';

type TestResult = { ok: true } | { ok: false; reason: string };
type Tester = (key: string) => Promise<TestResult>;

const TESTABLE_PROVIDERS: Record<string, Tester> = {
  anthropic: testAnthropicKey,
  google: testGeminiKey,
  xai: testGrokKey
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
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' },
      { status: 400 }
    );
  }
  const { providerCode, displayName, apiKey } = parsed.data;

  const provider = await prisma.aiProvider.findUnique({ where: { code: providerCode } });
  if (!provider) {
    return NextResponse.json({ error: 'ไม่รู้จัก AI Provider นี้' }, { status: 400 });
  }

  const tester = TESTABLE_PROVIDERS[providerCode];
  let isFreeTier = false;

  if (tester) {
    const result = await tester(apiKey);
    if (!result.ok) {
      const isQuotaLimit = result.reason.includes('โควต้า');
      if (isQuotaLimit) {
        isFreeTier = true;
      } else {
        return NextResponse.json(
          { error: `ทดสอบ key ไม่สำเร็จ: ${result.reason}` },
          { status: 422 }
        );
      }
    }
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
      lastVerifiedAt: providerCode in TESTABLE_PROVIDERS ? new Date() : null
    },
    select: { id: true, displayName: true, providerCode: true, isFreeTier: true }
  });

  return NextResponse.json({ credential }, { status: 201 });
}
