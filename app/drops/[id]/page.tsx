'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { getDrop, getAvailableStock } from '@/lib/actions/drops'
import { attemptCheckout } from '@/lib/actions/checkout'
import { Button } from '@/components/ui/button'
import { Nav } from '@/components/layout/nav'
import type { Drop } from '@/lib/types'

export default function DropDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: session } = useSession()
  const router = useRouter()
  const user = session?.user as any

  const [drop, setDrop] = useState<Drop | null>(null)
  const [stock, setStock] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [timeLeft, setTimeLeft] = useState('')

  const loadDrop = useCallback(async () => {
    try {
      const data = await getDrop(id)
      if (data) {
        setDrop(data)
        const s = await getAvailableStock(id)
        setStock(s)
      }
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => { loadDrop() }, [loadDrop])

  // Poll stock every 5s
  useEffect(() => {
    const interval = setInterval(async () => {
      const s = await getAvailableStock(id)
      setStock(s)
    }, 5000)
    return () => clearInterval(interval)
  }, [id])

  // Countdown timer
  useEffect(() => {
    if (!drop) return
    const tick = () => {
      const now = Date.now()
      const target = drop.status === 'scheduled' ? new Date(drop.startTime).getTime() : new Date(drop.endTime).getTime()
      const diff = target - now
      if (diff <= 0) { setTimeLeft('00:00:00'); loadDrop(); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setTimeLeft(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [drop, loadDrop])

  const handleCheckout = async () => {
    if (!user) { router.push('/auth/signin'); return }
    setError('')
    setIsCheckingOut(true)
    try {
      const result = await attemptCheckout(id, user.id, quantity)
      if (result.success) {
        setSuccess('Order reserved! Redirecting to payment...')
        setTimeout(() => router.push('/orders'), 2000)
      } else {
        setError(result.message || 'Checkout failed')
      }
    } catch (e: any) {
      setError(e.message || 'An error occurred')
    } finally {
      setIsCheckingOut(false)
    }
  }

  if (isLoading) {
    return (
      <>
        <Nav />
        <main className="min-h-screen bg-background pt-24 flex items-center justify-center">
          <div className="text-muted-foreground animate-pulse">Loading drop...</div>
        </main>
      </>
    )
  }

  if (!drop) {
    return (
      <>
        <Nav />
        <main className="min-h-screen bg-background pt-24 flex items-center justify-center">
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground mb-2">Drop not found</p>
            <a href="/" className="text-[#6366f1] hover:underline">Back to storefront</a>
          </div>
        </main>
      </>
    )
  }

  const isLive = drop.status === 'live'
  const isScheduled = drop.status === 'scheduled'
  const isSoldOut = drop.status === 'sold_out' || stock === 0
  const price = drop.price / 100
  const stockPct = Math.max(0, Math.min(100, (stock / drop.totalStock) * 100))
  const isLowStock = isLive && stock <= 5 && stock > 0

  return (
    <>
      <Nav />
      <main className="min-h-screen bg-background pt-24 pb-16 px-6">
        <div className="max-w-5xl mx-auto">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">

            {/* Image */}
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-card border border-white/8">
              {drop.imageUrls?.[0] ? (
                <img src={drop.imageUrls[0]} alt={drop.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">No image</div>
              )}
              {isLive && (
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-emerald-500/90 text-white text-sm font-semibold px-3 py-1.5 rounded-lg backdrop-blur-sm">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  LIVE
                </div>
              )}
              {isSoldOut && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <span className="text-2xl font-black text-white/60 border-2 border-white/30 px-6 py-3 rounded-xl rotate-[-15deg]">SOLD OUT</span>
                </div>
              )}
            </div>

            {/* Details */}
            <div className="flex flex-col gap-6">
              <div>
                <h1 className="text-3xl font-black text-foreground leading-tight">{drop.title}</h1>
                <p className="text-muted-foreground mt-3 leading-relaxed">{drop.description}</p>
              </div>

              <div className="text-5xl font-black text-[#6366f1]">${price.toFixed(2)}</div>

              {/* Countdown */}
              {(isLive || isScheduled) && timeLeft && (
                <div className="bg-card border border-white/8 rounded-xl p-5">
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">
                    {isScheduled ? 'Drop starts in' : 'Time remaining'}
                  </p>
                  <p className="text-4xl font-black text-foreground font-mono">{timeLeft}</p>
                </div>
              )}

              {/* Stock Meter */}
              {isLive && (
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className={`font-semibold ${isLowStock ? 'text-[#f59e0b]' : 'text-foreground'}`}>
                      {isLowStock ? `Only ${stock} left!` : `${stock} remaining`}
                    </span>
                    <span className="text-muted-foreground">{drop.totalStock} total</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${isLowStock ? 'bg-[#f59e0b]' : 'bg-[#6366f1]'}`}
                      style={{ width: `${stockPct}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Quantity selector */}
              {isLive && !isSoldOut && (
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">Quantity</span>
                  <div className="flex items-center border border-white/10 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="px-4 py-2 text-foreground hover:bg-white/5 transition-colors"
                    >
                      −
                    </button>
                    <span className="px-4 py-2 text-foreground font-semibold border-x border-white/10">{quantity}</span>
                    <button
                      onClick={() => setQuantity((q) => Math.min(drop.maxPerBuyer, stock, q + 1))}
                      className="px-4 py-2 text-foreground hover:bg-white/5 transition-colors"
                    >
                      +
                    </button>
                  </div>
                  <span className="text-xs text-muted-foreground">max {drop.maxPerBuyer} per buyer</span>
                </div>
              )}

              {/* Feedback */}
              {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>}
              {success && <p className="text-emerald-400 text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">{success}</p>}

              {/* CTA */}
              {isSoldOut ? (
                <div className="bg-white/5 border border-white/10 rounded-xl px-6 py-4 text-center text-muted-foreground font-semibold">
                  This drop is sold out
                </div>
              ) : isScheduled ? (
                <div className="bg-[#6366f1]/10 border border-[#6366f1]/30 rounded-xl px-6 py-4 text-center text-[#6366f1] font-semibold">
                  Drop goes live soon — come back at launch time
                </div>
              ) : isLive ? (
                <Button
                  onClick={handleCheckout}
                  disabled={isCheckingOut}
                  className="w-full bg-[#6366f1] hover:bg-[#6366f1]/90 text-white font-bold py-4 text-lg rounded-xl"
                >
                  {isCheckingOut ? 'Reserving...' : `Buy Now · $${(price * quantity).toFixed(2)}`}
                </Button>
              ) : null}

              <p className="text-xs text-muted-foreground text-center">
                Zero-oversell guarantee — every order is atomic. No double-sells, ever.
              </p>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
