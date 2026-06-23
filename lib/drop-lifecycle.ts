import { query } from './db'

/** Orders that currently hold inventory against a drop's stock count. */
export const ACTIVE_ORDER_STOCK_WHERE = `
  status IN ('paid', 'confirmed')
  OR (status = 'reserved' AND expires_at > NOW())
`

export interface LifecycleSyncResult {
  scheduled: number
  ended: number
  expired: number
  reopened: number
}

/**
 * Sync drop lifecycle and expire stale reservations.
 * Runs on traffic (drop page, checkout, storefront) so cron is optional.
 */
export async function syncDropLifecycle(dropId?: string): Promise<LifecycleSyncResult> {
  const expiredResult = await query(
    dropId
      ? `UPDATE orders SET status = 'expired'
         WHERE status = 'reserved' AND expires_at <= NOW() AND drop_id = $1
         RETURNING id, drop_id`
      : `UPDATE orders SET status = 'expired'
         WHERE status = 'reserved' AND expires_at <= NOW()
         RETURNING id, drop_id`,
    dropId ? [dropId] : [],
  )

  const scheduledResult = await query(
    dropId
      ? `UPDATE drops SET status = 'live', updated_at = NOW()
         WHERE id = $1 AND status = 'scheduled' AND start_time <= NOW()
           AND (end_time IS NULL OR end_time > NOW())
         RETURNING id`
      : `UPDATE drops SET status = 'live', updated_at = NOW()
         WHERE status = 'scheduled' AND start_time <= NOW()
           AND (end_time IS NULL OR end_time > NOW())
         RETURNING id`,
    dropId ? [dropId] : [],
  )

  const endedResult = await query(
    dropId
      ? `UPDATE drops SET status = 'ended', updated_at = NOW()
         WHERE id = $1 AND status = 'live' AND end_time IS NOT NULL AND end_time <= NOW()
         RETURNING id`
      : `UPDATE drops SET status = 'ended', updated_at = NOW()
         WHERE status = 'live' AND end_time IS NOT NULL AND end_time <= NOW()
         RETURNING id`,
    dropId ? [dropId] : [],
  )

  const reopenedResult = await query(
    dropId
      ? `UPDATE drops d SET status = 'live', updated_at = NOW()
         WHERE d.id = $1
           AND d.status = 'sold_out'
           AND d.start_time <= NOW()
           AND (d.end_time IS NULL OR d.end_time > NOW())
           AND d.total_stock > (
             SELECT COALESCE(SUM(o.quantity), 0) FROM orders o
             WHERE o.drop_id = d.id AND (${ACTIVE_ORDER_STOCK_WHERE})
           )
         RETURNING id`
      : `UPDATE drops d SET status = 'live', updated_at = NOW()
         WHERE d.status = 'sold_out'
           AND d.start_time <= NOW()
           AND (d.end_time IS NULL OR d.end_time > NOW())
           AND d.total_stock > (
             SELECT COALESCE(SUM(o.quantity), 0) FROM orders o
             WHERE o.drop_id = d.id AND (${ACTIVE_ORDER_STOCK_WHERE})
           )
         RETURNING id`,
    dropId ? [dropId] : [],
  )

  return {
    scheduled: scheduledResult.rowCount || 0,
    ended: endedResult.rowCount || 0,
    expired: expiredResult.rowCount || 0,
    reopened: reopenedResult.rowCount || 0,
  }
}

/**
 * Sum of units currently held against a drop's stock.
 */
export async function getActiveUnitsSold(dropId: string): Promise<number> {
  const result = await query(
    `SELECT COALESCE(SUM(quantity), 0) AS total
     FROM orders
     WHERE drop_id = $1 AND (${ACTIVE_ORDER_STOCK_WHERE})`,
    [dropId],
  )
  return Number(result.rows[0].total)
}
