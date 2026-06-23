/**
 * POST /api/auth/register
 * Register a new user
 */

import { NextRequest, NextResponse } from 'next/server'
import { createUser, createSellerProfile } from '@/lib/actions/users'
import { slugify } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, name, role = 'buyer', storeName, storeSlug } = body

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

    if (role === 'seller') {
      if (!storeName?.trim()) {
        return NextResponse.json(
          { error: 'Store name is required for seller accounts' },
          { status: 400 },
        )
      }
      const slug = slugify(storeSlug || storeName)
      if (slug.length < 2) {
        return NextResponse.json(
          { error: 'Store URL slug must be at least 2 characters' },
          { status: 400 },
        )
      }
    }

    const user = await createUser(email, password, name, role)

    if (role === 'seller') {
      await createSellerProfile(user.id, storeName.trim(), storeSlug || storeName)
    }

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

    if (message.includes('already exists') || message.includes('already in use')) {
      return NextResponse.json({ error: message }, { status: 409 })
    }

    return NextResponse.json(
      { error: message || 'Registration failed' },
      { status: 500 },
    )
  }
}
