'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { SignOutButton } from '@/components/auth/sign-out-button'
import { Button } from '@/components/ui/button'

export function Nav() {
  const { data: session } = useSession()
  const user = session?.user as any

  return (
    <header className="fixed w-full top-0 z-50 bg-background/80 backdrop-blur-md border-b border-white/8">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link
          href="/"
          className="text-2xl font-black tracking-tighter bg-gradient-to-r from-[#6366f1] to-[#f59e0b] bg-clip-text text-transparent"
        >
          DropDeck
        </Link>

        <nav className="flex items-center gap-2">
          {user ? (
            <>
              {user.role === 'seller' && (
                <>
                  <Link href="/seller/dashboard">
                    <Button variant="ghost" size="sm">Dashboard</Button>
                  </Link>
                  <Link href="/seller/drops/new">
                    <Button variant="ghost" size="sm">New Drop</Button>
                  </Link>
                </>
              )}
              {user.role === 'admin' && (
                <Link href="/admin">
                  <Button variant="ghost" size="sm">Admin</Button>
                </Link>
              )}
              {user.role === 'buyer' && (
                <Link href="/orders">
                  <Button variant="ghost" size="sm">My Orders</Button>
                </Link>
              )}
              <span className="text-sm text-muted-foreground px-2 hidden md:block">
                {user.name || user.email}
              </span>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link href="/auth/signin">
                <Button variant="ghost" size="sm">Sign In</Button>
              </Link>
              <Link href="/auth/signup">
                <Button size="sm" className="bg-[#6366f1] hover:bg-[#6366f1]/90 text-white">
                  Sign Up
                </Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
