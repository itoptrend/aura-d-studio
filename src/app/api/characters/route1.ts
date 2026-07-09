import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getCurrentTeamId } from '@/lib/session';

export async function GET() {
  const teamId = await getCurrentTeamId();
  if (!teamId) return NextResponse.json({ error: 'ยังไม่ได้เข้าสู่ระบบ' }, { status: 401 });

  const characters = await prisma.character.findMany({
    where: { teamId, isActive: true },
    select: {
      id: true, name: true, description: true, role: true,
      personality: true, tone: true, backstory: true,
      examples: true, avatarEmoji: true, createdAt: true,
      gender: true, ageRange: true, skinTone: true, appearance: true, outfit: true,
      portraitUrl: true
    },
    orderBy: { createdAt: 'desc' }
  });

  return NextResponse.json({ characters });
}

const createSchema = z.object({
  name: z.string().min(1, 'กรอกชื่อตัวละคร'),
  description: z.string().optional(),
  personality: z.string().optional().default(''),
  tone: z.string().optional().default(''),
  backstory: z.string().optional(),
  examples: z.string().optional(),
  avatarEmoji: z.string().optional().default('🤖'),
  role: z.string().optional().default('unset'),
  gender: z.string().optional().default(''),
  ageRange: z.string().optional().default(''),
  skinTone: z.string().optional().default(''),
  appearance: z.string().optional(),
  outfit: z.string().optional()
});

export async function POST(req: Request) {
  const teamId = await getCurrentTeamId();
  if (!teamId) return NextResponse.json({ error: 'ยังไม่ได้เข้าสู่ระบบ' }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
  }

  const character = await prisma.character.create({
    data: { teamId, ...parsed.data }
  });

  return NextResponse.json({ character }, { status: 201 });
}
