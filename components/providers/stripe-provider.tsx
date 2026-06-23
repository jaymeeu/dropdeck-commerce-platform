'use client'

import React from 'react'
import { Elements } from '@stripe/react-stripe-js'
import { loadStripe, type Stripe } from '@stripe/stripe-js'

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
const stripePromise: Promise<Stripe | null> | null = publishableKey
  ? loadStripe(publishableKey)
  : null

export function StripeProvider({ children }: { children: React.ReactNode }) {
  if (!stripePromise) {
    return <>{children}</>
  }

  return <Elements stripe={stripePromise}>{children}</Elements>
}

export function isStripeConfigured() {
  return Boolean(publishableKey)
}
