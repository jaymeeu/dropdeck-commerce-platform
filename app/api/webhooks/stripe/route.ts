/**
 * POST /api/webhooks/stripe
 * Stripe webhook handler for payment events
 *
 * Listens for:
 * - payment_intent.succeeded → mark order as paid
 * - payment_intent.payment_failed → mark order as expired
 *
 * Must be called with raw body (not JSON parsed)
 */

import { NextRequest, NextResponse } from 'next/server'
import { stripe, constructWebhookEvent } from '@/lib/stripe'
import { updateOrderStatus, getOrder } from '@/lib/actions/checkout'

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 },
    )
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    console.error('[v0] STRIPE_WEBHOOK_SECRET not set')
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 },
    )
  }

  try {
    // Get raw body
    const rawBody = await request.arrayBuffer()
    const body = Buffer.from(rawBody)

    // Construct and verify event
    const event = constructWebhookEvent(body, signature, webhookSecret)

    console.log(`[v0] Received Stripe webhook event: ${event.type}`)

    // Handle payment intent succeeded
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as any
      const { orderId } = paymentIntent.metadata

      if (orderId) {
        const order = await getOrder(orderId)

        if (order) {
          // Update order status: reserved → paid → confirmed
          await updateOrderStatus(orderId, 'paid')
          await updateOrderStatus(orderId, 'confirmed')

          console.log(`[v0] Order ${orderId} confirmed after payment`)

          // TODO: Send confirmation email here
        } else {
          console.warn(`[v0] Order ${orderId} not found for payment intent ${paymentIntent.id}`)
        }
      }
    }

    // Handle payment failed
    if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object as any
      const { orderId } = paymentIntent.metadata

      if (orderId) {
        const order = await getOrder(orderId)

        if (order) {
          // Mark as expired so reservation is released
          await updateOrderStatus(orderId, 'expired')

          console.log(`[v0] Order ${orderId} marked as expired after payment failure`)
        }
      }
    }

    // Handle charge refunded
    if (event.type === 'charge.refunded') {
      const charge = event.data.object as any
      const paymentIntentId = charge.payment_intent

      if (paymentIntentId) {
        // Retrieve payment intent to get metadata
        const pi = await stripe.paymentIntents.retrieve(paymentIntentId)
        const { orderId } = pi.metadata || {}

        if (orderId) {
          await updateOrderStatus(orderId, 'refunded')
          console.log(`[v0] Order ${orderId} marked as refunded`)
        }
      }
    }

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (error) {
    console.error('[v0] Webhook error:', error)

    const message = error instanceof Error ? error.message : 'Unknown error'

    if (message.includes('No signatures found matching')) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 403 },
      )
    }

    return NextResponse.json(
      { error: 'Webhook processing failed', details: message },
      { status: 500 },
    )
  }
}
