#!/usr/bin/env node
/**
 * DropDeck Production Load Test
 *
 * Validates the zero-oversell guarantee by firing 150 concurrent checkout
 * requests against a fresh test drop with 100 units on the live Vercel URL.
 *
 * Prerequisites:
 *   1. Set LOAD_TEST_SECRET in Vercel env vars (any random string)
 *   2. Deploy the app (includes /api/internal/load-test seeding endpoint)
 *
 * Usage:
 *   LOAD_TEST_SECRET=your-secret npx tsx scripts/load-test-prod.ts
 */

import https from 'https'

// ─── Config ──────────────────────────────────────────────────────────────────

const BASE_URL   = 'https://dropdeck-commerce-platform.vercel.app'
const SECRET     = process.env.LOAD_TEST_SECRET
const STOCK      = 100
const BUYERS     = 150

if (!SECRET) {
  console.error('ERROR: LOAD_TEST_SECRET env var is required.')
  console.error('  Add it to Vercel → Settings → Vars, then set it locally too:')
  console.error('  LOAD_TEST_SECRET=my-secret npx tsx scripts/load-test-prod.ts')
  process.exit(1)
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function request(method: string, path: string, body?: object): Promise<any> {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined
    const url = new URL(path, BASE_URL)

    const options: https.RequestOptions = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-load-test-secret': SECRET!,
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
      timeout: 30000,
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (c) => (data += c))
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch { reject(new Error('Bad JSON: ' + data.slice(0, 200))) }
      })
    })

    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')) })
    if (payload) req.write(payload)
    req.end()
  })
}

interface CheckoutResult {
  success: boolean
  orderId?: string
  errorCode?: string
  error?: string
  latencyMs: number
}

