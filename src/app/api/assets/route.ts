import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentTeamId } from '@/lib/session';

export async function GET() {
  const teamId = await getCurrentTeamId();
  if (!teamId) return NextResponse.json({ error: 'ยังไม่ได้เข้าสู่ระบบ' }, { status: 401 });

  const assets = await prisma.asset.findMany({
    where: { teamId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    select: {
      id: true,
      type: true,
      title: true,
      isFavorited: true,
      createdAt: true,
      expiresAt: true,
      contentText: true,
      sourceNodeExecution: { select: { costCredit: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  // ตัด contentText ให้เหมาะกับ list view
  // image: เก็บ data URL เต็มเพื่อแสดง thumbnail
  // audio/document: เก็บแค่ flag ว่ามีข้อมูลหรือไม่
  const trimmed = assets.map((a: {
    id: string; type: string; title: string; isFavorited: boolean;
    createdAt: Date; expiresAt: Date | null; contentText: string | null;
    sourceNodeExecution: { costCredit: unknown } | null;
  }) => ({
    id: a.id,
    type: a.type,
    title: a.title,
    isFavorited: a.isFavorited,
    createdAt: a.createdAt,
    expiresAt: a.expiresAt,
    sourceNodeExecution: a.sourceNodeExecution,
    hasContent: !!a.contentText,
    thumbnail: a.contentText?.startsWith('data:image') ? a.contentText : null,
    isAudio: a.contentText?.startsWith('data:audio') ?? false,
  }));

  return NextResponse.json({ assets: trimmed });
}
