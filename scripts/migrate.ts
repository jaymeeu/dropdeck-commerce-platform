/**
 * Database migration runner
 * Usage: npx tsx scripts/migrate.ts
 *
 * This script reads all SQL files from scripts/ directory (numbered: 001-*.sql, 002-*.sql, etc)
 * and applies them to the Aurora PostgreSQL database in order.
 */

import fs from 'fs'
import path from 'path'
import { query } from '../lib/db'

const scriptsDir = path.join(process.cwd(), 'scripts')

async function runMigrations() {
  console.log('🔄 Running database migrations...')

  // Get all SQL files
  const files = fs
    .readdirSync(scriptsDir)
    .filter((f) => f.match(/^\d{3}-.*\.sql$/))
    .sort()

  if (files.length === 0) {
    console.log('✓ No SQL files to migrate')
    return
  }

  for (const file of files) {
    const filepath = path.join(scriptsDir, file)
    const sql = fs.readFileSync(filepath, 'utf-8')

    try {
      console.log(`📝 Applying ${file}...`)
      await query(sql)
      console.log(`✓ ${file} applied successfully`)
    } catch (error) {
      console.error(`✗ Error applying ${file}:`, error)
      throw error
    }
  }

  console.log('✓ All migrations completed successfully')
}

runMigrations().catch((error) => {
  console.error('Migration failed:', error)
  process.exit(1)
})
