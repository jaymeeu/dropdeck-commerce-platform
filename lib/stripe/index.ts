import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
})

/**
 * Create a PaymentIntent for a drop order
 * This is called after checkout is reserved but before payment is confirmed
 */
export async function createPaymentIntent(
  orderId: string,
  dropId: string,
  buyerId: string,
  amount: number, // in cents
): Promise<Stripe.PaymentIntent> {
  return stripe.paymentIntents.create({
    amount,
    currency: 'usd',
    metadata: {
      orderId,
      dropId,
      buyerId,
    },
    description: `DropDeck Order ${orderId}`,
  })
}

/**
 * Confirm a payment intent (mark order as paid)
 */
export async function confirmPayment(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
  return stripe.paymentIntents.retrieve(paymentIntentId)
}

/**
 * Cancel a payment intent
 */
export async function cancelPayment(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
  return stripe.paymentIntents.cancel(paymentIntentId)
}

/**
 * Construct event from webhook payload
 */
export function constructWebhookEvent(
  body: string | Buffer,
  sig: string,
  secret: string,
): Stripe.Event {
  return stripe.webhooks.constructEvent(body, sig, secret)
}
