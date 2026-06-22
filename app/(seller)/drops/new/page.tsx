'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/use-auth'
import { createDrop } from '@/lib/actions/drops'
import { Button } from '@/components/ui/button'

export default function CreateDropPage() {
  const router = useRouter()
  const { user } = useAuth()

  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    imageUrls: [''],
    totalStock: '',
    maxPerBuyer: 1,
    startTime: '',
    startTimeHour: '10',
    startTimeMinute: '00',
    endTime: '',
    endTimeHour: '10',
    endTimeMinute: '00',
  })

  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleImageUrlChange = (index: number, value: string) => {
    const newUrls = [...formData.imageUrls]
    newUrls[index] = value
    setFormData((prev) => ({
      ...prev,
      imageUrls: newUrls,
    }))
  }

  const handleAddImageUrl = () => {
    setFormData((prev) => ({
      ...prev,
      imageUrls: [...prev.imageUrls, ''],
    }))
  }

  const handleRemoveImageUrl = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      imageUrls: prev.imageUrls.filter((_, i) => i !== index),
    }))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')

    if (!user || user.role !== 'seller') {
      setError('Only sellers can create drops')
      return
    }

    // Validate required fields
    if (!formData.title || !formData.price || !formData.totalStock || !formData.startTime) {
      setError('Please fill in all required fields')
      return
    }

    setIsLoading(true)

    try {
      // Parse dates
      const startDate = new Date(formData.startTime)
      startDate.setHours(parseInt(formData.startTimeHour), parseInt(formData.startTimeMinute))

      let endDate: Date | undefined
      if (formData.endTime) {
        endDate = new Date(formData.endTime)
        endDate.setHours(parseInt(formData.endTimeHour), parseInt(formData.endTimeMinute))
      }

      const drop = await createDrop(user.id, {
        title: formData.title,
        description: formData.description,
        imageUrls: formData.imageUrls.filter((url) => url.trim()),
        price: Math.round(parseFloat(formData.price) * 100), // Convert to cents
        totalStock: parseInt(formData.totalStock),
        startTime: startDate,
        endTime: endDate,
        maxPerBuyer: parseInt(String(formData.maxPerBuyer)),
      })

      router.push(`/seller/drops/${drop.id}/analytics`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create drop'
      setError(message)
      console.error('[v0] Error creating drop:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-3xl font-bold mb-2">Create a New Drop</h1>
        <p className="text-gray-600 mb-8">Set up your flash sale with limited inventory</p>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg p-8">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}

          {/* Step 1: Basic Info */}
          <div className="space-y-6 mb-8">
            <div>
              <label className="block text-sm font-medium mb-2">Drop Title *</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="Limited Edition Sneakers"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Tell buyers about this drop..."
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Price (USD) *</label>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleChange}
                  placeholder="99.99"
                  step="0.01"
                  min="0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isLoading}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Total Stock *</label>
                <input
                  type="number"
                  name="totalStock"
                  value={formData.totalStock}
                  onChange={handleChange}
                  placeholder="100"
                  min="1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Max Per Buyer</label>
              <select
                name="maxPerBuyer"
                value={formData.maxPerBuyer}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
              >
                {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
                  <option key={num} value={num}>
                    {num} {num === 1 ? 'unit' : 'units'}
                  </option>
                ))}
              </select>
            </div>

            {/* Image URLs */}
            <div>
              <label className="block text-sm font-medium mb-2">Product Images</label>
              <div className="space-y-2">
                {formData.imageUrls.map((url, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => handleImageUrlChange(i, e.target.value)}
                      placeholder="https://example.com/image.jpg"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={isLoading}
                    />
                    {formData.imageUrls.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveImageUrl(i)}
                        className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                        disabled={isLoading}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={handleAddImageUrl}
                className="mt-2 text-blue-600 hover:underline text-sm"
                disabled={isLoading}
              >
                Add another image
              </button>
            </div>

            {/* Start Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Start Date *</label>
                <input
                  type="date"
                  name="startTime"
                  value={formData.startTime}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isLoading}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Start Time</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    name="startTimeHour"
                    value={formData.startTimeHour}
                    onChange={handleChange}
                    min="0"
                    max="23"
                    className="w-16 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isLoading}
                  />
                  <span className="flex items-center">:</span>
                  <input
                    type="number"
                    name="startTimeMinute"
                    value={formData.startTimeMinute}
                    onChange={handleChange}
                    min="0"
                    max="59"
                    className="w-16 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isLoading}
                  />
                </div>
              </div>
            </div>

            {/* End Time (Optional) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">End Date (Optional)</label>
                <input
                  type="date"
                  name="endTime"
                  value={formData.endTime}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isLoading}
                />
              </div>
              {formData.endTime && (
                <div>
                  <label className="block text-sm font-medium mb-2">End Time</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      name="endTimeHour"
                      value={formData.endTimeHour}
                      onChange={handleChange}
                      min="0"
                      max="23"
                      className="w-16 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={isLoading}
                    />
                    <span className="flex items-center">:</span>
                    <input
                      type="number"
                      name="endTimeMinute"
                      value={formData.endTimeMinute}
                      onChange={handleChange}
                      min="0"
                      max="59"
                      className="w-16 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={isLoading}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-4">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Drop'}
            </Button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              disabled={isLoading}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
