import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Optional ?capability=text|image|video|audio filter
// When provided, only returns models matching that capability.
// Used by each module to show only relevant models:
//   SEO Article → ?capability=text
//   Image Gen   → ?capability=image  (future)
//   Video Gen   → ?capability=video  (future)
//   TTS/Voice   → ?capability=audio  (future)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const capability = searchParams.get('capability'); // null = all models

  const providers = await prisma.aiProvider.findMany({
    where: { isActive: true },
    select: {
      code: true,
      displayName: true,
      capabilities: true,
      models: {
        select: { modelCode: true, displayName: true, capability: true },
        where: {
          isActive: true,
          ...(capability ? { capability } : {})
        },
        orderBy: { displayName: 'asc' }
      }
    },
    orderBy: { displayName: 'asc' }
  });

  // Only return providers that have at least one model after filtering
  return NextResponse.json({ providers });
}
