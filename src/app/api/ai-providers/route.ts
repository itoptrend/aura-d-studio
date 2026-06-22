import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Public-ish reference data (no team scoping needed — this is the catalog of
// supported providers, not user-specific data). Still requires being signed
// in implicitly because it's only fetched from within the (dashboard) layout.
export async function GET() {
  const providers = await prisma.aiProvider.findMany({
    where: { isActive: true },
    select: {
      code: true,
      displayName: true,
      capabilities: true,
      models: { select: { modelCode: true, displayName: true }, where: { isActive: true } }
    },
    orderBy: { displayName: 'asc' }
  });
  return NextResponse.json({ providers });
}
