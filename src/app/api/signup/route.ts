import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/db';

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'),
  displayName: z.string().min(1),
  teamName: z.string().min(1)
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
  }
  const { email, password, displayName, teamName } = parsed.data;

  const existing = await prisma.appUser.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: 'อีเมลนี้ถูกใช้ลงทะเบียนแล้ว' }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Every new account gets exactly one team it owns, matching spec §13.1
  // team / team_member structure (multi-member support comes later).
  const user = await prisma.appUser.create({
    data: {
      email,
      passwordHash,
      displayName,
      memberships: {
        create: {
          role: 'owner',
          team: { create: { name: teamName } }
        }
      }
    }
  });

  return NextResponse.json({ id: user.id }, { status: 201 });
}
