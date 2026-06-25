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
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">
        <Link
          href="/"
          className="text-xl md:text-2xl font-black tracking-tighter text-primary"
        >
          DropDeck
        </Link>

        <nav className="flex items-center gap-1 md:gap-2">
          {user ? (
            <>
              {user.role === 'seller' && (
                <>
                  <Link href="/seller/dashboard">
                    <Button variant="ghost" size="sm" className="text-xs md:text-sm">Dashboard</Button>
                  </Link>
                  <Link href="/seller/drops/new" className="hidden sm:inline">
                    <Button variant="ghost" size="sm">New Drop</Button>
                  </Link>
                </>
              )}
              {user.role === 'admin' && (
                <Link href="/admin">
                  <Button variant="ghost" size="sm" className="text-xs md:text-sm">Admin</Button>
                </Link>
              )}
              {user.role === 'buyer' && (
                <Link href="/orders">
                  <Button variant="ghost" size="sm" className="text-xs md:text-sm">My Orders</Button>
                </Link>
              )}
              <span className="text-xs md:text-sm text-muted-foreground px-2 hidden md:block">
                {user.name || user.email}
              </span>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link href="/auth/signin">
                <Button variant="ghost" size="sm" className="text-xs md:text-sm">Sign In</Button>
              </Link>
              <Link href="/auth/signup">
                <Button size="sm" className="bg-primary hover:bg-primary/90 text-white text-xs md:text-sm">
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
