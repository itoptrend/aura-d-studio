// src/app/api/cron/process-video-jobs/route.ts
// Vercel Cron — trigger ทุก 1 นาที (ตั้งใน vercel.json)
// ทำหน้าที่: (1) recover stalled jobs (2) kick BullMQ worker

import { NextResponse } from 'next/server'
import { recoverStalledJobs, startVideoWorker } from '@/lib/queue/videoWorker'

// Guard: ให้เฉพาะ Vercel Cron เรียกได้
function isCronAuthorized(req: Request): boolean {
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${process.env.CRON_SECRET}`
}

export async function GET(req: Request): Promise<NextResponse> {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 1) ตรวจ + mark stalled jobs
    await recoverStalledJobs()

    // 2) ensure worker กำลัง run (lazy-init, idempotent)
    startVideoWorker()

    return NextResponse.json({ ok: true, ts: new Date().toISOString() })
  } catch (err) {
    console.error('[Cron] process-video-jobs failed:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
