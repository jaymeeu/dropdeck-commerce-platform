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
      <section className="pt-24 pb-16 px-4 md:px-6 md:pt-32 md:pb-20 relative overflow-hidden">
        {/* Background glow effect */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
        
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-block mb-4 md:mb-6 px-4 py-2 rounded-full border border-primary/20 bg-primary/5">
            <span className="text-xs md:text-sm font-medium text-primary">Limited Releases • Zero Oversell Guarantee</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tight mb-6 leading-tight text-foreground">
            Exclusive Flash Drops
          </h1>
          
          <p className="text-base md:text-xl text-muted-foreground mb-8 md:mb-12 max-w-2xl mx-auto leading-relaxed px-2">
            Discover limited-edition releases from your favorite brands. Buy with confidence—our zero-oversell guarantee means no double-selling, ever.
          </p>
          
          <div className="flex flex-col gap-3 md:gap-4 justify-center max-w-sm md:max-w-none mx-auto">
            <Link href="#live-drops" className="w-full md:w-auto">
              <Button size="lg" className="w-full md:w-auto bg-primary hover:bg-primary/90 text-white md:px-8">
                Shop Now
              </Button>
            </Link>
            <Link href="/auth/signup?role=seller" className="w-full md:w-auto">
              <Button size="lg" variant="outline" className="w-full md:w-auto md:px-8">
                Become a Seller
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Live Drops - Featured */}
      <section id="live-drops" className="py-16 md:py-24 px-4 md:px-6 bg-background">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8 md:mb-12">
            <h2 className="text-3xl md:text-4xl font-black text-foreground">Live Now</h2>
            <div className="h-1 w-8 md:w-12 bg-primary rounded-full mt-2" />
          </div>
          
          {liveDrops.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
                {liveDrops.map((drop) => (
                  <DropCard key={drop.id} drop={drop} availableStock={drop.availableStock} />
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-16 md:py-20 border border-border/30 rounded-xl">
              <p className="text-base md:text-lg text-muted-foreground">No live drops at the moment. Check back soon!</p>
            </div>
          )}
        </div>
      </section>

      {/* Upcoming Drops */}
      <section className="py-16 md:py-24 px-4 md:px-6 bg-card/30">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8 md:mb-12">
            <h2 className="text-3xl md:text-4xl font-black text-foreground">Coming Soon</h2>
            <div className="h-1 w-8 md:w-12 bg-primary rounded-full mt-2" />
          </div>
          
          {scheduledDrops.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
              {scheduledDrops.map((drop) => (
                <DropCard key={drop.id} drop={drop} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 md:py-20 border border-border/30 rounded-xl">
              <p className="text-base md:text-lg text-muted-foreground">No upcoming drops scheduled yet.</p>
            </div>
          )}
        </div>
      </section>

      {/* Sold Out */}
      {soldOutDrops.length > 0 && (
        <section className="py-16 md:py-24 px-4 md:px-6 bg-background">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8 md:mb-12">
              <h2 className="text-3xl md:text-4xl font-black text-foreground">Recently Sold Out</h2>
              <div className="h-1 w-8 md:w-12 bg-muted rounded-full mt-2" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
              {soldOutDrops.map((drop) => (
                <DropCard key={drop.id} drop={drop} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="bg-card/50 border-t border-border py-8 md:py-12 px-4 md:px-6 mt-16 md:mt-24">
        <div className="max-w-7xl mx-auto text-center text-sm md:text-base text-muted-foreground">
          <p>&copy; 2024 DropDeck. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
