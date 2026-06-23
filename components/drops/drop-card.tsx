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
      ? 'bg-red-100 text-red-800'
      : isLive
        ? 'bg-green-100 text-green-800'
        : isSoldOut
          ? 'bg-gray-100 text-gray-800'
          : isScheduled
            ? 'bg-blue-100 text-blue-800'
            : 'bg-gray-100 text-gray-800'

  const price = drop.price / 100 // Convert cents to dollars

  return (
    <Link href={`/drops/${drop.id}`}>
      <div className="bg-white rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow cursor-pointer">
        {/* Image */}
        <div className="relative h-48 bg-gray-200 overflow-hidden">
          {drop.imageUrls[0] ? (
            <img
              src={drop.imageUrls[0]}
              alt={drop.title}
              className="w-full h-full object-cover hover:scale-105 transition-transform"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              No image
            </div>
          )}

          {/* Status Badge */}
          <div className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-semibold ${statusColor}`}>
            {timeText}
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="font-semibold text-lg mb-1 line-clamp-2">{drop.title}</h3>

          <p className="text-sm text-gray-600 mb-3 line-clamp-2">{drop.description || 'Limited edition drop'}</p>

          {/* Price */}
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold">${price.toFixed(2)}</div>
            {isScheduled && drop.startTime && (
              <div className="text-xs text-gray-500">
                {drop.startTime.toLocaleDateString()} {drop.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
