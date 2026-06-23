#!/usr/bin/env node

/**
 * Load Test Script for DropDeck
 *
 * Tests the zero-oversell guarantee by firing concurrent checkout attempts
 * directly against the database layer (no HTTP auth required).
 *
 * Usage:
 *   npx tsx scripts/load-test.ts
 *
 * Prerequisites:
 * 1. Database populated with seed data (npx tsx scripts/migrate.ts)
 * 2. .env.local configured with Aurora credentials
 */

import { attemptCheckout } from '../lib/actions/checkout'
import { syncDropLifecycle } from '../lib/drop-lifecycle'
import { query } from '../lib/db'
import { hashPassword } from '../lib/auth/password'

const DROP_ID = 'b1111111-1111-1111-1111-111111111111'
const CONCURRENT_REQUESTS = 150
const EXPECTED_SUCCESS_COUNT = 100
const TEST_BUYER_COUNT = 150

interface CheckoutResult {
  success: boolean
  orderId?: string
  errorCode?: string
  latencyMs: number
}

interface LoadTestStats {
  totalRequests: number
  successCount: number
  failedCount: number
  soldOutCount: number
  limitExceededCount: number
  otherErrorCount: number
  avgLatency: number
  minLatency: number
  maxLatency: number
}

function testBuyerId(index: number): string {
  const suffix = String(index).padStart(12, '0')
  return `00000000-0000-4000-8000-${suffix}`
}

async function ensureTestBuyers(): Promise<void> {
  const passwordHash = await hashPassword('loadtest-password')

  for (let i = 0; i < TEST_BUYER_COUNT; i++) {
    const id = testBuyerId(i)
    const email = `loadtest-${String(i).padStart(4, '0')}@dropdeck.test`

    await query(
      `INSERT INTO users (id, email, password_hash, role, name)
       VALUES ($1, $2, $3, 'buyer', $4)
       ON CONFLICT (id) DO NOTHING`,
      [id, email, passwordHash, `Load Test Buyer ${i}`],
    )
  }
}

async function resetDropOrders(): Promise<void> {
  await query(`DELETE FROM checkout_log WHERE drop_id = $1`, [DROP_ID])
  await query(`DELETE FROM orders WHERE drop_id = $1`, [DROP_ID])
  await query(
    `UPDATE drops SET status = 'live', updated_at = NOW() WHERE id = $1`,
    [DROP_ID],
  )
}

async function runCheckout(buyerIndex: number): Promise<CheckoutResult> {
  const startTime = Date.now()
  const buyerId = testBuyerId(buyerIndex)

  try {
    const result = await attemptCheckout(DROP_ID, buyerId, 1)
    return {
      success: result.success,
      orderId: result.order?.id,
      errorCode: result.errorCode,
      latencyMs: result.latencyMs ?? Date.now() - startTime,
    }
  } catch (error) {
    return {
      success: false,
      errorCode: 'error',
      latencyMs: Date.now() - startTime,
    }
  }
}

async function runLoadTest() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗')
  console.log('║            DropDeck Load Test - Zero Oversell Guarantee       ║')
  console.log('╚═══════════════════════════════════════════════════════════════╝\n')

  console.log('Preparing test environment...')
  await ensureTestBuyers()
  await resetDropOrders()
  await syncDropLifecycle(DROP_ID)

  console.log(`Configuration:`)
  console.log(`  - Drop ID: ${DROP_ID}`)
  console.log(`  - Concurrent Requests: ${CONCURRENT_REQUESTS}`)
  console.log(`  - Test Buyers: ${TEST_BUYER_COUNT}`)
  console.log(`  - Expected Successful Orders: ${EXPECTED_SUCCESS_COUNT}\n`)

  console.log('Starting load test...\n')

  const startTime = Date.now()
  const promises: Promise<CheckoutResult>[] = []

  for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
    promises.push(runCheckout(i % TEST_BUYER_COUNT))
    if ((i + 1) % 10 === 0) {
      process.stdout.write(`\r  Progress: ${i + 1}/${CONCURRENT_REQUESTS} requests sent`)
    }
  }

  const results = await Promise.all(promises)
  console.log(`\r  Progress: ${CONCURRENT_REQUESTS}/${CONCURRENT_REQUESTS} requests completed\n`)

  const stats: LoadTestStats = {
    totalRequests: results.length,
    successCount: results.filter((r) => r.success).length,
    failedCount: results.filter((r) => !r.success).length,
    soldOutCount: results.filter((r) => !r.success && r.errorCode === 'sold_out').length,
    limitExceededCount: results.filter((r) => !r.success && r.errorCode === 'limit_exceeded').length,
    otherErrorCount: results.filter(
      (r) => !r.success && r.errorCode !== 'sold_out' && r.errorCode !== 'limit_exceeded',
    ).length,
    avgLatency: Math.round(results.reduce((sum, r) => sum + r.latencyMs, 0) / results.length),
    minLatency: Math.min(...results.map((r) => r.latencyMs)),
    maxLatency: Math.max(...results.map((r) => r.latencyMs)),
  }

  const totalTime = Date.now() - startTime

  console.log('╔═══════════════════════════════════════════════════════════════╗')
  console.log('║                         Test Results                          ║')
  console.log('╠═══════════════════════════════════════════════════════════════╣')
  console.log(`║ Total Requests:           ${String(stats.totalRequests).padStart(42)}║`)
  console.log(`║ Successful Orders:        ${String(stats.successCount).padStart(42)}║`)
  console.log(`║ Failed Requests:          ${String(stats.failedCount).padStart(42)}║`)
  console.log(`║   - Sold Out:             ${String(stats.soldOutCount).padStart(42)}║`)
  console.log(`║   - Limit Exceeded:       ${String(stats.limitExceededCount).padStart(42)}║`)
  console.log(`║   - Other Errors:         ${String(stats.otherErrorCount).padStart(42)}║`)
  console.log('╠═══════════════════════════════════════════════════════════════╣')
  console.log(`║ Avg Latency:              ${String(`${stats.avgLatency}ms`).padStart(42)}║`)
  console.log(`║ Min Latency:              ${String(`${stats.minLatency}ms`).padStart(42)}║`)
  console.log(`║ Max Latency:              ${String(`${stats.maxLatency}ms`).padStart(42)}║`)
  console.log(`║ Total Time:               ${String(`${totalTime}ms`).padStart(42)}║`)
  console.log('╠═══════════════════════════════════════════════════════════════╣')

  const testPassed = stats.successCount === EXPECTED_SUCCESS_COUNT
  const statusText = testPassed ? 'PASS' : 'FAIL'
  const statusColor = testPassed ? '\x1b[32m' : '\x1b[31m'

  console.log(`║ Zero-Oversell Test:       ${statusColor}${statusText.padStart(42)}\x1b[0m║`)

  if (!testPassed) {
    console.log(`║   Expected: ${EXPECTED_SUCCESS_COUNT} orders                                      ║`)
    console.log(`║   Got:      ${stats.successCount} orders                                        ║`)
    if (stats.successCount > EXPECTED_SUCCESS_COUNT) {
      console.log(`║   ERROR: Oversold by ${stats.successCount - EXPECTED_SUCCESS_COUNT} units!                     ║`)
    }
  }

  console.log('╚═══════════════════════════════════════════════════════════════╝\n')

  process.exit(testPassed ? 0 : 1)
}

if (require.main === module) {
  runLoadTest().catch((err) => {
    console.error('Load test error:', err)
    process.exit(1)
  })
}

export { runLoadTest }
