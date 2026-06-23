'use client'

import { Button } from '@/components/ui/button'

export function SignOutButton() {
  const handleSignOut = () => {
    const form = document.createElement('form')
    form.method = 'post'
    form.action = '/api/auth/signout'
    document.body.appendChild(form)
    form.submit()
  }

  return (
    <Button variant="outline" size="sm" onClick={handleSignOut} className="border-white/20 hover:border-red-500/50 hover:text-red-400 transition-colors">
      Sign Out
    </Button>
  )
}
