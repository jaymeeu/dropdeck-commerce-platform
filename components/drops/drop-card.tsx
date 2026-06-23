'use client'

import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import type { DropWithSeller } from '@/lib/types'

interface DropCardProps {
  drop: DropWithSeller
  availableStock?: number
}

export function DropCard({ drop, availableStock }: DropCardProps) {
  const isLive = drop.status === 'live'
  const isSoldOut = drop.status === 'sold_out'
  const isScheduled = drop.status === 'scheduled'

  const timeText =
    isScheduled && drop.startTime
      ? `Drops in ${formatDistanceToNow(drop.startTime)}`
      : isSoldOut
        ? 'Sold Out'
        : isLive
          ? `${availableStock ?? 0} left`
          : drop.status

  const statusColor =
    isLive && availableStock && availableStock <= 5
      ? 'bg-accent/20 text-accent border border-accent/50'
      : isLive
        ? 'bg-primary/20 text-primary border border-primary/50'
        : isSoldOut
          ? 'bg-muted text-muted-foreground border border-border'
          : isScheduled
            ? 'bg-primary/10 text-primary border border-primary/30'
            : 'bg-muted text-muted-foreground border border-border'

  const price = drop.price / 100 // Convert cents to dollars

  return (
    <Link href={`/drops/${drop.id}`}>
      <div className="group bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 transition-all duration-300 cursor-pointer hover:shadow-lg hover:shadow-primary/10">
        {/* Image */}
        <div className="relative h-64 bg-muted overflow-hidden">
          {drop.imageUrls[0] ? (
            <img
              src={drop.imageUrls[0]}
              alt={drop.title}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <div className="text-4xl mb-2">📦</div>
                <p>No image</p>
              </div>
            </div>
          )}

          {/* Status Badge */}
          <div className={`absolute top-4 right-4 px-4 py-2 rounded-lg text-xs font-semibold ${statusColor} backdrop-blur-sm`}>
            {timeText}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <h3 className="font-bold text-lg mb-2 line-clamp-2 text-foreground group-hover:text-primary transition-colors">{drop.title}</h3>

          <p className="text-sm text-muted-foreground mb-4 line-clamp-2 h-10">{drop.description || 'Limited edition drop'}</p>

          {/* Price & Time */}
          <div className="flex items-end justify-between">
            <div className="text-3xl font-black text-primary">${price.toFixed(2)}</div>
            {isScheduled && drop.startTime && (
              <div className="text-xs text-muted-foreground text-right">
                <div>{drop.startTime.toLocaleDateString()}</div>
                <div className="font-semibold">{drop.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
