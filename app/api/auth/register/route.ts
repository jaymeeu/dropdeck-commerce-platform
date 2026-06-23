/**
 * POST /api/auth/register
 * Register a new user
 *
 * Request body:
 * {
 *   email: string
 *   password: string
 *   name: string
 *   role?: 'buyer' | 'seller'
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createUser } from '@/lib/actions/users'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, name, role = 'buyer' } = body

    // Validation
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Missing required fields: email, password, name' },
        { status: 400 },
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 },
      )
    }

    if (!['buyer', 'seller'].includes(role)) {
      return NextResponse.json(
        { error: 'Role must be buyer or seller' },
        { status: 400 },
      )
    }

    // Create user
    const user = await createUser(email, password, name, role)

    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
      { status: 201 },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed'

    if (message.includes('already exists')) {
      return NextResponse.json(
        { error: message },
        { status: 409 },
      )
    }

    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 },
    )
  }
}
