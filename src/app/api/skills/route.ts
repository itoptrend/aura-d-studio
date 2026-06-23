import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/skills?category=seo|social|character|video|general
// Returns official skills only (isOfficial=true) — read-only per spec §18.9
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');

  const skills = await prisma.skill.findMany({
    where: {
      isOfficial: true,
      isActive: true,
      ...(category ? { category } : {})
    },
    select: {
      id: true,
      name: true,
      description: true,
      category: true,
      promptTemplate: true,
      isOfficial: true
    },
    orderBy: [{ category: 'asc' }, { name: 'asc' }]
  });

  return NextResponse.json({ skills });
}
