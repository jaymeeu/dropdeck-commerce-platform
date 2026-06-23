import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth/auth'
import { getSellerDrops, getAvailableStock } from '@/lib/actions/drops'
import { getOrCreateSellerProfile } from '@/lib/actions/users'
import { query } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Nav } from '@/components/layout/nav'
import { DashboardAutoRefresh } from '@/components/seller/dashboard-auto-refresh'

export const metadata = { title: 'Seller Dashboard — DropDeck' }

export default async function SellerDashboardPage() {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'seller') redirect('/auth/signin')

  await getOrCreateSellerProfile(session.user.id!)

  const drops = await getSellerDrops(session.user.id!)

  const dropsWithStats = await Promise.all(
    drops.map(async (drop) => {
      const availableStock = await getAvailableStock(drop.id)
      const res = await query(
        `SELECT
          COUNT(*) as total_orders,
          COALESCE(SUM(CASE WHEN status IN ('reserved','paid','confirmed') THEN quantity ELSE 0 END),0) as units_sold,
          COALESCE(SUM(CASE WHEN status IN ('reserved','paid','confirmed') THEN total_amount ELSE 0 END),0) as revenue
         FROM orders WHERE drop_id = $1`,
        [drop.id],
      )
      const s = res.rows[0] || {}
      return {
        ...drop,
        availableStock,
        totalOrders: parseInt(s.total_orders || 0),
        unitsSold: parseInt(s.units_sold || 0),
        revenue: parseInt(s.revenue || 0),
      }
    }),
  )

  const totalRevenue = dropsWithStats.reduce((s, d) => s + d.revenue, 0)
  const totalUnitsSold = dropsWithStats.reduce((s, d) => s + d.unitsSold, 0)
  const liveCount = dropsWithStats.filter((d) => d.status === 'live').length

  const statusStyles: Record<string, string> = {
    draft:     'bg-white/5 text-white/50 border border-white/10',
    scheduled: 'bg-[#6366f1]/20 text-[#6366f1] border border-[#6366f1]/40',
    live:      'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40',
    sold_out:  'bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/40',
    ended:     'bg-white/5 text-white/40 border border-white/10',
  }

  return (
    <>
      <DashboardAutoRefresh />
      <Nav />
      <main className="min-h-screen bg-background pt-24 pb-16 px-6">
        <div className="max-w-7xl mx-auto">

          {/* Header */}
          <div className="flex items-center justify-between mb-10">
            <div>
              <h1 className="text-4xl font-black text-foreground">Seller Dashboard</h1>
              <p className="text-muted-foreground mt-1">Manage your drops and track performance</p>
            </div>
            <Link href="/seller/drops/new">
              <Button className="bg-[#6366f1] hover:bg-[#6366f1]/90 text-white font-semibold px-6">
                + New Drop
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            {[
              { label: 'Total Revenue', value: `$${(totalRevenue / 100).toFixed(2)}` },
              { label: 'Units Sold', value: totalUnitsSold },
              { label: 'Live Drops', value: liveCount },
              { label: 'Total Drops', value: dropsWithStats.length },
            ].map((stat) => (
              <div key={stat.label} className="bg-card border border-white/8 rounded-xl p-6">
                <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                <p className="text-3xl font-black text-foreground">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Drops Table */}
          <div className="bg-card border border-white/8 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/8">
              <h2 className="text-lg font-bold text-foreground">Your Drops</h2>
            </div>
            {dropsWithStats.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <p className="text-muted-foreground mb-4">No drops yet.</p>
                <Link href="/seller/drops/new">
                  <Button className="bg-[#6366f1] hover:bg-[#6366f1]/90 text-white">
                    Create your first drop
                  </Button>
                </Link>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/8">
                    {['Drop', 'Status', 'Stock Progress', 'Revenue', 'Orders', 'Actions'].map((h) => (
                      <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {dropsWithStats.map((drop) => (
                    <tr key={drop.id} className="hover:bg-white/2 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-foreground">{drop.title}</p>
                        <p className="text-sm text-muted-foreground">${(drop.price / 100).toFixed(2)} · {drop.totalStock} units</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-3 py-1 rounded-lg text-xs font-semibold ${statusStyles[drop.status] || statusStyles.ended}`}>
                          {drop.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-foreground mb-1">{drop.unitsSold} / {drop.totalStock}</p>
                        <div className="w-32 bg-white/10 rounded-full h-1.5">
                          <div
                            className="bg-[#6366f1] h-1.5 rounded-full transition-all"
                            style={{ width: `${Math.min((drop.unitsSold / drop.totalStock) * 100, 100)}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4 font-bold text-foreground">
                        ${(drop.revenue / 100).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-foreground">{drop.totalOrders}</td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          {drop.status === 'draft' ? (
                            <Link href={`/seller/drops/${drop.id}/publish`}>
                              <Button size="sm" className="bg-[#6366f1] hover:bg-[#6366f1]/90 text-white">
                                Publish
                              </Button>
                            </Link>
                          ) : (
                            <Link href={`/seller/drops/${drop.id}/analytics`}>
                              <Button variant="outline" size="sm" className="border-white/20 hover:border-[#6366f1]">
                                Analytics
                              </Button>
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </>
  )
}
