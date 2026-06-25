'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { SignOutButton } from '@/components/auth/sign-out-button'
import { Button } from '@/components/ui/button'

export function Nav() {
  const { data: session } = useSession()
  const user = session?.user as any

  return (
    <header className="fixed w-full top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
        <Link href="/" className="text-base font-black uppercase tracking-[0.12em] text-foreground">
          DropDeck
        </Link>

        <nav className="flex items-center gap-1 md:gap-2">
          {user ? (
            <>
              {user.role === 'seller' && (
                <>
                  <Link href="/seller/dashboard">
                    <Button variant="ghost" size="sm" className="text-xs uppercase tracking-wide font-bold text-muted-foreground hover:text-foreground">Dashboard</Button>
                  </Link>
                  <Link href="/seller/drops/new" className="hidden sm:inline-flex">
                    <Button size="sm" className="text-xs uppercase tracking-wide font-bold bg-foreground text-background hover:bg-foreground/90 rounded-sm px-4">
                      + New Drop
                    </Button>
                  </Link>
                </>
              )}
              {user.role === 'admin' && (
                <Link href="/admin">
                  <Button variant="ghost" size="sm" className="text-xs uppercase tracking-wide font-bold text-muted-foreground hover:text-foreground">Admin</Button>
                </Link>
              )}
              {user.role === 'buyer' && (
                <Link href="/orders">
                  <Button variant="ghost" size="sm" className="text-xs uppercase tracking-wide font-bold text-muted-foreground hover:text-foreground">Orders</Button>
                </Link>
              )}
              <span className="text-xs text-muted-foreground px-2 hidden md:block truncate max-w-[140px]">
                {user.name || user.email}
              </span>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link href="/auth/signin">
                <Button variant="ghost" size="sm" className="text-xs uppercase tracking-wide font-bold text-muted-foreground hover:text-foreground">Sign In</Button>
              </Link>
              <Link href="/auth/signup">
                <Button size="sm" className="text-xs uppercase tracking-wide font-bold bg-foreground text-background hover:bg-foreground/90 rounded-sm px-4">
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
