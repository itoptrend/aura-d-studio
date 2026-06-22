import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentTeamId } from '@/lib/session';

export async function GET() {
  const teamId = await getCurrentTeamId();
  if (!teamId) return NextResponse.json({ error: 'ยังไม่ได้เข้าสู่ระบบ' }, { status: 401 });

  const assets = await prisma.asset.findMany({
    where: { teamId },
    select: {
      id: true,
      type: true,
      title: true,
      isFavorited: true,
      createdAt: true,
      sourceNodeExecution: { select: { costCredit: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  return NextResponse.json({ assets });
}
