#!/usr/bin/env node

/**
 * Load Test Script for DropDeck
 *
 * Tests the zero-oversell guarantee by firing concurrent checkout requests
 * against a single drop with known stock.
 *
 * Usage:
 *   npx tsx scripts/load-test.ts
 *
 * Prerequisites:
 * 1. Database must be populated with seed data (npx tsx scripts/migrate.ts)
 * 2. Development server must be running (pnpm dev)
 * 3. Test drop must exist and be in 'live' status
 */

import http from 'http'

// Configuration
const DROP_ID = 'd1111111-1111-1111-1111-111111111111' // Nike Air Jordan from seed data
const BUYER_BASE_ID = '33333333-3333-3333-3333-33333333333' // Buyer prefix (we'll vary the last char)
const CONCURRENT_REQUESTS = 150 // Number of concurrent checkout attempts
const API_URL = 'http://localhost:3000/api/checkout'
const EXPECTED_SUCCESS_COUNT = 100 // Drop has 100 units in seed data

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

/**
 * Make a checkout request
 */
function makeCheckoutRequest(buyerId: string): Promise<CheckoutResult> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      dropId: DROP_ID,
      buyerId,
      quantity: 1,
    })

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/checkout',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length,
      },
      timeout: 30000,
    }

    const startTime = Date.now()

    const req = http.request(options, (res) => {
      let data = ''

      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        const latencyMs = Date.now() - startTime

        try {
          const response = JSON.parse(data)
          resolve({
            success: response.success || false,
            orderId: response.order?.id,
            errorCode: response.errorCode,
            latencyMs,
          })
        } catch (err) {
          resolve({
            success: false,
            errorCode: 'parse_error',
            latencyMs,
          })
        }
      })
    })

    req.on('error', (err) => {
      const latencyMs = Date.now() - startTime
      console.error('[Load Test] Request error:', err.message)
      resolve({
        success: false,
        errorCode: 'request_error',
        latencyMs,
      })
    })

    req.on('timeout', () => {
      req.destroy()
      const latencyMs = Date.now() - startTime
      resolve({
        success: false,
        errorCode: 'timeout',
        latencyMs,
      })
    })

    req.write(postData)
    req.end()
  })
}

/**
 * Run the load test
 */
async function runLoadTest() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗')
  console.log('║            DropDeck Load Test - Zero Oversell Guarantee       ║')
  console.log('╚═══════════════════════════════════════════════════════════════╝\n')

  console.log(`Configuration:`)
  console.log(`  - Drop ID: ${DROP_ID}`)
  console.log(`  - Concurrent Requests: ${CONCURRENT_REQUESTS}`)
  console.log(`  - Expected Successful Orders: ${EXPECTED_SUCCESS_COUNT}`)
  console.log(`  - API URL: ${API_URL}\n`)

  console.log('Starting load test...\n')

  const startTime = Date.now()
  const results: CheckoutResult[] = []

  // Fire concurrent requests
  const promises: Promise<CheckoutResult>[] = []

  for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
    const buyerId = `${BUYER_BASE_ID}${String(i % 10).padStart(1, '0')}`
    promises.push(makeCheckoutRequest(buyerId))

    // Print progress
    if ((i + 1) % 10 === 0) {
      process.stdout.write(`\r  Progress: ${i + 1}/${CONCURRENT_REQUESTS} requests sent`)
    }
  }

  const responses = await Promise.all(promises)
  results.push(...responses)

  console.log(`\r  Progress: ${CONCURRENT_REQUESTS}/${CONCURRENT_REQUESTS} requests completed\n`)

  // Analyze results
  const stats: LoadTestStats = {
    totalRequests: results.length,
    successCount: results.filter((r) => r.success).length,
    failedCount: results.filter((r) => !r.success).length,
    soldOutCount: results.filter((r) => !r.success && r.errorCode === 'sold_out').length,
    limitExceededCount: results.filter((r) => !r.success && r.errorCode === 'limit_exceeded').length,
    otherErrorCount: results.filter((r) => !r.success && r.errorCode !== 'sold_out' && r.errorCode !== 'limit_exceeded').length,
    avgLatency: Math.round(results.reduce((sum, r) => sum + r.latencyMs, 0) / results.length),
    minLatency: Math.min(...results.map((r) => r.latencyMs)),
    maxLatency: Math.max(...results.map((r) => r.latencyMs)),
  }

  const totalTime = Date.now() - startTime

  // Print results
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

  // Validate zero-oversell guarantee
  const testPassed = stats.successCount === EXPECTED_SUCCESS_COUNT
  const statusIcon = testPassed ? '✓' : '✗'
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

  // Exit with appropriate code
  process.exit(testPassed ? 0 : 1)
}

// Run if executed directly
if (require.main === module) {
  runLoadTest().catch((err) => {
    console.error('Load test error:', err)
    process.exit(1)
  })
}

export { runLoadTest }
