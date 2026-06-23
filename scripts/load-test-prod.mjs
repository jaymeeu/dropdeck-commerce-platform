#!/usr/bin/env node
/**
 * DropDeck Production Load Test runner
 *
 * Calls POST /api/load-test which runs entirely server-side:
 * DB setup → 150 concurrent checkouts → result analysis → cleanup.
 *
 * Run:
 *   node scripts/load-test-prod.mjs
 */

import https from 'https'

const BASE_URL = 'https://dropdeck-commerce-platform.vercel.app'
const SECRET   = 'dropdeck-load-test'

function postJSON(url, body, secret) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body)
    const u    = new URL(url)
    const req  = https.request(
      {
        hostname: u.hostname,
        path:     u.pathname,
        method:   'POST',
        headers: {
          'Content-Type':        'application/json',
          'Content-Length':      Buffer.byteLength(data),
          'x-load-test-secret':  secret,
        },
        timeout: 300000, // 5 min — test takes a while
      },
      (res) => {
        let raw = ''
        res.on('data', (c) => (raw += c))
        res.on('end', () => {
          try { resolve(JSON.parse(raw)) }
          catch { reject(new Error(`Non-JSON response: ${raw.slice(0, 200)}`)) }
        })
      }
    )
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')) })
    req.write(data)
    req.end()
  })
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗')
  console.log('║        DropDeck Production Load Test — Zero Oversell         ║')
  console.log('╚══════════════════════════════════════════════════════════════╝\n')
  console.log(`Target: ${BASE_URL}`)
  console.log('Running test (this takes ~30–60s)...\n')

  const result = await postJSON(`${BASE_URL}/api/load-test`, {}, SECRET)

  if (!result.summary) {
    console.error('Unexpected response:', JSON.stringify(result, null, 2))
    process.exit(1)
  }

  const s = result.summary
  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║                        Test Results                          ║')
  console.log('╠══════════════════════════════════════════════════════════════╣')
  console.log(`║  Total requests:     ${String(s.totalRequests).padEnd(41)}║`)
  console.log(`║  API successes:      ${String(s.apiSuccesses).padEnd(41)}║`)
  console.log(`║  DB orders created:  ${String(s.dbOrdersCreated).padEnd(41)}║`)
  console.log(`║  Sold-out rejects:   ${String(s.soldOutRejects).padEnd(41)}║`)
  console.log(`║  Limit exceeded:     ${String(s.limitExceededRejects).padEnd(41)}║`)
  console.log(`║  Other errors:       ${String(s.otherErrors).padEnd(41)}║`)
  if (s.errorCodes?.length) {
    console.log(`║  Error codes:        ${String(s.errorCodes.join(', ')).padEnd(41)}║`)
  }
  console.log('╠══════════════════════════════════════════════════════════════╣')
  console.log(`║  Avg latency:        ${String(s.avgLatencyMs + 'ms').padEnd(41)}║`)
  console.log(`║  Min latency:        ${String(s.minLatencyMs + 'ms').padEnd(41)}║`)
  console.log(`║  Max latency:        ${String(s.maxLatencyMs + 'ms').padEnd(41)}║`)
  console.log(`║  Wall-clock time:    ${String(s.wallClockMs + 'ms').padEnd(41)}║`)
  console.log('╠══════════════════════════════════════════════════════════════╣')

  if (result.pass) {
    console.log('║  Zero-Oversell:      \x1b[32mPASS — no oversell detected\x1b[0m             ║')
  } else {
    console.log(`║  Zero-Oversell:      \x1b[31mFAIL — oversold by ${s.oversellBy} units\x1b[0m              ║`)
  }

  console.log('╚══════════════════════════════════════════════════════════════╝\n')
  process.exit(result.pass ? 0 : 1)
}

main().catch((err) => {
  console.error('\nFatal error:', err.message)
  process.exit(1)
})
