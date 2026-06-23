'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { scheduleDraftAuthenticated, publishDropAuthenticated } from '@/lib/actions/drops'
import { Button } from '@/components/ui/button'
import { Nav } from '@/components/layout/nav'
import type { Drop } from '@/lib/types'

export function PublishDraftForm({ drop }: { drop: Drop }) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const start = drop.startTime
  const end = drop.endTime

  const [form, setForm] = useState({
    startDate: start ? start.toISOString().slice(0, 10) : '',
    startTime: start ? start.toTimeString().slice(0, 5) : '10:00',
    endDate: end ? end.toISOString().slice(0, 10) : '',
    endTime: end ? end.toTimeString().slice(0, 5) : '22:00',
  })

  const inputClass =
    'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-[#6366f1]'
  const labelClass = 'block text-sm font-medium text-muted-foreground mb-2'

  const handlePublish = async () => {
    setError('')
    setIsLoading(true)
    try {
      const startTime = new Date(`${form.startDate}T${form.startTime}`)
      const endTime = form.endDate ? new Date(`${form.endDate}T${form.endTime}`) : undefined

      if (isNaN(startTime.getTime())) {
        throw new Error('Invalid start date')
      }
      if (endTime && (isNaN(endTime.getTime()) || endTime <= startTime)) {
        throw new Error('End time must be after start time')
      }

      await scheduleDraftAuthenticated(drop.id, startTime, endTime)
      await publishDropAuthenticated(drop.id)
      router.push('/seller/dashboard')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Nav />
      <main className="min-h-screen bg-background pt-24 pb-16 px-6">
        <div className="max-w-lg mx-auto">
          <Link href="/seller/dashboard" className="text-sm text-muted-foreground hover:text-foreground mb-6 inline-block">
            ← Back to dashboard
          </Link>

          <h1 className="text-3xl font-black text-foreground mb-2">Schedule & Publish</h1>
          <p className="text-muted-foreground mb-8">
            Set launch times for <span className="text-foreground font-semibold">{drop.title}</span>
          </p>

          <div className="bg-card border border-white/8 rounded-2xl p-8 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Start Date</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Start Time</label>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm((p) => ({ ...p, startTime: e.target.value }))}
                  className={inputClass}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>End Date</label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>End Time</label>
                <input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm((p) => ({ ...p, endTime: e.target.value }))}
                  className={inputClass}
                />
              </div>
            </div>

            {error && (
              <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                {error}
              </p>
            )}

            <Button
              onClick={handlePublish}
              disabled={isLoading}
              className="w-full bg-[#6366f1] hover:bg-[#6366f1]/90 text-white font-semibold py-3"
            >
              {isLoading ? 'Publishing...' : 'Publish Drop'}
            </Button>
          </div>
        </div>
      </main>
    </>
  )
}
