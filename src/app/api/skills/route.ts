import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getCurrentTeamId } from '@/lib/session';

// GET /api/skills?category=...&includeCustom=true
export async function GET(req: Request) {
  const teamId = await getCurrentTeamId();
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  const includeCustom = searchParams.get('includeCustom') === 'true';

  // Official skills (always included)
  const officialWhere = {
    isOfficial: true,
    isActive: true,
    ...(category ? { category } : {})
  };

  // Custom skills for this team (if requested)
  const customWhere = teamId && includeCustom ? {
    isOfficial: false,
    isActive: true,
    teamId,
    ...(category ? { category } : {})
  } : null;

  const [officialSkills, customSkills] = await Promise.all([
    prisma.skill.findMany({
      where: officialWhere,
      select: { id: true, name: true, description: true, category: true, promptTemplate: true, isOfficial: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }]
    }),
    customWhere ? prisma.skill.findMany({
      where: customWhere,
      select: { id: true, name: true, description: true, category: true, promptTemplate: true, isOfficial: true },
      orderBy: { name: 'asc' }
    }) : Promise.resolve([])
  ]);

  return NextResponse.json({ skills: [...officialSkills, ...customSkills], customSkills, officialSkills });
}

// POST /api/skills — สร้าง custom skill
const createSchema = z.object({
  name:           z.string().min(2, 'ชื่อ Skill ต้องมีอย่างน้อย 2 ตัวอักษร').max(80),
  description:    z.string().min(5, 'คำอธิบายต้องมีอย่างน้อย 5 ตัวอักษร').max(200),
  category:       z.enum(['seo', 'social', 'video', 'character', 'general']),
  promptTemplate: z.string().min(10, 'Prompt ต้องมีอย่างน้อย 10 ตัวอักษร').max(2000),
});

export async function POST(req: Request) {
  const teamId = await getCurrentTeamId();
  if (!teamId) return NextResponse.json({ error: 'ยังไม่ได้เข้าสู่ระบบ' }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
  }

  const skill = await prisma.skill.create({
    data: {
      ...parsed.data,
      isOfficial: false,
      isActive: true,
      teamId,
    }
  });

  return NextResponse.json({ skill }, { status: 201 });
}
