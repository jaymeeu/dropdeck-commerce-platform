'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CardElement } from '@stripe/react-stripe-js'
import { Button } from '@/components/ui/button'
import { useStripePayment } from '@/lib/hooks/use-stripe-payment'
import { confirmOrderPayment, simulateOrderPayment } from '@/lib/actions/checkout'
import { isStripeConfigured } from '@/components/providers/stripe-provider'

function isSimulatePaymentsEnabled() {
  return process.env.NEXT_PUBLIC_SIMULATE_PAYMENTS === 'true' || !isStripeConfigured()
}

interface PaymentFormProps {
  orderId: string
  dropTitle: string
  amount: number
  quantity: number
  expiresAt: string
}

const cardElementOptions = {
  style: {
    base: {
      color: '#fafafa',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      '::placeholder': { color: '#71717a' },
    },
    invalid: { color: '#f87171' },
  },
}

export function PaymentForm({
  orderId,
  dropTitle,
  amount,
  quantity,
  expiresAt,
}: PaymentFormProps) {
  const router = useRouter()
  const { processPayment, isProcessing, error } = useStripePayment()
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loadError, setLoadError] = useState('')
  const [isLoadingIntent, setIsLoadingIntent] = useState(true)

  const [isSimulating, setIsSimulating] = useState(false)
  const simulateMode = isSimulatePaymentsEnabled()

  useEffect(() => {
    if (simulateMode) {
      setIsLoadingIntent(false)
      return
    }

    if (!isStripeConfigured()) {
      setLoadError('Stripe is not configured. Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.')
      setIsLoadingIntent(false)
      return
    }

    async function loadIntent() {
      try {
        const res = await fetch('/api/payments/intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId }),
        })

        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error || 'Failed to start payment')
        }

        setClientSecret(data.clientSecret)
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load payment')
      } finally {
        setIsLoadingIntent(false)
      }
    }

    loadIntent()
  }, [orderId, simulateMode])

  const handleSimulatePay = async () => {
    setLoadError('')
    setIsSimulating(true)
    try {
      await simulateOrderPayment(orderId)
      router.push(`/orders/${orderId}/success`)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Simulated payment failed')
    } finally {
      setIsSimulating(false)
    }
  }

  const handlePay = async () => {
    if (!clientSecret) return

    const result = await processPayment({ clientSecret, orderId })
    if (!result.success || !result.paymentIntentId) return

    try {
      await confirmOrderPayment(orderId, result.paymentIntentId)
      router.push(`/orders/${orderId}/success`)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to confirm order')
    }
  }

  const price = amount / 100
  const expiry = new Date(expiresAt)

  return (
    <div className="bg-card border border-white/8 rounded-2xl p-8 space-y-6">
      <div>
        <p className="text-sm text-muted-foreground uppercase tracking-widest mb-1">Complete payment</p>
        <h2 className="text-2xl font-black text-foreground">{dropTitle}</h2>
        <p className="text-muted-foreground mt-1">
          {quantity} {quantity === 1 ? 'unit' : 'units'} · Pay before{' '}
          {expiry.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      <div className="text-4xl font-black text-[#6366f1]">${price.toFixed(2)}</div>

      {isLoadingIntent ? (
        <p className="text-muted-foreground animate-pulse">Preparing secure checkout...</p>
      ) : simulateMode ? (
        <>
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-sm text-amber-200">
            Demo mode — payment is simulated. No real charge will be made.
          </div>
          {loadError && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              {loadError}
            </p>
          )}
          <Button
            onClick={handleSimulatePay}
            disabled={isSimulating}
            className="w-full bg-[#6366f1] hover:bg-[#6366f1]/90 text-white font-bold py-4 text-lg rounded-xl"
          >
            {isSimulating ? 'Confirming...' : `Simulate Payment · $${price.toFixed(2)}`}
          </Button>
        </>
      ) : loadError ? (
        <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          {loadError}
        </p>
      ) : (
        <>
          <div className="bg-background border border-white/10 rounded-xl px-4 py-4">
            <CardElement options={cardElementOptions} />
          </div>
          <p className="text-xs text-muted-foreground">
            Test card: 4242 4242 4242 4242 · any future expiry · any CVC
          </p>
          {(error || loadError) && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              {error || loadError}
            </p>
          )}
          <Button
            onClick={handlePay}
            disabled={isProcessing || !clientSecret}
            className="w-full bg-[#6366f1] hover:bg-[#6366f1]/90 text-white font-bold py-4 text-lg rounded-xl"
          >
            {isProcessing ? 'Processing...' : `Pay $${price.toFixed(2)}`}
          </Button>
        </>
      )}
    </div>
  )
}
