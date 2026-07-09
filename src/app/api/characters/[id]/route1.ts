import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getCurrentTeamId } from '@/lib/session';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const teamId = await getCurrentTeamId();
  if (!teamId) return NextResponse.json({ error: 'ยังไม่ได้เข้าสู่ระบบ' }, { status: 401 });

  const existing = await prisma.character.findFirst({ where: { id, teamId } });
  if (!existing) return NextResponse.json({ error: 'ไม่พบตัวละครนี้' }, { status: 404 });

  const body = await req.json();
  const updateSchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    personality: z.string().optional(),
    tone: z.string().optional(),
    backstory: z.string().optional(),
    examples: z.string().optional(),
    avatarEmoji: z.string().optional(),
    role: z.string().optional(),
    gender: z.string().optional(),
    ageRange: z.string().optional(),
    skinTone: z.string().optional(),
    appearance: z.string().optional(),
    outfit: z.string().optional()
  });

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
  }

  const character = await prisma.character.update({
    where: { id },
    data: parsed.data
  });

  return NextResponse.json({ character });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const teamId = await getCurrentTeamId();
  if (!teamId) return NextResponse.json({ error: 'ยังไม่ได้เข้าสู่ระบบ' }, { status: 401 });

  const existing = await prisma.character.findFirst({ where: { id, teamId } });
  if (!existing) return NextResponse.json({ error: 'ไม่พบตัวละครนี้' }, { status: 404 });

  await prisma.character.update({ where: { id }, data: { isActive: false } });

  return NextResponse.json({ ok: true });
}
