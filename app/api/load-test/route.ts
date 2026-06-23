import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import { query } from '@/lib/db'
import { attemptCheckout } from '@/lib/actions/checkout'

const TOTAL_STOCK = 100
const CONCURRENCY = 150
const TEST_PREFIX = 'loadtest_'

async function checkoutRequest(dropId: string, buyerId: string): Promise<{ success: boolean; errorCode?: string; latency: number }> {
  const start = Date.now()
  try {
    const result = await attemptCheckout(dropId, buyerId, 1)
    return { success: result.success, errorCode: result.errorCode, latency: Date.now() - start }
  } catch {
    return { success: false, errorCode: 'request_error', latency: Date.now() - start }
  }
}

export async function POST(req: NextRequest) {
  const log: string[] = []

  try {
    // 1. Create a fresh test drop (live now, 100 units, expires in 1 hour)
    log.push('[SETUP] Creating test drop...')
    const dropId = randomUUID()
    const sellerId = randomUUID()

    // Create seller (required for drop to exist)
    await query(
      `INSERT INTO users (id, email, password_hash, name, role) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO NOTHING`,
      [sellerId, `${TEST_PREFIX}seller@test.com`, await bcrypt.hash('test', 10), 'Load Test Seller', 'seller'],
    )

    // Create drop
    const now = new Date()
    const endTime = new Date(now.getTime() + 3600000) // 1 hour from now
    await query(
      `INSERT INTO drops (id, seller_id, title, description, price, image_urls, total_stock, max_per_buyer, status, start_time, end_time, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())`,
      [
        dropId,
        sellerId,
        'Load Test Drop',
        'Automated load test drop for concurrency verification',
        10000, // $100
        [],
        TOTAL_STOCK,
        10,
        'live',
        now,
        endTime,
      ],
    )
    log.push(`✓ Drop created: ${dropId}`)

    // 2. Create 150 unique buyer accounts
    log.push(`[SETUP] Creating ${CONCURRENCY} buyer accounts...`)
    const buyers: { id: string; email: string }[] = []
    for (let i = 0; i < CONCURRENCY; i++) {
      buyers.push({
        id: randomUUID(),
        email: `${TEST_PREFIX}buyer_${i}@test.com`,
      })
    }

    // Batch insert buyers
    for (const b of buyers) {
      const pwHash = await bcrypt.hash('test', 10)
      await query(
        `INSERT INTO users (id, email, password_hash, name, role) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (email) DO NOTHING`,
        [b.id, b.email, pwHash, `Load Buyer ${b.email}`, 'buyer'],
      )
    }
    log.push(`✓ ${CONCURRENCY} buyers created`)

    // 3. Fire 150 concurrent checkout requests
    log.push(`[TEST] Firing ${CONCURRENCY} concurrent checkout requests...`)
    const start = Date.now()
    const results = await Promise.all(buyers.map(b => checkoutRequest(dropId, b.id)))
    const totalTime = Date.now() - start
    log.push(`✓ All ${CONCURRENCY} requests completed in ${totalTime}ms`)

    // 4. Analyze results
    const successes = results.filter(r => r.success)
    const failures = results.filter(r => !r.success)

    // Query actual orders in DB
    const orderResult = await query(`SELECT COUNT(*) as count FROM orders WHERE drop_id = $1`, [dropId])
    const actualOrders = parseInt(orderResult.rows[0]?.count ?? '0')

    const errorCounts: { [key: string]: number } = {}
    failures.forEach(r => {
      errorCounts[r.errorCode ?? 'unknown'] = (errorCounts[r.errorCode ?? 'unknown'] ?? 0) + 1
    })

    const isZeroOversell = actualOrders <= TOTAL_STOCK
    const oversellBy = Math.max(0, actualOrders - TOTAL_STOCK)

    log.push(`\n[RESULTS]`)
    log.push(`✓ Zero-Oversell Guarantee: ${isZeroOversell ? 'PASSED' : 'FAILED'}`)
    log.push(`  Concurrent requests: ${CONCURRENCY}`)
    log.push(`  Successful checkouts: ${successes.length}`)
    log.push(`  DB orders created: ${actualOrders}`)
    log.push(`  Oversell by: ${oversellBy}`)
    log.push(`\n[REJECTION BREAKDOWN]`)
    Object.entries(errorCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([code, count]) => log.push(`  ${code}: ${count}`))

    log.push(`\n[LATENCY]`)
    const latencies = results.map(r => r.latency)
    const avgLatency = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
    log.push(`  Avg: ${avgLatency}ms`)
    log.push(`  Min: ${Math.min(...latencies)}ms`)
    log.push(`  Max: ${Math.max(...latencies)}ms`)
    log.push(`  Wall clock: ${totalTime}ms`)

    // Clean up in FK-safe order:
    // checkout_log + orders reference drops(id) and users(id)
    // so drop those rows first, then drops, then users
    const steps = [
      [`DELETE FROM checkout_log WHERE drop_id = $1`, [dropId]],
      [`DELETE FROM orders       WHERE drop_id = $1`, [dropId]],
      [`DELETE FROM drops        WHERE id      = $1`, [dropId]],
      [`DELETE FROM users        WHERE email LIKE $1`, [`${TEST_PREFIX}%`]],
    ] as const
    log.push(`\n[CLEANUP]`)
    for (const [sql, params] of steps) {
      try {
        await query(sql, [...params])
      } catch {
        // log silently — each step is independent
      }
    }
    log.push(`✓ Test data cleaned up`)

    return NextResponse.json({
      success: isZeroOversell,
      results: {
        concurrentRequests: CONCURRENCY,
        successfulCheckouts: successes.length,
        dbOrders: actualOrders,
        oversellBy,
        errorCounts,
        latency: { avg: avgLatency, min: Math.min(...latencies), max: Math.max(...latencies), wallClock: totalTime },
      },
      log: log.join('\n'),
    })
  } catch (error) {
    return NextResponse.json({ error: String(error), log: log.join('\n') }, { status: 500 })
  }
}