function checkout(dropId: string, buyerId: string): Promise<CheckoutResult> {
  return new Promise((resolve) => {
    const body = JSON.stringify({ dropId, buyerId, quantity: 1 })
    const url = new URL('/api/checkout', BASE_URL)

    const options: https.RequestOptions = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 30000,
    }

    const t0 = Date.now()

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (c) => (data += c))
      res.on('end', () => {
        const latencyMs = Date.now() - t0
        try {
          const json = JSON.parse(data)
          resolve({ success: json.success ?? false, orderId: json.order?.id, errorCode: json.errorCode, error: json.error, latencyMs })
        } catch {
          resolve({ success: false, errorCode: 'parse_error', latencyMs })
        }
      })
    })

    req.on('error', () => resolve({ success: false, errorCode: 'network_error', latencyMs: Date.now() - t0 }))
    req.on('timeout', () => { req.destroy(); resolve({ success: false, errorCode: 'timeout', latencyMs: Date.now() - t0 }) })

    req.write(body)
    req.end()
  })
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗')
  console.log('║       DropDeck Zero-Oversell Load Test (Production)          ║')
  console.log('╚══════════════════════════════════════════════════════════════╝\n')
  console.log(`  Target:   ${BASE_URL}`)
  console.log(`  Stock:    ${STOCK} units`)
  console.log(`  Buyers:   ${BUYERS} concurrent\n`)

  // ── 1. Seed test data ──────────────────────────────────────────────────────
  process.stdout.write('Seeding test data... ')
  const seed = await request('POST', '/api/internal/load-test', { stock: STOCK, buyers: BUYERS })
  if (seed.error) throw new Error('Seed failed: ' + seed.error)
  const { dropId, buyerIds, sellerId } = seed
  console.log(`done\n  Drop: ${dropId}\n  Buyers: ${buyerIds.length} created\n`)

  // ── 2. Fire all checkouts simultaneously ───────────────────────────────────
  console.log('Firing all requests simultaneously...')
  const t0 = Date.now()
  const results = await Promise.all(buyerIds.map((id: string) => checkout(dropId, id)))
  const wallMs = Date.now() - t0
  console.log(`All ${BUYERS} requests completed in ${wallMs}ms\n`)

  // ── 3. Verify DB order count ───────────────────────────────────────────────
  const verify = await request('GET', `/api/internal/load-test?dropId=${dropId}`)
  const dbOrders: number = verify.dbOrders

  // ── 4. Stats ───────────────────────────────────────────────────────────────
  const succeeded  = results.filter((r) => r.success)
  const soldOut    = results.filter((r) => r.errorCode === 'sold_out')
  const limitErr   = results.filter((r) => r.errorCode === 'limit_exceeded')
  const netErr     = results.filter((r) => ['network_error','timeout','parse_error'].includes(r.errorCode ?? ''))
  const otherErr   = results.filter((r) => !r.success && !['sold_out','limit_exceeded','network_error','timeout','parse_error'].includes(r.errorCode ?? ''))

  const lats       = results.map((r) => r.latencyMs).sort((a, b) => a - b)
  const avg        = Math.round(lats.reduce((a, b) => a + b, 0) / lats.length)
  const p50        = lats[Math.floor(lats.length * 0.5)]
  const p95        = lats[Math.floor(lats.length * 0.95)]
  const p99        = lats[Math.floor(lats.length * 0.99)]

  const oversold   = dbOrders > STOCK
  const passed     = !oversold && succeeded.length <= STOCK

  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║                        Test Results                         ║')
  console.log('╠══════════════════════════════════════════════════════════════╣')
  console.log(`║  Total fired          ${String(results.length).padEnd(39)}║`)
  console.log(`║  API successes        ${String(succeeded.length).padEnd(39)}║`)
  console.log(`║  DB orders created    ${String(dbOrders).padEnd(39)}║`)
  console.log(`║  Sold-out rejected    ${String(soldOut.length).padEnd(39)}║`)
  console.log(`║  Limit exceeded       ${String(limitErr.length).padEnd(39)}║`)
  console.log(`║  Network/timeout      ${String(netErr.length).padEnd(39)}║`)
  console.log(`║  Other errors         ${String(otherErr.length).padEnd(39)}║`)
  console.log('╠══════════════════════════════════════════════════════════════╣')
  console.log(`║  Avg latency          ${String(avg + 'ms').padEnd(39)}║`)
  console.log(`║  p50 latency          ${String(p50 + 'ms').padEnd(39)}║`)
  console.log(`║  p95 latency          ${String(p95 + 'ms').padEnd(39)}║`)
  console.log(`║  p99 latency          ${String(p99 + 'ms').padEnd(39)}║`)
  console.log(`║  Wall time            ${String(wallMs + 'ms').padEnd(39)}║`)
  console.log('╠══════════════════════════════════════════════════════════════╣')

  if (oversold) {
    console.log(`║  ZERO-OVERSELL        \x1b[31mFAIL — ${dbOrders} orders for ${STOCK} units\x1b[0m${' '.repeat(Math.max(0,39-(`FAIL — ${dbOrders} orders for ${STOCK} units`).length))}║`)
  } else {
    console.log(`║  ZERO-OVERSELL        \x1b[32mPASS — ${dbOrders}/${STOCK} sold, 0 oversold\x1b[0m${' '.repeat(Math.max(0,39-(`PASS — ${dbOrders}/${STOCK} sold, 0 oversold`).length))}║`)
  }

  console.log('╚══════════════════════════════════════════════════════════════╝')

  if (otherErr.length > 0) {
    console.log('\nSample unexpected errors:')
    otherErr.slice(0, 5).forEach((r) => console.log(`  code=${r.errorCode}  msg=${r.error}`))
  }

  // ── 5. Clean up ────────────────────────────────────────────────────────────
  process.stdout.write('\nCleaning up test data... ')
  await request('DELETE', '/api/internal/load-test', { dropId, buyerIds, sellerId })
  console.log('done\n')

  process.exit(passed ? 0 : 1)
}

run().catch((err) => { console.error('\nFatal:', err.message); process.exit(1) })
