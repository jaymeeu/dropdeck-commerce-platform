import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET() {
  try {
    const result = await query('SELECT id, email, role, name FROM users LIMIT 5')
    
    return NextResponse.json({
      success: true,
      count: result.rows.length,
      users: result.rows,
    })
  } catch (error) {
    console.error('[v0] Debug endpoint error:', error)
    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 },
    )
  }
}
