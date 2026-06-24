import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentTeamId } from '@/lib/session';

export async function GET() {
  const teamId = await getCurrentTeamId();
  if (!teamId) return NextResponse.json({ error: 'ยังไม่ได้เข้าสู่ระบบ' }, { status: 401 });

  // Run all queries in parallel
  const [
    assetCounts,
    totalCredits,
    creditsByProvider,
    creditsByCategory,
    recentAssets,
    dailyStats,
    favoriteCount,
    team
  ] = await Promise.all([
    // Asset counts by type
    prisma.asset.groupBy({
      by: ['type'],
      where: { teamId },
      _count: { id: true }
    }),

    // Total credits used
    prisma.nodeExecution.aggregate({
      where: { run: { workflow: { teamId } }, status: 'succeeded' },
      _sum: { costCredit: true },
      _count: { id: true }
    }),

    // Credits by AI provider
    prisma.nodeExecution.groupBy({
      by: ['credentialId'],
      where: { run: { workflow: { teamId } }, status: 'succeeded' },
      _sum: { costCredit: true },
      _count: { id: true }
    }),

    // Credits by workflow category
    prisma.workflow.findMany({
      where: { teamId },
      select: {
        category: true,
        runs: {
          select: {
            nodeExecutions: {
              where: { status: 'succeeded' },
              select: { costCredit: true }
            }
          }
        }
      }
    }),

    // Recent 10 assets
    prisma.asset.findMany({
      where: { teamId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, title: true, type: true, createdAt: true, isFavorited: true,
        sourceNodeExecution: { select: { costCredit: true } } }
    }),

    // Daily asset counts for last 14 days
    prisma.$queryRaw<{ date: string; count: bigint }[]>`
      SELECT DATE(created_at AT TIME ZONE 'Asia/Bangkok') as date, COUNT(*) as count
      FROM asset
      WHERE team_id = ${teamId}
        AND created_at >= NOW() - INTERVAL '14 days'
      GROUP BY DATE(created_at AT TIME ZONE 'Asia/Bangkok')
      ORDER BY date ASC
    `,

    // Favorites count
    prisma.asset.count({ where: { teamId, isFavorited: true } }),

    // Team created date
    prisma.team.findUnique({ where: { id: teamId }, select: { createdAt: true } })
  ]);

  // Aggregate credits by provider (need credential → provider mapping)
  const credentialIds = creditsByProvider
    .map((c: { credentialId: string | null }) => c.credentialId)
    .filter(Boolean) as string[];
  const credentials = credentialIds.length > 0
    ? await prisma.credential.findMany({
        where: { id: { in: credentialIds } },
        select: { id: true, providerCode: true, displayName: true }
      })
    : [];

  const providerMap = new Map(credentials.map((c: { id: string; providerCode: string; displayName: string }) => [c.id, c]));

  const creditsByProviderAgg: Record<string, { label: string; credits: number; runs: number }> = {};
  for (const row of creditsByProvider) {
    if (!row.credentialId) continue;
    const cred = providerMap.get(row.credentialId);
    const key = (cred as { providerCode: string } | undefined)?.providerCode ?? 'unknown';
    if (!creditsByProviderAgg[key]) {
      creditsByProviderAgg[key] = { label: (cred as { providerCode: string } | undefined)?.providerCode ?? 'ไม่ทราบ', credits: 0, runs: 0 };
    }
    creditsByProviderAgg[key].credits += Number(row._sum.costCredit ?? 0);
    creditsByProviderAgg[key].runs += row._count.id;
  }

  // Aggregate credits by category
  const creditsByCategoryAgg: Record<string, { label: string; credits: number; runs: number }> = {};
  const CATEGORY_LABELS: Record<string, string> = {
    seo_article: 'SEO Article',
    social_content: 'Social Content',
    video_ad: 'Video/Ad',
    image_generation: 'สร้างภาพ',
    audio_tts: 'สร้างเสียง',
    other: 'อื่นๆ'
  };
  for (const w of creditsByCategory) {
    const cat = w.category;
    const label = CATEGORY_LABELS[cat] ?? cat;
    if (!creditsByCategoryAgg[cat]) creditsByCategoryAgg[cat] = { label, credits: 0, runs: 0 };
    for (const run of w.runs) {
      for (const ne of run.nodeExecutions) {
        creditsByCategoryAgg[cat].credits += Number(ne.costCredit ?? 0);
        creditsByCategoryAgg[cat].runs += 1;
      }
    }
  }

  // Build 14-day chart data
  const today = new Date();
  const chartData: { date: string; label: string; count: number }[] = [];
  const dailyMap = new Map(dailyStats.map((d: { date: Date | string; count: bigint }) => [d.date.toString().slice(0, 10), Number(d.count)]));
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const cnt = dailyMap.get(key);
    chartData.push({
      date: key,
      label: `${d.getDate()}/${d.getMonth() + 1}`,
      count: Number(cnt ?? 0)
    });
  }

  const totalAssets = assetCounts.reduce((s: number, r: { _count: { id: number } }) => s + r._count.id, 0);
  const totalCreditsNum = Number(totalCredits._sum.costCredit ?? 0);
  const totalRuns = totalCredits._count.id;

  return NextResponse.json({
    summary: {
      totalAssets,
      totalCredits: totalCreditsNum,
      totalRuns,
      favoriteCount,
      memberSince: team?.createdAt ?? null
    },
    assetsByType: assetCounts.map((r: { type: string; _count: { id: number } }) => ({ type: r.type, count: r._count.id })),
    creditsByProvider: Object.values(creditsByProviderAgg).sort((a, b) => b.credits - a.credits),
    creditsByCategory: Object.values(creditsByCategoryAgg).sort((a, b) => b.credits - a.credits),
    recentAssets,
    chartData
  });
}
