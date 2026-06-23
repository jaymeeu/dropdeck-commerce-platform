import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

const SECRET = process.env.LOAD_TEST_SECRET

// Guard: only allow requests with the correct secret header
function isAuthorized(req: NextRequest) {
  return SECRET && req.headers.get('x-load-test-secret') === SECRET
}

// POST /api/internal/load-test — seed test data, return dropId + buyerIds
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { stock = 100, buyers = 150 } = await req.json()
  const prefix = 'lt' + Date.now()

  // Create test seller
  const sellerId = `ffff0000-0000-0000-0000-${prefix.slice(0, 12).padEnd(12, '0')}`
  await query(
    `INSERT INTO users (id, email, password_hash, role, name)
     VALUES ($1, $2, 'x', 'seller', 'Load Test Seller')
     ON CONFLICT (id) DO NOTHING`,
    [sellerId, `${prefix}_seller@test.local`],
  )

  // Create test drop — live now
  const dropResult = await query(
    `INSERT INTO drops (seller_id, title, description, price, total_stock, max_per_buyer, status, start_time, end_time)
     VALUES ($1, $2, $3, 999, $4, 1, 'live', NOW(), NOW() + INTERVAL '2 hours')
     RETURNING id`,
    [sellerId, `[LOAD TEST] ${prefix}`, 'Automated load test — safe to delete', stock],
  )
  const dropId: string = dropResult.rows[0].id

  // Create test buyers
  const buyerIds: string[] = []
  for (let i = 0; i < buyers; i++) {
    const id = `bb000000-0000-0000-${String(i).padStart(4, '0')}-${prefix.replace(/\D/g, '').padEnd(12, '0').slice(0, 12)}`
    await query(
      `INSERT INTO users (id, email, password_hash, role, name)
       VALUES ($1, $2, 'x', 'buyer', $3)
       ON CONFLICT (id) DO NOTHING`,
      [id, `${prefix}_buyer${i}@test.local`, `LT Buyer ${i}`],
    )
    buyerIds.push(id)
  }

  return NextResponse.json({ dropId, buyerIds, sellerId, prefix })
}

// DELETE /api/internal/load-test — clean up test data
export async function DELETE(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { dropId, buyerIds, sellerId } = await req.json()

  await query(`DELETE FROM orders WHERE drop_id = $1`, [dropId])
  await query(`DELETE FROM checkout_log WHERE drop_id = $1`, [dropId])
  await query(`DELETE FROM drops WHERE id = $1`, [dropId])
  for (const id of [...buyerIds, sellerId]) {
    await query(`DELETE FROM users WHERE id = $1`, [id])
  }

  return NextResponse.json({ ok: true })
}

// GET /api/internal/load-test?dropId=xxx — count DB orders for a drop
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dropId = req.nextUrl.searchParams.get('dropId')
  const result = await query(
    `SELECT COUNT(*) FROM orders WHERE drop_id = $1 AND status IN ('reserved','paid','confirmed')`,
    [dropId],
  )

  return NextResponse.json({ dbOrders: parseInt(result.rows[0].count, 10) })
}
