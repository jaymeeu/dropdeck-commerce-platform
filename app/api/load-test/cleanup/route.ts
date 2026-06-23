import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

const TEST_PREFIX = 'loadtest_'

export async function POST(req: NextRequest) {
  const log: string[] = []

  try {
    // Get all test drops to clean up
    const dropsResult = await query(
      `SELECT id FROM drops WHERE title = 'Load Test Drop' AND seller_id IN (
        SELECT id FROM users WHERE email = $1
      )`,
      [`${TEST_PREFIX}seller@test.com`],
    )

    const testDropIds = dropsResult.rows.map((r: any) => r.id)
    log.push(`Found ${testDropIds.length} test drops to clean up`)

    // Clean up in FK-safe order:
    // checkout_log + orders reference drops(id) and users(id)
    // so clean those first, then drops, then users
    for (const dropId of testDropIds) {
      try {
        await query(`DELETE FROM checkout_log WHERE drop_id = $1`, [dropId])
      } catch {
        // continue
      }
    }
    log.push(`✓ Cleaned checkout_log`)

    for (const dropId of testDropIds) {
      try {
        await query(`DELETE FROM orders WHERE drop_id = $1`, [dropId])
      } catch {
        // continue
      }
    }
    log.push(`✓ Cleaned orders`)

    for (const dropId of testDropIds) {
      try {
        await query(`DELETE FROM drops WHERE id = $1`, [dropId])
      } catch {
        // continue
      }
    }
    log.push(`✓ Cleaned drops`)

    // Delete all test users
    try {
      await query(`DELETE FROM users WHERE email LIKE $1`, [`${TEST_PREFIX}%`])
    } catch {
      // continue
    }
    log.push(`✓ Cleaned users`)

    return NextResponse.json(
      {
        success: true,
        message: 'Load test data cleaned up successfully',
        log: log.join('\n'),
      },
      { status: 200 },
    )
  } catch (error) {
    return NextResponse.json({ error: String(error), log: log.join('\n') }, { status: 500 })
  }
}
