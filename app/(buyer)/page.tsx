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

  // Fetch drops in parallel
  const [liveDrops, scheduledDrops, soldOutDrops] = await Promise.all([
    getLiveDrops(12),
    getScheduledDrops(12),
    getDropsByStatus('sold_out', 6),
  ])

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
                  form.method = 'POST'
                  form.action = '/api/auth/signout'
                  document.body.appendChild(form)
                  form.submit()
                }}>
                  <Button variant="ghost">Sign Out</Button>
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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-12">
        {/* Live Now Section */}
        {liveDrops.length > 0 && (
          <section className="mb-16">
            <h2 className="text-3xl font-bold mb-8 flex items-center gap-2">
              <span className="inline-flex h-3 w-3 rounded-full bg-red-500 animate-pulse" />
              Live Now
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {liveDrops.map((drop) => (
                <DropCard key={drop.id} drop={drop} availableStock={drop.totalStock} />
              ))}
            </div>
          </section>
        )}

        {/* Dropping Soon Section */}
        {scheduledDrops.length > 0 && (
          <section className="mb-16">
            <h2 className="text-3xl font-bold mb-8">Dropping Soon</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {scheduledDrops.map((drop) => (
                <DropCard key={drop.id} drop={drop} />
              ))}
            </div>
          </section>
        )}

        {/* Recently Sold Out Section */}
        {soldOutDrops.length > 0 && (
          <section>
            <h2 className="text-3xl font-bold mb-8">Recently Sold Out</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {soldOutDrops.map((drop) => (
                <DropCard key={drop.id} drop={drop} />
              ))}
            </div>
          </section>
        )}

        {liveDrops.length === 0 && scheduledDrops.length === 0 && (
          <div className="text-center py-16">
            <h2 className="text-2xl font-bold mb-4">No drops available yet</h2>
            <p className="text-gray-600 mb-8">Check back soon for upcoming drops!</p>
          </div>
        )}
      </main>
    </div>
  )
}
