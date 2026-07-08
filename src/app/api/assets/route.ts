import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentTeamId } from '@/lib/session';
import { getVideoCredits } from '@/lib/videoCredits';

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
      fileUrl: true,
      sourceNodeExecution: { select: { costCredit: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  // ตัด contentText ให้เหมาะกับ list view
  // image: เก็บ data URL เต็มเพื่อแสดง thumbnail
  // audio/document: เก็บแค่ flag ว่ามีข้อมูลหรือไม่
  // เครดิตของวิดีโอ (มาทางคิว ไม่มี nodeExecution) — คิดจาก VideoJob
  const videoIds = assets.filter((a: { type: string }) => a.type === 'video').map((a: { id: string }) => a.id);
  const videoJobs = videoIds.length > 0 ? await prisma.videoJob.findMany({
    where: { assetId: { in: videoIds } },
    select: { assetId: true, modelCode: true, durationSecs: true },
  }) : [];
  const videoCreditMap = new Map<string, number>(
    videoJobs.map((j: { assetId: string | null; modelCode: string; durationSecs: number }) =>
      [j.assetId as string, getVideoCredits(j.modelCode, j.durationSecs)])
  );

  const trimmed = assets.map((a: {
    id: string; type: string; title: string; isFavorited: boolean;
    createdAt: Date; expiresAt: Date | null; contentText: string | null; fileUrl: string | null;
    sourceNodeExecution: { costCredit: unknown } | null;
  }) => ({
    id: a.id,
    type: a.type,
    title: a.title,
    isFavorited: a.isFavorited,
    createdAt: a.createdAt,
    expiresAt: a.expiresAt,
    sourceNodeExecution: a.sourceNodeExecution,
    hasContent: !!a.contentText || !!a.fileUrl,
    fileUrl: a.fileUrl,
    videoCredit: videoCreditMap.get(a.id) ?? null,
    thumbnail: a.contentText?.startsWith('data:image') ? a.contentText : null,
    isAudio: a.contentText?.startsWith('data:audio') ?? false,
  }));

  return NextResponse.json({ assets: trimmed });
}
