/**
 * Vercel Cron Job: /api/drops/status
 * Runs every minute to manage drop lifecycle and reservation expiry
 *
 * Responsibilities:
 * 1. Set drops from scheduled → live when startTime <= now()
 * 2. Set drops from live → ended when endTime <= now()
 * 3. Set expired reservations (orders where expiresAt <= now() and status = 'reserved') to expired
 *
 * This endpoint is called by Vercel Cron as defined in vercel.json
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Verify this is a cron request from Vercel
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.warn('[v0] Unauthorized cron request')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()

    // 1. Transition scheduled → live
    const scheduledResult = await query(
      `UPDATE drops
       SET status = 'live', updated_at = NOW()
       WHERE status = 'scheduled'
         AND start_time <= NOW()
       RETURNING id, title`,
    )

    const scheduledCount = scheduledResult.rowCount || 0
    if (scheduledCount > 0) {
      console.log(`[v0] Transitioned ${scheduledCount} drops from scheduled to live`)
    }

    // 2. Transition live → ended
    const endedResult = await query(
      `UPDATE drops
       SET status = 'ended', updated_at = NOW()
       WHERE status = 'live'
         AND end_time IS NOT NULL
         AND end_time <= NOW()
       RETURNING id, title`,
    )

    const endedCount = endedResult.rowCount || 0
    if (endedCount > 0) {
      console.log(`[v0] Transitioned ${endedCount} drops from live to ended`)
    }

    // 3. Expire reserved orders
    const expiredResult = await query(
      `UPDATE orders
       SET status = 'expired'
       WHERE status = 'reserved'
         AND expires_at <= NOW()
       RETURNING id, drop_id, buyer_id`,
    )

    const expiredCount = expiredResult.rowCount || 0
    if (expiredCount > 0) {
      console.log(`[v0] Expired ${expiredCount} reserved orders`)

      // For each expired order, check if we should un-mark the drop as sold_out
      const expiredOrders = expiredResult.rows
      for (const order of expiredOrders) {
        // Recalculate available stock
        const stockResult = await query(
          `SELECT COALESCE(SUM(quantity), 0) as sold
           FROM orders
           WHERE drop_id = $1 AND status IN ('reserved', 'paid', 'confirmed')`,
          [order.drop_id],
        )

        const sold = Number(stockResult.rows[0].sold)

        // Get total stock
        const dropResult = await query(
          `SELECT total_stock FROM drops WHERE id = $1`,
          [order.drop_id],
        )

        const totalStock = dropResult.rows[0].total_stock

        // If we freed up stock, transition back from sold_out to live if still in live window
        if (sold < totalStock && sold > 0) {
          await query(
            `UPDATE drops
             SET status = 'live', updated_at = NOW()
             WHERE id = $1 AND status = 'sold_out' AND start_time <= NOW() AND (end_time IS NULL OR end_time > NOW())`,
            [order.drop_id],
          )
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        scheduled: scheduledCount,
        ended: endedCount,
        expired: expiredCount,
        timestamp: now.toISOString(),
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('[v0] Cron job error:', error)
    return NextResponse.json(
      { error: 'Cron job failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
