import { Metadata } from 'next'
import Link from 'next/link'
import { auth } from '@/lib/auth/auth'
import { getLiveDrops, getScheduledDrops, getDropsByStatus } from '@/lib/actions/drops'
import { DropCard } from '@/components/drops/drop-card'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'DropDeck - Buy Limited Releases',
  description: 'Discover and buy the hottest flash drops',
}

export default async function StorefrontPage() {
  const session = await auth()

  // Fetch drops in parallel - handle missing database gracefully
  let liveDrops = []
  let scheduledDrops = []
  let soldOutDrops = []

  try {
    ;[liveDrops, scheduledDrops, soldOutDrops] = await Promise.all([
      getLiveDrops(12),
      getScheduledDrops(12),
      getDropsByStatus('sold_out', 6),
    ])
  } catch (error) {
    console.log('[v0] Database not initialized yet. Showing empty state.')
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold">
            DropDeck
          </Link>

          <nav className="flex items-center gap-4">
            {session?.user ? (
              <>
                {session.user.role === 'seller' && (
                  <Link href="/seller/dashboard">
                    <Button variant="outline">Seller Dashboard</Button>
                  </Link>
                )}
                {session.user.role === 'admin' && (
                  <Link href="/admin">
                    <Button variant="outline">Admin</Button>
                  </Link>
                )}
                <Link href="/orders">
                  <Button variant="outline">My Orders</Button>
                </Link>
                <Link href="/api/auth/signout" onClick={(e) => {
                  e.preventDefault()
                  // Use form submission for signout
                  const form = document.createElement('form')
                  form.method = 'post'
                  form.action = '/api/auth/signout'
                  document.body.appendChild(form)
                  form.submit()
                }}>
                  <Button variant="outline">Sign Out</Button>
                </Link>
              </>
            ) : (
              <>
                <Link href="/auth/signin">
                  <Button variant="outline">Sign In</Button>
                </Link>
                <Link href="/auth/signup">
                  <Button>Sign Up</Button>
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-accent/10 to-transparent py-20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-4">Limited Edition Drops</h1>
          <p className="text-xl text-muted-foreground mb-8">
            Get exclusive access to flash sales with zero-oversell guarantee
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="#live-drops">
              <Button size="lg">Shop Now</Button>
            </Link>
            <Link href="/auth/signup?role=seller">
              <Button size="lg" variant="outline">
                Sell Your Drops
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Live Drops */}
      <section id="live-drops" className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold mb-8">Live Drops</h2>
          {liveDrops.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {liveDrops.map((drop) => (
                <DropCard key={drop.id} drop={drop} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No live drops at the moment. Check back soon!</p>
            </div>
          )}
        </div>
      </section>

      {/* Upcoming Drops */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold mb-8">Coming Soon</h2>
          {scheduledDrops.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {scheduledDrops.map((drop) => (
                <DropCard key={drop.id} drop={drop} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No upcoming drops scheduled yet.</p>
            </div>
          )}
        </div>
      </section>

      {/* Sold Out */}
      {soldOutDrops.length > 0 && (
        <section className="py-16 bg-background">
          <div className="max-w-7xl mx-auto px-4">
            <h2 className="text-3xl font-bold mb-8">Recently Sold Out</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {soldOutDrops.map((drop) => (
                <DropCard key={drop.id} drop={drop} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="bg-muted border-t py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2024 DropDeck. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
