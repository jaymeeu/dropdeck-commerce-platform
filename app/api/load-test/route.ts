import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import { query } from '@/lib/db'

// Guard — only callable from preview deploys (Vercel Deployment Protection handles auth)
// Also accepts an optional secret header for extra safety
const SECRET = process.env.LOAD_TEST_SECRET ?? ''

const BASE_URL    = process.env.NEXTAUTH_URL ?? 'https://dropdeck-commerce-platform.vercel.app'
const TOTAL_STOCK = 100
const CONCURRENCY = 150
const TEST_PREFIX = 'loadtest_'

async function checkoutRequest(dropId: string, buyerId: string): Promise<{ success: boolean; errorCode?: string; latency: number }> {
  const start = Date.now()
  try {
    const res = await fetch(`${BASE_URL}/api/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dropId, buyerId, quantity: 1 }),
      signal: AbortSignal.timeout(30000),
    })
    const json = await res.json()
    return { success: json.success, errorCode: json.errorCode, latency: Date.now() - start }
  } catch {
    return { success: false, errorCode: 'request_error', latency: Date.now() - start }
  }
}

export async function POST(req: NextRequest) {
  // If a secret is configured, enforce it; otherwise rely on Vercel Deployment Protection
  const secret = req.headers.get('x-load-test-secret')
  if (SECRET && secret !== SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const log: string[] = []
  const sellerId = randomUUID()
  const dropId   = randomUUID()
  const pwHash   = await bcrypt.hash('loadtest123', 10)

  try {
    // 1. Create test seller
    await query(
      `INSERT INTO users (id, email, password_hash, role, name)
       VALUES ($1,$2,$3,'seller','Load Test Seller') ON CONFLICT (id) DO NOTHING`,
      [sellerId, `${TEST_PREFIX}seller@dropdeck.test`, pwHash],
    )

    // 2. Create a live test drop with TOTAL_STOCK units
    const nowISO = new Date().toISOString()
    const endISO = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
    await query(
      `INSERT INTO drops (id,seller_id,title,description,price,total_stock,max_per_buyer,
                          start_time,end_time,status,image_urls)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'live','{}')`,
      [dropId, sellerId, `${TEST_PREFIX}Drop`, 'Load test drop', 2999, TOTAL_STOCK, 1, nowISO, endISO],
    )
    log.push(`Drop created: ${dropId} | stock: ${TOTAL_STOCK}`)

    // 3. Create CONCURRENCY unique buyers
    const buyers: { id: string; email: string }[] = []
    for (let i = 0; i < CONCURRENCY; i++) {
      buyers.push({ id: randomUUID(), email: `${TEST_PREFIX}buyer${i}@dropdeck.test` })
    }
    for (const b of buyers) {
      await query(
        `INSERT INTO users (id,email,password_hash,role,name)
         VALUES ($1,$2,$3,'buyer',$4) ON CONFLICT (id) DO NOTHING`,
        [b.id, b.email, pwHash, `Load Buyer ${b.email}`],
      )
    }
    log.push(`${CONCURRENCY} buyer accounts created`)

    // 4. Fire all checkout requests concurrently
    const t0      = Date.now()
    const results = await Promise.all(buyers.map((b) => checkoutRequest(dropId, b.id)))
    const elapsed = Date.now() - t0

    // 5. Analyse
    const succeeded     = results.filter((r) => r.success)
    const soldOut       = results.filter((r) => !r.success && r.errorCode === 'sold_out')
    const limitExceeded = results.filter((r) => !r.success && r.errorCode === 'limit_exceeded')
    const otherErrors   = results.filter((r) => !r.success && r.errorCode !== 'sold_out' && r.errorCode !== 'limit_exceeded')
    const latencies     = results.map((r) => r.latency)
    const avgLatency    = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)

    // 6. Cross-check with DB
    const dbCheck = await query(
      `SELECT COUNT(*) AS cnt FROM orders
       WHERE drop_id = $1 AND status IN ('reserved','paid','confirmed')`,
      [dropId],
    )
    const dbOrderCount = parseInt((dbCheck.rows[0] as { cnt: string }).cnt, 10)
    const pass = dbOrderCount <= TOTAL_STOCK

    return NextResponse.json({
      pass,
      summary: {
        totalRequests: CONCURRENCY,
        apiSuccesses: succeeded.length,
        dbOrdersCreated: dbOrderCount,
        soldOutRejects: soldOut.length,
        limitExceededRejects: limitExceeded.length,
        otherErrors: otherErrors.length,
        errorCodes: [...new Set(otherErrors.map((r) => r.errorCode))],
        avgLatencyMs: avgLatency,
        minLatencyMs: Math.min(...latencies),
        maxLatencyMs: Math.max(...latencies),
        wallClockMs: elapsed,
        oversellDetected: dbOrderCount > TOTAL_STOCK,
        oversellBy: Math.max(0, dbOrderCount - TOTAL_STOCK),
      },
      log,
    })
  } finally {
    // Always clean up test data
    try {
      await query(`DELETE FROM orders WHERE drop_id = $1`, [dropId])
      await query(`DELETE FROM checkout_log WHERE drop_id = $1`, [dropId])
      await query(`DELETE FROM drops WHERE id = $1`, [dropId])
      await query(
        `DELETE FROM users WHERE email LIKE $1`,
        [`${TEST_PREFIX}%`],
      )
    } catch {
      // best-effort cleanup
    }
  }
}
