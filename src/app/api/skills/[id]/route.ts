import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentTeamId } from '@/lib/session';

// DELETE /api/skills/[id] — ลบ custom skill (ลบ official ไม่ได้)
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const teamId = await getCurrentTeamId();
  if (!teamId) return NextResponse.json({ error: 'ยังไม่ได้เข้าสู่ระบบ' }, { status: 401 });

  const skill = await prisma.skill.findUnique({ where: { id: params.id } });
  if (!skill) return NextResponse.json({ error: 'ไม่พบ Skill นี้' }, { status: 404 });
  if (skill.isOfficial) return NextResponse.json({ error: 'ลบ Official Skill ไม่ได้' }, { status: 403 });
  if (skill.teamId !== teamId) return NextResponse.json({ error: 'ไม่มีสิทธิ์ลบ Skill นี้' }, { status: 403 });

  await prisma.skill.delete({ where: { id: params.id } });
  return NextResponse.json({ deleted: true });
}
