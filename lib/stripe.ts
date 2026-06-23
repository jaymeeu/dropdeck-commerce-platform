import Stripe from 'stripe'

let stripeInstance: Stripe | null = null

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY environment variable is not set')
  }

  if (!stripeInstance) {
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-04-30.basil',
    })
  }

  return stripeInstance
}

/** Lazy proxy — only connects to Stripe when first used. */
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    return Reflect.get(getStripe(), prop, receiver)
  },
})

export function isStripeAvailable(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

/**
 * Create a Stripe PaymentIntent for an order
 */
export async function createPaymentIntent(
  orderId: string,
  dropId: string,
  buyerId: string,
  amount: number,
) {
  return getStripe().paymentIntents.create({
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
  return getStripe().webhooks.constructEvent(body, signature, secret)
}
