// src/app/api/ai-providers/route.ts
// GET ?capability=text|image|video|audio
// คืน providers ที่มี models ที่ตรงกับ capability เท่านั้น
// (กรอง providers ที่ models ว่างออก เพื่อไม่ให้ UI แสดง provider ที่ใช้ไม่ได้)

import { NextResponse } from 'next/server'
import { prisma }        from '@/lib/db'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const capability = searchParams.get('capability') // null = all

  const providers = await prisma.aiProvider.findMany({
    where: { isActive: true },
    select: {
      code:         true,
      displayName:  true,
      capabilities: true,
      models: {
        select:  { modelCode: true, displayName: true, capability: true },
        where:   {
          isActive: true,
          ...(capability ? { capability } : {}),
        },
        orderBy: { displayName: 'asc' },
      },
    },
    orderBy: { displayName: 'asc' },
  })

  // กรองออก providers ที่ไม่มี model เลย (หลัง capability filter)
  const filtered = providers.filter(p => p.models.length > 0)

  return NextResponse.json({ providers: filtered })
}
