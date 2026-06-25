'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { DropWithSeller } from '@/lib/types'

interface DropCardProps {
  drop: DropWithSeller
  availableStock?: number
}

function useCountdown(targetDate: Date | null) {
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(targetDate))

  useEffect(() => {
    if (!targetDate) return
    const interval = setInterval(() => setTimeLeft(getTimeLeft(targetDate)), 1000)
    return () => clearInterval(interval)
  }, [targetDate])

  return timeLeft
}

function getTimeLeft(target: Date | null) {
  if (!target) return null
  const diff = target.getTime() - Date.now()
  if (diff <= 0) return { hours: 0, minutes: 0, seconds: 0, total: 0 }
  return {
    hours: Math.floor(diff / 1000 / 60 / 60),
    minutes: Math.floor((diff / 1000 / 60) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    total: diff,
  }
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center min-w-[2.5rem]">
      <span className="text-2xl md:text-3xl font-black tabular-nums leading-none text-foreground">
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mt-1">{label}</span>
    </div>
  )
}

export function DropCard({ drop, availableStock }: DropCardProps) {
  const isLive = drop.status === 'live'
  const isSoldOut = drop.status === 'sold_out'
  const isScheduled = drop.status === 'scheduled'

  const countdown = useCountdown(isScheduled && drop.startTime ? drop.startTime : null)
  const liveCountdown = useCountdown(isLive && drop.endTime ? drop.endTime : null)

  const stockPercent =
    isLive && availableStock != null
      ? Math.max(0, Math.min(100, (availableStock / drop.totalStock) * 100))
      : null

  const price = (drop.price / 100).toFixed(2)

  const sellerName = drop.store_name || drop.name || 'Unknown Seller'

  return (
    <Link href={`/drops/${drop.id}`} className="block group">
      <article className="relative bg-card border border-border overflow-hidden transition-all duration-200 hover:border-white/20 hover:bg-[#161616]" style={{ borderRadius: '6px' }}>

        {/* Image */}
        <div className="relative aspect-[4/3] bg-muted overflow-hidden">
          {drop.imageUrls[0] ? (
            <img
              src={drop.imageUrls[0]}
              alt={drop.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-[#1a1a1a]">
              <span className="text-muted-foreground text-sm font-medium tracking-widest uppercase">No Image</span>
            </div>
          )}

          {/* Status pill — top left */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5">
            {isLive && (
              <div className="flex items-center gap-1.5 bg-[#080808]/90 backdrop-blur-sm border border-[#22c55e]/40 px-2.5 py-1 rounded-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22c55e]" />
                </span>
                <span className="text-[#22c55e] text-xs font-bold uppercase tracking-widest">Live</span>
              </div>
            )}
            {isScheduled && (
              <div className="flex items-center gap-1.5 bg-[#080808]/90 backdrop-blur-sm border border-white/10 px-2.5 py-1 rounded-sm">
                <span className="text-white/60 text-xs font-medium uppercase tracking-widest">Upcoming</span>
              </div>
            )}
            {isSoldOut && (
              <div className="flex items-center gap-1.5 bg-[#080808]/90 backdrop-blur-sm border border-white/10 px-2.5 py-1 rounded-sm">
                <span className="text-muted-foreground text-xs font-medium uppercase tracking-widest">Sold Out</span>
              </div>
            )}
          </div>

          {/* Price — top right */}
          <div className="absolute top-3 right-3 bg-[#080808]/90 backdrop-blur-sm border border-white/10 px-2.5 py-1 rounded-sm">
            <span className="text-foreground text-sm font-black">${price}</span>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 md:p-5">
          {/* Seller */}
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-1.5">{sellerName}</p>

          {/* Title */}
          <h3 className="font-black text-base md:text-lg leading-tight text-foreground line-clamp-2 mb-4 group-hover:text-white transition-colors">
            {drop.title}
          </h3>

          {/* Countdown — Live ends in / Scheduled starts in */}
          {isLive && liveCountdown && liveCountdown.total > 0 && (
            <div className="mb-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Ends in</p>
              <div className="flex items-end gap-3">
                <CountdownUnit value={liveCountdown.hours} label="hrs" />
                <span className="text-muted-foreground text-xl font-black mb-1">:</span>
                <CountdownUnit value={liveCountdown.minutes} label="min" />
                <span className="text-muted-foreground text-xl font-black mb-1">:</span>
                <CountdownUnit value={liveCountdown.seconds} label="sec" />
              </div>
            </div>
          )}

          {isScheduled && countdown && countdown.total > 0 && (
            <div className="mb-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Drops in</p>
              <div className="flex items-end gap-3">
                <CountdownUnit value={countdown.hours} label="hrs" />
                <span className="text-muted-foreground text-xl font-black mb-1">:</span>
                <CountdownUnit value={countdown.minutes} label="min" />
                <span className="text-muted-foreground text-xl font-black mb-1">:</span>
                <CountdownUnit value={countdown.seconds} label="sec" />
              </div>
            </div>
          )}

          {isScheduled && drop.startTime && (!countdown || countdown.total <= 0) && (
            <div className="mb-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1" suppressHydrationWarning>
                {drop.startTime.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
              <p className="text-sm font-bold text-foreground" suppressHydrationWarning>
                {drop.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          )}

          {/* Stock bar — live only */}
          {isLive && stockPercent !== null && (
            <div className="mb-1">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Stock</span>
                <span className={`text-xs font-bold ${stockPercent <= 20 ? 'text-[#f59e0b]' : 'text-muted-foreground'}`}>
                  {availableStock} / {drop.totalStock} left
                </span>
              </div>
              <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${stockPercent}%`,
                    backgroundColor: stockPercent <= 20 ? '#f59e0b' : '#f0f0f0',
                  }}
                />
              </div>
            </div>
          )}

          {isSoldOut && (
            <div className="flex items-center justify-center py-2 border border-white/8 rounded-sm">
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Sold Out</span>
            </div>
          )}
        </div>
      </article>
    </Link>
  )
}
