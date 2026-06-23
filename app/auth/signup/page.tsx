'use client'

import { useState, useEffect, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { slugify } from '@/lib/utils'

function SignUpForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialRole = searchParams.get('role') === 'seller' ? 'seller' : 'buyer'

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    role: initialRole as 'buyer' | 'seller',
    storeName: '',
    storeSlug: '',
  })
  const [slugTouched, setSlugTouched] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    setFormData((p) => ({ ...p, role: initialRole }))
  }, [initialRole])

  const handle = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((p) => {
      const next = { ...p, [name]: value }
      if (name === 'storeName' && !slugTouched) {
        next.storeSlug = slugify(value)
      }
      if (name === 'storeSlug') {
        setSlugTouched(true)
        next.storeSlug = slugify(value)
      }
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    if (!formData.email || !formData.password || !formData.name) {
      setError('Please fill in all fields')
      setIsLoading(false)
      return
    }
    if (formData.role === 'seller' && !formData.storeName.trim()) {
      setError('Store name is required for seller accounts')
      setIsLoading(false)
      return
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters')
      setIsLoading(false)
      return
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      setIsLoading(false)
      return
    }

    try {
      const payload: Record<string, string> = {
        email: formData.email,
        password: formData.password,
        name: formData.name,
        role: formData.role,
      }
      if (formData.role === 'seller') {
        payload.storeName = formData.storeName.trim()
        payload.storeSlug = formData.storeSlug.trim() || slugify(formData.storeName)
      }

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Registration failed')
        setIsLoading(false)
        return
      }

      const signInResult = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false,
      })

      if (signInResult?.ok) {
        router.push(formData.role === 'seller' ? '/seller/dashboard' : '/')
        router.refresh()
      } else {
        router.push('/auth/signin')
      }
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const inputClass =
    'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#6366f1] transition-colors'
  const labelClass = 'block text-sm font-medium text-muted-foreground mb-2'

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-10">
        <Link
          href="/"
          className="text-3xl font-black tracking-tighter bg-gradient-to-r from-[#6366f1] to-[#f59e0b] bg-clip-text text-transparent"
        >
          DropDeck
        </Link>
        <h1 className="text-2xl font-bold text-foreground mt-6 mb-2">Create your account</h1>
        <p className="text-muted-foreground">Join the flash drop platform</p>
      </div>

      <div className="bg-card border border-white/8 rounded-2xl p-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="name" className={labelClass}>
              Full Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handle}
              placeholder="Jordan Smith"
              required
              disabled={isLoading}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="email" className={labelClass}>
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handle}
              placeholder="you@example.com"
              required
              disabled={isLoading}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="role" className={labelClass}>
              Account Type
            </label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handle}
              disabled={isLoading}
              className={inputClass}
            >
              <option value="buyer">Buyer — discover and buy drops</option>
              <option value="seller">Seller — create and run drops</option>
            </select>
          </div>

          {formData.role === 'seller' && (
            <>
              <div>
                <label htmlFor="storeName" className={labelClass}>
                  Store Name
                </label>
                <input
                  id="storeName"
                  name="storeName"
                  type="text"
                  value={formData.storeName}
                  onChange={handle}
                  placeholder="Maya Prints"
                  required
                  disabled={isLoading}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="storeSlug" className={labelClass}>
                  Store URL
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground shrink-0">dropdeck.com/</span>
                  <input
                    id="storeSlug"
                    name="storeSlug"
                    type="text"
                    value={formData.storeSlug}
                    onChange={handle}
                    placeholder="maya-prints"
                    required
                    disabled={isLoading}
                    className={inputClass}
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label htmlFor="password" className={labelClass}>
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handle}
              placeholder="Min. 8 characters"
              required
              disabled={isLoading}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className={labelClass}>
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handle}
              placeholder="••••••••"
              required
              disabled={isLoading}
              className={inputClass}
            />
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#6366f1] hover:bg-[#6366f1]/90 text-white font-semibold py-3 rounded-xl"
          >
            {isLoading ? 'Creating account...' : 'Create Account'}
          </Button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/auth/signin" className="text-[#6366f1] hover:text-[#6366f1]/80 font-medium">
          Sign in
        </Link>
      </p>
    </div>
  )
}

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <Suspense fallback={<div className="text-muted-foreground">Loading...</div>}>
        <SignUpForm />
      </Suspense>
    </div>
  )
}
