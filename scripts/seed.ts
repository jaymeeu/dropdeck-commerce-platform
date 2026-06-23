import fs from 'fs'
import path from 'path'
import { query } from '../lib/db'

async function seedDatabase() {
  console.log('🌱 Seeding database with test data...')

  const seedFilepath = path.join(process.cwd(), 'scripts', '002-seed-data.sql')
  const sql = fs.readFileSync(seedFilepath, 'utf-8')

  try {
    await query(sql)
    console.log('✓ Seed data applied successfully')
  } catch (error) {
    console.error('✗ Error seeding database:', error)
    throw error
  }
}

seedDatabase().catch((error) => {
  console.error('Seeding failed:', error)
  process.exit(1)
})
