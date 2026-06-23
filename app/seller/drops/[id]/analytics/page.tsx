import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth/auth'
import { getDrop, getAvailableStock } from '@/lib/actions/drops'
import { query } from '@/lib/db'
import { Nav } from '@/components/layout/nav'
import { Button } from '@/components/ui/button'

export const metadata = { title: 'Drop Analytics — DropDeck' }

const statusStyles: Record<string, string> = {
  reserved:  'bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/40',
  paid:      'bg-[#6366f1]/20 text-[#6366f1] border border-[#6366f1]/40',
  confirmed: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40',
  expired:   'bg-white/5 text-white/40 border border-white/10',
  refunded:  'bg-red-500/20 text-red-400 border border-red-500/40',
}

export default async function AnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user || (session.user as any).role !== 'seller') redirect('/')

  const drop = await getDrop(id)
  if (!drop || drop.sellerId !== session.user.id) redirect('/seller/dashboard')

  const availableStock = await getAvailableStock(id)

  const orderRes = await query(
    `SELECT
       COUNT(*) as total_orders,
       COALESCE(SUM(CASE WHEN status IN ('reserved','paid','confirmed') THEN quantity ELSE 0 END),0) as units_sold,
       COALESCE(SUM(CASE WHEN status IN ('reserved','paid','confirmed') THEN total_amount ELSE 0 END),0) as revenue,
       COALESCE(SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END),0) as expired_orders
     FROM orders WHERE drop_id = $1`,
    [id],
  )
  const orderStats = orderRes.rows[0] || {}

  const recentOrders = await query(
    `SELECT o.id, o.quantity, o.total_amount, o.status, o.reserved_at, u.email as buyer_email
     FROM orders o JOIN users u ON o.buyer_id = u.id
     WHERE o.drop_id = $1
     ORDER BY o.reserved_at DESC LIMIT 20`,
    [id],
  )

  const unitsSold = parseInt(orderStats.units_sold || 0)
  const revenue = parseInt(orderStats.revenue || 0)
  const sellThrough = drop.totalStock > 0 ? Math.round((unitsSold / drop.totalStock) * 100) : 0

  const statusDisplayStyles: Record<string, string> = {
    draft:     'bg-white/5 text-white/50 border border-white/10',
    scheduled: 'bg-[#6366f1]/20 text-[#6366f1] border border-[#6366f1]/40',
    live:      'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40',
    sold_out:  'bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/40',
    ended:     'bg-white/5 text-white/40 border border-white/10',
  }

  return (
    <>
      <Nav />
      <main className="min-h-screen bg-background pt-24 pb-16 px-6">
        <div className="max-w-5xl mx-auto">

          {/* Back + Header */}
          <div className="flex items-center gap-4 mb-10">
            <Link href="/seller/dashboard">
              <Button variant="outline" size="sm" className="border-white/20">
                &larr; Dashboard
              </Button>
            </Link>
            <div className="flex-1">
              <h1 className="text-3xl font-black text-foreground">{drop.title}</h1>
              <div className="flex items-center gap-3 mt-1">
                <span className={`inline-block px-3 py-1 rounded-lg text-xs font-semibold ${statusDisplayStyles[drop.status] || statusDisplayStyles.ended}`}>
                  {drop.status.replace('_', ' ')}
                </span>
                <span className="text-muted-foreground text-sm">
                  {drop.startTime ? new Date(drop.startTime).toLocaleDateString() : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            {[
              { label: 'Revenue', value: `$${(revenue / 100).toFixed(2)}` },
              { label: 'Units Sold', value: `${unitsSold} / ${drop.totalStock}` },
              { label: 'Remaining', value: availableStock },
              { label: 'Sell-Through', value: `${sellThrough}%` },
            ].map((s) => (
              <div key={s.label} className="bg-card border border-white/8 rounded-xl p-6">
                <p className="text-sm text-muted-foreground mb-1">{s.label}</p>
                <p className="text-3xl font-black text-foreground">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Sell-Through Progress */}
          <div className="bg-card border border-white/8 rounded-xl p-6 mb-8">
            <div className="flex justify-between text-sm mb-3">
              <span className="font-semibold text-foreground">Sell-Through Rate</span>
              <span className="text-muted-foreground">{unitsSold} of {drop.totalStock} units</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-[#6366f1] to-[#f59e0b] h-3 rounded-full transition-all"
                style={{ width: `${sellThrough}%` }}
              />
            </div>
          </div>

          {/* Recent Orders */}
          <div className="bg-card border border-white/8 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/8 flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Recent Orders</h2>
              <span className="text-sm text-muted-foreground">{orderStats.total_orders} total</span>
            </div>
            {recentOrders.rows.length === 0 ? (
              <div className="px-6 py-12 text-center text-muted-foreground">No orders yet</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/8">
                    {['Buyer', 'Qty', 'Amount', 'Status', 'Time'].map((h) => (
                      <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {recentOrders.rows.map((o: any) => (
                    <tr key={o.id} className="hover:bg-white/2 transition-colors">
                      <td className="px-6 py-4 text-muted-foreground text-sm">{o.buyer_email}</td>
                      <td className="px-6 py-4 text-foreground">{o.quantity}</td>
                      <td className="px-6 py-4 font-bold text-foreground">${(o.total_amount / 100).toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-3 py-1 rounded-lg text-xs font-semibold ${statusStyles[o.status] || statusStyles.expired}`}>
                          {o.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground text-sm" suppressHydrationWarning>
                        {new Date(o.reserved_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
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
