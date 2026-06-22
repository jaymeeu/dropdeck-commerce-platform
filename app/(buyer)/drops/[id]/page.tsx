'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/hooks/use-auth'
import { getDrop, getAvailableStock } from '@/lib/actions/drops'
import { attemptCheckout } from '@/lib/actions/checkout'
import type { Drop } from '@/lib/types'

interface DropDetailPageProps {
  params: {
    id: string
  }
}

export default function DropDetailPage({ params }: DropDetailPageProps) {
  const { user } = useAuth()
  const [drop, setDrop] = useState<Drop | null>(null)
  const [availableStock, setAvailableStock] = useState<number>(0)
  const [quantity, setQuantity] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Load drop details
  useEffect(() => {
    async function loadDrop() {
      try {
        const dropData = await getDrop(params.id)
        if (dropData) {
          setDrop(dropData)
          const stock = await getAvailableStock(params.id)
          setAvailableStock(stock)
        }
      } catch (err) {
        setError('Failed to load drop')
        console.error('[v0] Error loading drop:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadDrop()
  }, [params.id])

  // Poll for stock updates
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const stock = await getAvailableStock(params.id)
        setAvailableStock(stock)
      } catch (err) {
        console.error('[v0] Error polling stock:', err)
      }
    }, 5000) // Poll every 5 seconds

    return () => clearInterval(interval)
  }, [params.id])

  const handleCheckout = async () => {
    if (!user) {
      setError('Please sign in to checkout')
      return
    }

    if (!drop) {
      setError('Drop not found')
      return
    }

    setIsCheckingOut(true)
    setError('')
    setSuccess('')

    try {
      const result = await attemptCheckout(drop.id, user.id, quantity)

      if (result.success && result.order) {
        setSuccess(`Order created! ID: ${result.order.id}`)
        // TODO: Redirect to payment page
      } else {
        setError(result.error || 'Checkout failed')
      }
    } catch (err) {
      setError('An error occurred during checkout')
      console.error('[v0] Checkout error:', err)
    } finally {
      setIsCheckingOut(false)
    }
  }

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  if (!drop) {
    return <div className="min-h-screen flex items-center justify-center">Drop not found</div>
  }

  const price = drop.price / 100
  const isLive = drop.status === 'live'
  const isSoldOut = drop.status === 'sold_out' || availableStock === 0
  const canCheckout = isLive && availableStock > 0 && user && quantity <= drop.maxPerBuyer

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Image Gallery */}
          <div>
            <div className="bg-gray-200 rounded-lg overflow-hidden mb-4">
              {drop.imageUrls[0] ? (
                <img
                  src={drop.imageUrls[0]}
                  alt={drop.title}
                  className="w-full h-96 object-cover"
                />
              ) : (
                <div className="w-full h-96 flex items-center justify-center text-gray-400">
                  No image
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {drop.imageUrls.length > 1 && (
              <div className="flex gap-2">
                {drop.imageUrls.slice(1, 5).map((url, i) => (
                  <div key={i} className="w-20 h-20 bg-gray-200 rounded overflow-hidden cursor-pointer">
                    <img src={url} alt={`${drop.title} ${i + 2}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Details & Checkout */}
          <div>
            <div className="mb-6">
              <h1 className="text-4xl font-bold mb-2">{drop.title}</h1>

              {/* Status */}
              <div className="mb-4">
                {isLive && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                    <span className="h-2 w-2 bg-green-600 rounded-full animate-pulse" />
                    LIVE NOW
                  </span>
                )}
                {isSoldOut && (
                  <span className="inline-block px-3 py-1 bg-gray-100 text-gray-800 text-sm font-medium rounded-full">
                    SOLD OUT
                  </span>
                )}
                {drop.status === 'scheduled' && (
                  <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                    COMING SOON
                  </span>
                )}
              </div>

              {/* Price */}
              <div className="mb-6">
                <div className="text-5xl font-bold mb-2">${price.toFixed(2)}</div>
                <div className="text-gray-600">
                  {availableStock} of {drop.totalStock} available
                </div>
              </div>

              {/* Description */}
              {drop.description && (
                <div className="mb-6">
                  <h2 className="font-semibold mb-2">Description</h2>
                  <p className="text-gray-700">{drop.description}</p>
                </div>
              )}

              {/* Seller Info */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600">Sold by</div>
                <div className="font-semibold">{drop.seller?.storeName || 'Unknown Seller'}</div>
              </div>

              {/* Checkout Section */}
              <div className="space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
                    {success}
                  </div>
                )}

                {isLive && !isSoldOut && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-2">Quantity</label>
                      <select
                        value={quantity}
                        onChange={(e) => setQuantity(Math.min(parseInt(e.target.value), drop.maxPerBuyer))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={isCheckingOut}
                      >
                        {Array.from({ length: Math.min(drop.maxPerBuyer, availableStock) }, (_, i) => i + 1).map(
                          (num) => (
                            <option key={num} value={num}>
                              {num} {num === 1 ? 'item' : 'items'}
                            </option>
                          ),
                        )}
                      </select>
                    </div>

                    <button
                      onClick={handleCheckout}
                      disabled={isCheckingOut || !canCheckout}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 rounded-lg transition-colors"
                    >
                      {isCheckingOut ? 'Processing...' : `Checkout - $${(price * quantity).toFixed(2)}`}
                    </button>
                  </>
                )}

                {isSoldOut && (
                  <button disabled className="w-full bg-gray-400 text-white font-bold py-3 rounded-lg">
                    Sold Out
                  </button>
                )}

                {!isLive && !isSoldOut && (
                  <button disabled className="w-full bg-gray-400 text-white font-bold py-3 rounded-lg">
                    Not Available Yet
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
