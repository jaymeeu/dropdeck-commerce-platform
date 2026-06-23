/**
 * POST /api/checkout
 * Initiates a checkout attempt and creates a reserved order
 *
 * Request body:
 * {
 *   dropId: string
 *   buyerId: string
 *   quantity: number
 * }
 *
 * Response:
 * {
 *   success: boolean
 *   order?: Order
 *   error?: string
 *   errorCode?: CheckoutOutcome
 *   latencyMs?: number
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { attemptCheckout } from '@/lib/actions/checkout'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { dropId, buyerId, quantity } = body

    if (!dropId || !buyerId || quantity === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: dropId, buyerId, quantity' },
        { status: 400 },
      )
    }

    const result = await attemptCheckout(dropId, buyerId, quantity)

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

// OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
