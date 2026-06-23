/**
 * POST /api/checkout
 * Initiates a checkout attempt and creates a reserved order
 *
 * Request body:
 * {
 *   dropId: string
 *   quantity: number
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth'
import { attemptCheckout } from '@/lib/actions/checkout'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { dropId, quantity } = body

    if (!dropId || quantity === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: dropId, quantity' },
        { status: 400 },
      )
    }

    const result = await attemptCheckout(dropId, session.user.id, quantity)

    return NextResponse.json(result, {
      status: result.success ? 201 : 400,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
