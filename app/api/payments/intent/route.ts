/**
 * POST /api/payments/intent
 * Create or reuse a Stripe PaymentIntent for a reserved order
 */

import { NextRequest, NextResponse } from 'next/server'
import { createPaymentIntent, stripe } from '@/lib/stripe'
import { getOrder, setOrderPaymentIntent } from '@/lib/actions/checkout'
import { requireAuth } from '@/lib/auth/guards'

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const { orderId } = body

    if (!orderId) {
      return NextResponse.json({ error: 'Missing orderId' }, { status: 400 })
    }

    const order = await getOrder(orderId)
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.buyerId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (order.status !== 'reserved') {
      return NextResponse.json({ error: 'Order is not awaiting payment' }, { status: 400 })
    }

    if (new Date(order.expiresAt) <= new Date()) {
      return NextResponse.json({ error: 'Reservation has expired' }, { status: 400 })
    }

    if (order.stripePaymentIntentId) {
      const existing = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId)
      if (existing.status !== 'canceled' && existing.client_secret) {
        return NextResponse.json(
          {
            clientSecret: existing.client_secret,
            paymentIntentId: existing.id,
          },
          { status: 200 },
        )
      }
    }

    const paymentIntent = await createPaymentIntent(
      orderId,
      order.dropId,
      user.id!,
      order.totalAmount,
    )

    await setOrderPaymentIntent(orderId, paymentIntent.id)

    return NextResponse.json(
      {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication required')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    console.error('[payments/intent]', error)
    return NextResponse.json({ error: 'Failed to create payment intent' }, { status: 500 })
  }
}
