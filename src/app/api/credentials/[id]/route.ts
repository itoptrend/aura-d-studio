import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentTeamId } from '@/lib/session';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const teamId = await getCurrentTeamId();
  if (!teamId) return NextResponse.json({ error: 'ยังไม่ได้เข้าสู่ระบบ' }, { status: 401 });

  // Always scope by teamId — prevents a user from deleting another team's key
  const existing = await prisma.credential.findFirst({ where: { id, teamId } });
  if (!existing) return NextResponse.json({ error: 'ไม่พบ API Key นี้' }, { status: 404 });

  await prisma.credential.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
