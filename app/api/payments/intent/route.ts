/**
 * POST /api/payments/intent
 * Create a Stripe PaymentIntent for an order
 *
 * Called after checkout reservation succeeds but before payment UI is shown
 *
 * Request body:
 * {
 *   orderId: string
 *   dropId: string
 *   buyerId: string
 *   amount: number (in cents)
 * }
 *
 * Response:
 * {
 *   clientSecret: string
 *   paymentIntentId: string
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createPaymentIntent } from '@/lib/stripe'
import { getOrder, updateOrderStatus } from '@/lib/actions/checkout'
import { requireAuth } from '@/lib/auth/guards'

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await request.json()

    const { orderId, dropId, buyerId, amount } = body

    // Validate
    if (!orderId || !dropId || !buyerId || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 },
      )
    }

    // Verify the order belongs to the requesting user
    if (user.id !== buyerId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 },
      )
    }

    // Verify the order exists
    const order = await getOrder(orderId)
    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 },
      )
    }

    // Verify the amount matches
    if (order.totalAmount !== amount) {
      return NextResponse.json(
        { error: 'Amount mismatch' },
        { status: 400 },
      )
    }

    // Create the PaymentIntent
    const paymentIntent = await createPaymentIntent(orderId, dropId, buyerId, amount)

    return NextResponse.json(
      {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication required')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      )
    }

    return NextResponse.json(
      { error: 'Failed to create payment intent' },
      { status: 500 },
    )
  }
}
