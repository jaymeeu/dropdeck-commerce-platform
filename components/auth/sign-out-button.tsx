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
    <Button variant="outline" onClick={handleSignOut}>
      Sign Out
    </Button>
  )
}
