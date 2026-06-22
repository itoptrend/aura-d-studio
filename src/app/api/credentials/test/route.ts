import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getCurrentTeamId } from '@/lib/session';
import { decryptSecret } from '@/lib/encryption';
import { testAnthropicKey } from '@/lib/ai/anthropic';

const TESTABLE_PROVIDERS: Record<string, (key: string) => ReturnType<typeof testAnthropicKey>> = {
  anthropic: testAnthropicKey
};

const testSchema = z.object({ credentialId: z.string().uuid() });

export async function POST(req: Request) {
  const teamId = await getCurrentTeamId();
  if (!teamId) return NextResponse.json({ error: 'ยังไม่ได้เข้าสู่ระบบ' }, { status: 401 });

  const body = await req.json();
  const parsed = testSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
  }

  // Always scope by teamId too, not just id — prevents one team from probing
  // another team's credential row by guessing UUIDs (§2.4 tenant isolation).
  const credential = await prisma.credential.findFirst({
    where: { id: parsed.data.credentialId, teamId }
  });
  if (!credential) return NextResponse.json({ error: 'ไม่พบ credential นี้' }, { status: 404 });

  const tester = TESTABLE_PROVIDERS[credential.providerCode];
  if (!tester) {
    return NextResponse.json({ error: 'ยังไม่รองรับการทดสอบ provider นี้ในเวอร์ชันนี้' }, { status: 400 });
  }

  const apiKey = decryptSecret(credential.encryptedKey, credential.encryptionIv);
  const result = await tester(apiKey);

  await prisma.credential.update({
    where: { id: credential.id },
    data: {
      status: result.ok ? 'active' : 'invalid',
      lastVerifiedAt: new Date()
    }
  });

  return NextResponse.json(result);
}
