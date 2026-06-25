import { Metadata } from 'next'
import Link from 'next/link'
import { getLiveDrops, getScheduledDrops, getDropsByStatus } from '@/lib/actions/drops'
import { DropCard } from '@/components/drops/drop-card'
import { Nav } from '@/components/layout/nav'
import { Button } from '@/components/ui/button'

export const revalidate = 30

export const metadata: Metadata = {
  title: 'DropDeck — Limited Releases',
  description: 'Shop exclusive flash drops. Limited stock. Zero oversell guarantee.',
}

function SectionHeader({ label, count }: { label: string; count?: number }) {
  return (
    <div className="flex items-center justify-between mb-6 md:mb-8">
      <div className="flex items-center gap-4">
        <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-foreground">{label}</h2>
        {count != null && (
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground border border-border px-2 py-0.5 rounded-sm">
            {count}
          </span>
        )}
      </div>
      <div className="h-px flex-1 bg-border ml-6" />
    </div>
  )
}

export default async function StorefrontPage() {
  let liveDrops: Awaited<ReturnType<typeof getLiveDrops>> = []
  let scheduledDrops: Awaited<ReturnType<typeof getScheduledDrops>> = []
  let soldOutDrops: Awaited<ReturnType<typeof getDropsByStatus>> = []

  try {
    ;[liveDrops, scheduledDrops, soldOutDrops] = await Promise.all([
      getLiveDrops(12),
      getScheduledDrops(12),
      getDropsByStatus('sold_out', 6),
    ])
  } catch {
    // Database not yet initialized
  }

  const hasLive = liveDrops.length > 0
  const hasScheduled = scheduledDrops.length > 0

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />

      {/* Ticker bar */}
      <div className="border-b border-border bg-[#0d0d0d] overflow-hidden">
        <div className="flex items-center gap-0 animate-none">
          <div className="flex items-center gap-8 px-4 md:px-6 py-2.5 whitespace-nowrap text-xs font-medium uppercase tracking-widest text-muted-foreground">
            <span>Zero Oversell Guarantee</span>
            <span className="text-border">·</span>
            <span>Limited Releases Only</span>
            <span className="text-border">·</span>
            <span>{liveDrops.length} Drop{liveDrops.length !== 1 ? 's' : ''} Live Now</span>
            <span className="text-border">·</span>
            <span>{scheduledDrops.length} Coming Soon</span>
          </div>
        </div>
      </div>

      {/* Hero — only shown when there are live drops */}
      {hasLive ? (
        <section className="px-4 md:px-6 pt-10 pb-6 border-b border-border">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#22c55e] font-bold mb-2 flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22c55e]" />
                  </span>
                  Drops Are Live
                </p>
                <h1 className="text-5xl md:text-7xl lg:text-8xl font-black uppercase tracking-tighter leading-none text-foreground text-balance">
                  Drop<br className="md:hidden" />Deck
                </h1>
              </div>
              <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                Limited-edition releases. Every unit guaranteed. No double-selling, ever.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="px-4 md:px-6 pt-10 pb-6 border-b border-border">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black uppercase tracking-tighter leading-none text-foreground">
              DropDeck
            </h1>
            <div className="flex gap-3">
              <Link href="/auth/signup">
                <Button size="sm" className="bg-foreground text-background hover:bg-foreground/90 font-bold uppercase tracking-wide text-xs rounded-sm px-5">
                  Join Now
                </Button>
              </Link>
              <Link href="/auth/signup?role=seller">
                <Button size="sm" variant="outline" className="font-bold uppercase tracking-wide text-xs rounded-sm px-5 border-white/20">
                  Sell on DropDeck
                </Button>
              </Link>
            </div>
          </div>
        </section>
      )}

      <main className="max-w-7xl mx-auto px-4 md:px-6">

        {/* Live Drops */}
        <section id="live-drops" className="pt-10 md:pt-14 pb-10">
          <SectionHeader label="Live Now" count={liveDrops.length} />
          {hasLive ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              {liveDrops.map((drop) => (
                <DropCard key={drop.id} drop={drop} availableStock={drop.availableStock} />
              ))}
            </div>
          ) : (
            <div className="border border-border rounded-sm py-16 md:py-20 flex flex-col items-center gap-3">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">No Active Drops</p>
              <p className="text-muted-foreground/50 text-sm">Check back soon or see what&apos;s coming up below</p>
            </div>
          )}
        </section>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Upcoming Drops */}
        <section className="pt-10 md:pt-14 pb-10">
          <SectionHeader label="Coming Soon" count={scheduledDrops.length} />
          {hasScheduled ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              {scheduledDrops.map((drop) => (
                <DropCard key={drop.id} drop={drop} />
              ))}
            </div>
          ) : (
            <div className="border border-border rounded-sm py-16 md:py-20 flex flex-col items-center gap-3">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Nothing Scheduled</p>
              <p className="text-muted-foreground/50 text-sm">New drops are added regularly</p>
            </div>
          )}
        </section>

        {/* Sold Out */}
        {soldOutDrops.length > 0 && (
          <>
            <div className="border-t border-border" />
            <section className="pt-10 md:pt-14 pb-10">
              <SectionHeader label="Sold Out" count={soldOutDrops.length} />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 opacity-50">
                {soldOutDrops.map((drop) => (
                  <DropCard key={drop.id} drop={drop} />
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-8">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <span className="text-xs uppercase tracking-widest font-black text-foreground">DropDeck</span>
          <div className="flex items-center gap-6">
            <Link href="/auth/signup?role=seller" className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors font-medium">
              Become a Seller
            </Link>
            <Link href="/auth/signin" className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors font-medium">
              Sign In
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">&copy; 2024 DropDeck. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
