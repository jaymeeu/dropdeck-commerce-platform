import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY environment variable is not set')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-04-30.basil',
})

/**
 * Create a Stripe PaymentIntent for an order
 */
export async function createPaymentIntent(
  orderId: string,
  dropId: string,
  buyerId: string,
  amount: number,
) {
  return stripe.paymentIntents.create({
    amount,
    currency: 'usd',
    metadata: { orderId, dropId, buyerId },
    automatic_payment_methods: { enabled: true },
  })
}

/**
 * Construct and verify a Stripe webhook event
 */
export function constructWebhookEvent(
  body: Buffer,
  signature: string,
  secret: string,
) {
  return stripe.webhooks.constructEvent(body, signature, secret)
}
