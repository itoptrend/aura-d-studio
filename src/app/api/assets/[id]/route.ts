import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentTeamId } from '@/lib/session';
import { getVideoCredits } from '@/lib/videoCredits';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const teamId = await getCurrentTeamId();
  if (!teamId) return NextResponse.json({ error: 'ยังไม่ได้เข้าสู่ระบบ' }, { status: 401 });

  const asset = await prisma.asset.findFirst({
    where: { id, teamId }, // tenant-scoped lookup, §2.4
    include: {
      sourceRun: {
        include: {
          nodeExecutions: {
            include: {
              credential: { select: { displayName: true, providerCode: true } },
              resolvedModel: { select: { displayName: true, modelCode: true } }
            },
            orderBy: { startedAt: 'asc' }
          }
        }
      }
    }
  });

  if (!asset) return NextResponse.json({ error: 'ไม่พบไฟล์นี้' }, { status: 404 });

  interface RecipeNodeExecution {
    taskName: string;
    status: string;
    costCredit: unknown; // Prisma.Decimal at runtime — converted with Number() below
    startedAt: Date | null;
    finishedAt: Date | null;
    credential: { displayName: string; providerCode: string } | null;
    resolvedModel: { displayName: string; modelCode: string } | null;
  }

  // §4.6.1 Generation Recipe — the timeline of which AI did what, read
  // straight from node_execution / resolved_model_id, not duplicated data.
  const nodeExecutions = (asset.sourceRun?.nodeExecutions ?? []) as RecipeNodeExecution[];
  const recipe = nodeExecutions.map((ne) => ({
    taskName: ne.taskName,
    status: ne.status,
    modelDisplayName: ne.resolvedModel?.displayName ?? null,
    providerCode: ne.credential?.providerCode ?? null,
    costCredit: ne.costCredit,
    startedAt: ne.startedAt,
    finishedAt: ne.finishedAt
  }));

  const totalCostCredit = recipe.reduce((sum: number, step: { costCredit: unknown }) => sum + Number(step.costCredit), 0);

  // วิดีโอมาทางคิว cron ไม่มี recipe — คิดเครดิตจาก VideoJob ที่สร้างมันแทน
  let videoCostCredit = 0;
  if (asset.type === 'video') {
    const vj = await prisma.videoJob.findFirst({
      where: { assetId: asset.id },
      select: { modelCode: true, durationSecs: true },
    });
    if (vj) videoCostCredit = getVideoCredits(vj.modelCode, vj.durationSecs);
  }

  return NextResponse.json({
    asset: {
      id: asset.id,
      type: asset.type,
      title: asset.title,
      contentText: asset.contentText,
      fileUrl: asset.fileUrl,
      isFavorited: asset.isFavorited,
      createdAt: asset.createdAt
    },
    recipe,
    totalCostCredit: totalCostCredit + videoCostCredit
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const teamId = await getCurrentTeamId();
  if (!teamId) return NextResponse.json({ error: 'ยังไม่ได้เข้าสู่ระบบ' }, { status: 401 });

  const body = await req.json();
  if (typeof body.isFavorited !== 'boolean') {
    return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
  }

  const existing = await prisma.asset.findFirst({ where: { id, teamId } });
  if (!existing) return NextResponse.json({ error: 'ไม่พบไฟล์นี้' }, { status: 404 });

  // §4.6.2 "ถูกใจ" toggle
  const updated = await prisma.asset.update({
    where: { id },
    data: {
      isFavorited: body.isFavorited,
      favoritedAt: body.isFavorited ? new Date() : null
    },
    select: { id: true, isFavorited: true }
  });

  return NextResponse.json({ asset: updated });
}
