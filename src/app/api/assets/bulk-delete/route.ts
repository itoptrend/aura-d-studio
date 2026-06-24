import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getCurrentTeamId } from '@/lib/session';

const schema = z.object({
  ids: z.array(z.string().uuid()).min(1, 'เลือกไฟล์อย่างน้อย 1 รายการ')
});

export async function DELETE(req: Request) {
  try {
    const teamId = await getCurrentTeamId();
    if (!teamId) {
      return NextResponse.json({ error: 'ยังไม่ได้เข้าสู่ระบบ' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Request body ไม่ถูกต้อง' }, { status: 400 });
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    const { ids } = parsed.data;

    // ตรวจสอบว่า assets ทั้งหมดเป็นของ team นี้ก่อนลบ
    const ownedAssets = await prisma.asset.findMany({
      where: { id: { in: ids }, teamId },
      select: { id: true }
    });
    const ownedIds = ownedAssets.map((a: { id: string }) => a.id);

    if (ownedIds.length === 0) {
      return NextResponse.json({ error: 'ไม่พบไฟล์ที่เลือก' }, { status: 404 });
    }

    // ก่อนลบ asset ต้อง null FK references ที่ชี้มาจากที่อื่น (ถ้ามี)
    // ใน schema ของเรา asset ชี้ไป nodeExecution และ run (ไม่มีอะไรชี้กลับมาที่ asset)
    // ดังนั้น deleteMany ควรทำงานได้ปกติ

    const result = await prisma.asset.deleteMany({
      where: { id: { in: ownedIds }, teamId }
    });

    return NextResponse.json({
      deleted: result.count,
      message: `ลบสำเร็จ ${result.count} รายการ`
    });

  } catch (err) {
    console.error('[bulk-delete] error:', err);
    const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
