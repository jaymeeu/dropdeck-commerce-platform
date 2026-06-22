'use client'

import { useState } from 'react'
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js'

interface PaymentParams {
  clientSecret: string
  orderId: string
}

interface PaymentResult {
  success: boolean
  error?: string
  paymentIntentId?: string
}

/**
 * Hook for handling Stripe payments
 * Must be used inside a Stripe Elements provider
 */
export function useStripePayment() {
  const stripe = useStripe()
  const elements = useElements()
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const processPayment = async (params: PaymentParams): Promise<PaymentResult> => {
    setIsProcessing(true)
    setError(null)

    try {
      if (!stripe || !elements) {
        throw new Error('Stripe is not loaded')
      }

      // Retrieve the CardElement
      const cardElement = elements.getElement(CardElement)

      if (!cardElement) {
        throw new Error('Card element not found')
      }

      // Confirm payment with Stripe
      const { paymentIntent, error: confirmError } = await stripe.confirmCardPayment(
        params.clientSecret,
        {
          payment_method: {
            card: cardElement,
            billing_details: {},
          },
        },
      )

      if (confirmError) {
        throw new Error(confirmError.message)
      }

      if (!paymentIntent) {
        throw new Error('No payment intent returned')
      }

      if (paymentIntent.status !== 'succeeded') {
        throw new Error(`Payment status: ${paymentIntent.status}`)
      }

      return {
        success: true,
        paymentIntentId: paymentIntent.id,
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Payment failed'
      setError(errorMessage)
      console.error('[v0] Payment error:', err)

      return {
        success: false,
        error: errorMessage,
      }
    } finally {
      setIsProcessing(false)
    }
  }

  return {
    stripe,
    elements,
    isProcessing,
    error,
    processPayment,
  }
}
