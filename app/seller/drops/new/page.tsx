'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { createDrop } from '@/lib/actions/drops'
import { Button } from '@/components/ui/button'
import { Nav } from '@/components/layout/nav'

export default function CreateDropPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [step, setStep] = useState(1)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    imageUrls: [''],
    totalStock: '',
    maxPerBuyer: '1',
    startDate: '',
    startTime: '10:00',
    endDate: '',
    endTime: '22:00',
  })

  const user = session?.user as any

  const handle = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData((p) => ({ ...p, [e.target.name]: e.target.value }))
  }

  const handleImageUrl = (i: number, v: string) => {
    const urls = [...formData.imageUrls]
    urls[i] = v
    setFormData((p) => ({ ...p, imageUrls: urls }))
  }

  const handleSubmit = async () => {
    setError('')
    setIsLoading(true)
    try {
      const startTime = new Date(`${formData.startDate}T${formData.startTime}`)
      const endTime = new Date(`${formData.endDate}T${formData.endTime}`)

      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        setError('Please enter valid start and end dates.')
        setIsLoading(false)
        return
      }
      if (endTime <= startTime) {
        setError('End time must be after start time.')
        setIsLoading(false)
        return
      }

      const drop = await createDrop({
        sellerId: user?.id,
        title: formData.title,
        description: formData.description,
        price: Math.round(parseFloat(formData.price) * 100),
        imageUrls: formData.imageUrls.filter(Boolean),
        totalStock: parseInt(formData.totalStock),
        maxPerBuyer: parseInt(formData.maxPerBuyer),
        startTime,
        endTime,
      })

      router.push('/seller/dashboard')
    } catch (err: any) {
      setError(err.message || 'Failed to create drop')
    } finally {
      setIsLoading(false)
    }
  }

  const inputClass = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#6366f1] transition-colors'
  const labelClass = 'block text-sm font-medium text-muted-foreground mb-2'

  const steps = ['Basic Info', 'Pricing & Stock', 'Schedule']

  return (
    <>
      <Nav />
      <main className="min-h-screen bg-background pt-24 pb-16 px-6">
        <div className="max-w-2xl mx-auto">

          <div className="mb-10">
            <h1 className="text-4xl font-black text-foreground">Create a Drop</h1>
            <p className="text-muted-foreground mt-1">Set up your limited-edition release</p>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center gap-2 mb-10">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <button
                  onClick={() => i + 1 < step && setStep(i + 1)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    step === i + 1
                      ? 'bg-[#6366f1] text-white'
                      : step > i + 1
                      ? 'bg-[#6366f1]/20 text-[#6366f1]'
                      : 'bg-white/5 text-muted-foreground'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-xs">
                    {i + 1}
                  </span>
                  {s}
                </button>
                {i < steps.length - 1 && <div className="w-8 h-px bg-white/10" />}
              </div>
            ))}
          </div>

          <div className="bg-card border border-white/8 rounded-2xl p-8">

            {/* Step 1 */}
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <label className={labelClass}>Drop Title *</label>
                  <input name="title" value={formData.title} onChange={handle} placeholder="e.g. Air Jordan 1 Retro High OG" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Description *</label>
                  <textarea name="description" value={formData.description} onChange={handle as any} rows={4} placeholder="Describe your drop..." className={inputClass + ' resize-none'} />
                </div>
                <div>
                  <label className={labelClass}>Image URLs</label>
                  {formData.imageUrls.map((url, i) => (
                    <div key={i} className="flex gap-2 mb-2">
                      <input
                        value={url}
                        onChange={(e) => handleImageUrl(i, e.target.value)}
                        placeholder="https://..."
                        className={inputClass}
                      />
                      {formData.imageUrls.length > 1 && (
                        <button
                          onClick={() => setFormData((p) => ({ ...p, imageUrls: p.imageUrls.filter((_, j) => j !== i) }))}
                          className="px-3 py-2 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors text-sm"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => setFormData((p) => ({ ...p, imageUrls: [...p.imageUrls, ''] }))}
                    className="text-sm text-[#6366f1] hover:text-[#6366f1]/80 transition-colors mt-1"
                  >
                    + Add another image
                  </button>
                </div>
                <Button
                  onClick={() => {
                    if (!formData.title || !formData.description) { setError('Title and description are required.'); return }
                    setError('')
                    setStep(2)
                  }}
                  className="w-full bg-[#6366f1] hover:bg-[#6366f1]/90 text-white font-semibold py-3"
                >
                  Continue
                </Button>
              </div>
            )}

            {/* Step 2 */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Price (USD) *</label>
                    <input name="price" type="number" min="0" step="0.01" value={formData.price} onChange={handle} placeholder="29.99" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Total Stock *</label>
                    <input name="totalStock" type="number" min="1" value={formData.totalStock} onChange={handle} placeholder="100" className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Max Units Per Buyer *</label>
                  <select name="maxPerBuyer" value={formData.maxPerBuyer} onChange={handle} className={inputClass}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-2">Limit how many units a single buyer can purchase</p>
                </div>
                <div className="flex gap-3">
                  <Button onClick={() => setStep(1)} variant="outline" className="flex-1 border-white/20">
                    Back
                  </Button>
                  <Button
                    onClick={() => {
                      if (!formData.price || !formData.totalStock) { setError('Price and stock are required.'); return }
                      setError('')
                      setStep(3)
                    }}
                    className="flex-1 bg-[#6366f1] hover:bg-[#6366f1]/90 text-white font-semibold"
                  >
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3 */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Start Date *</label>
                    <input name="startDate" type="date" value={formData.startDate} onChange={handle} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Start Time *</label>
                    <input name="startTime" type="time" value={formData.startTime} onChange={handle} className={inputClass} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>End Date *</label>
                    <input name="endDate" type="date" value={formData.endDate} onChange={handle} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>End Time *</label>
                    <input name="endTime" type="time" value={formData.endTime} onChange={handle} className={inputClass} />
                  </div>
                </div>

                {/* Summary */}
                <div className="bg-white/3 border border-white/8 rounded-xl p-5 space-y-2 text-sm">
                  <p className="font-semibold text-foreground mb-3">Drop Summary</p>
                  <div className="flex justify-between"><span className="text-muted-foreground">Title</span><span className="text-foreground font-medium">{formData.title}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Price</span><span className="text-foreground font-medium">${formData.price}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Stock</span><span className="text-foreground font-medium">{formData.totalStock} units</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Max per buyer</span><span className="text-foreground font-medium">{formData.maxPerBuyer}</span></div>
                </div>

                {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>}

                <div className="flex gap-3">
                  <Button onClick={() => setStep(2)} variant="outline" className="flex-1 border-white/20">
                    Back
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={isLoading}
                    className="flex-1 bg-[#6366f1] hover:bg-[#6366f1]/90 text-white font-semibold"
                  >
                    {isLoading ? 'Creating...' : 'Launch Drop'}
                  </Button>
                </div>
              </div>
            )}

            {error && step !== 3 && (
              <p className="text-red-400 text-sm mt-4 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>
            )}
          </div>
        </div>
      </main>
    </>
  )
}
