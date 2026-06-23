/**
 * Vercel Cron Job: /api/drops/status
 * Also callable manually with CRON_SECRET for external schedulers.
 */

import { NextRequest, NextResponse } from 'next/server'
import { syncDropLifecycle } from '@/lib/drop-lifecycle'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await syncDropLifecycle()

    return NextResponse.json(
      {
        success: true,
        scheduled: result.scheduled,
        ended: result.ended,
        expired: result.expired,
        reopened: result.reopened,
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    )
  } catch (error) {
    return NextResponse.json(
      { error: 'Cron job failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
