import { Metadata } from 'next'
import Link from 'next/link'
import { getLiveDrops, getScheduledDrops, getDropsByStatus } from '@/lib/actions/drops'
import { DropCard } from '@/components/drops/drop-card'
import { Nav } from '@/components/layout/nav'
import { Button } from '@/components/ui/button'

// Revalidate every 60 seconds so status transitions appear without a full redeploy
export const revalidate = 60

export const metadata: Metadata = {
  title: 'DropDeck - Buy Limited Releases',
  description: 'Discover and buy the hottest flash drops',
}

export default async function StorefrontPage() {
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
    // Database not initialized - show empty state
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 relative overflow-hidden">
        {/* Background glow effect */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
        
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-block mb-6 px-4 py-2 rounded-full border border-primary/20 bg-primary/5">
            <span className="text-sm font-medium text-primary">Limited Releases • Zero Oversell Guarantee</span>
          </div>
          
          <h1 className="text-6xl md:text-7xl font-black tracking-tight mb-6 leading-tight">
            <span className="block mb-2">Exclusive</span>
            <span className="bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">Flash Drops</span>
          </h1>
          
          <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
            Discover limited-edition releases from your favorite brands. Buy with confidence—our zero-oversell guarantee means no double-selling, ever.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="#live-drops">
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-white px-8">
                Shop Now
              </Button>
            </Link>
            <Link href="/auth/signup?role=seller">
              <Button size="lg" variant="outline" className="px-8">
                Become a Seller
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Live Drops - Featured */}
      <section id="live-drops" className="py-24 px-6 bg-background">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-baseline gap-4 mb-12">
            <h2 className="text-4xl font-black">Live Now</h2>
            <div className="h-1 w-12 bg-gradient-to-r from-accent to-primary rounded-full" />
          </div>
          
          {liveDrops.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {liveDrops.map((drop) => (
                  <DropCard key={drop.id} drop={drop} availableStock={drop.availableStock} />
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-20 border border-border/30 rounded-xl">
              <p className="text-lg text-muted-foreground">No live drops at the moment. Check back soon!</p>
            </div>
          )}
        </div>
      </section>

      {/* Upcoming Drops */}
      <section className="py-24 px-6 bg-card/30">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-baseline gap-4 mb-12">
            <h2 className="text-4xl font-black">Coming Soon</h2>
            <div className="h-1 w-12 bg-gradient-to-r from-primary to-accent rounded-full" />
          </div>
          
          {scheduledDrops.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {scheduledDrops.map((drop) => (
                <DropCard key={drop.id} drop={drop} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 border border-border/30 rounded-xl">
              <p className="text-lg text-muted-foreground">No upcoming drops scheduled yet.</p>
            </div>
          )}
        </div>
      </section>

      {/* Sold Out */}
      {soldOutDrops.length > 0 && (
        <section className="py-24 px-6 bg-background">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-baseline gap-4 mb-12">
              <h2 className="text-4xl font-black">Recently Sold Out</h2>
              <div className="h-1 w-12 bg-muted rounded-full" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {soldOutDrops.map((drop) => (
                <DropCard key={drop.id} drop={drop} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="bg-card/50 border-t border-border py-12 px-6 mt-24">
        <div className="max-w-7xl mx-auto text-center text-muted-foreground">
          <p>&copy; 2024 DropDeck. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
