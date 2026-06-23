import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth/auth'
import { query } from '@/lib/db'
import { syncDropLifecycle } from '@/lib/drop-lifecycle'
import { Nav } from '@/components/layout/nav'

export const metadata = { title: 'Admin — DropDeck' }

const statusStyles: Record<string, string> = {
  draft:     'bg-white/5 text-white/50 border border-white/10',
  scheduled: 'bg-[#6366f1]/20 text-[#6366f1] border border-[#6366f1]/40',
  live:      'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40',
  sold_out:  'bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/40',
  ended:     'bg-white/5 text-white/40 border border-white/10',
}

const outcomeStyles: Record<string, string> = {
  success:         'text-emerald-400',
  sold_out:        'text-amber-400',
  limit_exceeded:  'text-[#6366f1]',
  not_live:        'text-muted-foreground',
  error:           'text-red-400',
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const session = await auth()
  if (!session?.user || (session.user as { role?: string }).role !== 'admin') redirect('/')

  const { view } = await searchParams
  const activeOnly = view === 'active'

  await syncDropLifecycle()

  const statsRes = await query(`
    SELECT
      (SELECT COUNT(*) FROM users) as total_users,
      (SELECT COUNT(*) FROM users WHERE role = 'seller') as total_sellers,
      (SELECT COUNT(*) FROM users WHERE role = 'buyer') as total_buyers,
      (SELECT COUNT(*) FROM drops) as total_drops,
      (SELECT COUNT(*) FROM drops WHERE status = 'live') as live_drops,
      (SELECT COUNT(*) FROM drops WHERE status IN ('live', 'scheduled')) as active_drops,
      (SELECT COUNT(*) FROM orders) as total_orders,
      (SELECT COALESCE(SUM(total_amount),0) FROM orders WHERE status IN ('reserved','paid','confirmed')) as platform_gmv
  `)
  const stats = statsRes.rows[0] || {}

  const checkoutRes = await query(`
    SELECT outcome,
           COUNT(*)::int AS count,
           ROUND(AVG(latency_ms))::int AS avg_latency_ms,
           ROUND(MAX(latency_ms))::int AS max_latency_ms
    FROM checkout_log
    WHERE attempted_at > NOW() - INTERVAL '24 hours'
    GROUP BY outcome
    ORDER BY count DESC
  `)

  const checkoutTotalRes = await query(`
    SELECT COUNT(*)::int AS total_attempts
    FROM checkout_log
    WHERE attempted_at > NOW() - INTERVAL '24 hours'
  `)
  const checkoutAttempts24h = checkoutTotalRes.rows[0]?.total_attempts ?? 0

  const dropsRes = await query(
    activeOnly
      ? `SELECT d.id, d.title, d.price, d.total_stock, d.status, d.start_time,
                u.name as seller_name,
                COUNT(o.id) as order_count,
                COALESCE(SUM(CASE WHEN o.status IN ('reserved','paid','confirmed') THEN o.total_amount ELSE 0 END),0) as revenue
         FROM drops d
         JOIN users u ON d.seller_id = u.id
         LEFT JOIN orders o ON d.id = o.drop_id
         WHERE d.status IN ('live', 'scheduled')
         GROUP BY d.id, d.title, d.price, d.total_stock, d.status, d.start_time, u.name
         ORDER BY d.start_time ASC
         LIMIT 50`
      : `SELECT d.id, d.title, d.price, d.total_stock, d.status, d.start_time,
                u.name as seller_name,
                COUNT(o.id) as order_count,
                COALESCE(SUM(CASE WHEN o.status IN ('reserved','paid','confirmed') THEN o.total_amount ELSE 0 END),0) as revenue
         FROM drops d
         JOIN users u ON d.seller_id = u.id
         LEFT JOIN orders o ON d.id = o.drop_id
         GROUP BY d.id, d.title, d.price, d.total_stock, d.status, d.start_time, u.name
         ORDER BY d.created_at DESC
         LIMIT 50`,
  )

  const ordersRes = await query(`
    SELECT o.id, o.quantity, o.total_amount, o.status, o.reserved_at,
           u.email as buyer_email, d.title as drop_title
    FROM orders o
    JOIN users u ON o.buyer_id = u.id
    JOIN drops d ON o.drop_id = d.id
    ORDER BY o.reserved_at DESC
    LIMIT 20
  `)

  const statCards = [
    { label: 'Platform GMV', value: `$${(parseInt(stats.platform_gmv || 0) / 100).toFixed(2)}` },
    { label: 'Checkout Attempts (24h)', value: checkoutAttempts24h },
    { label: 'Active Drops', value: stats.active_drops },
    { label: 'Live Drops', value: stats.live_drops },
    { label: 'Total Orders', value: stats.total_orders },
    { label: 'Total Users', value: stats.total_users },
    { label: 'Sellers', value: stats.total_sellers },
    { label: 'Buyers', value: stats.total_buyers },
  ]

  const filterLink = (v: string, label: string) => (
    <Link
      href={v === 'all' ? '/admin' : `/admin?view=${v}`}
      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
        (v === 'active' ? activeOnly : !activeOnly)
          ? 'bg-[#6366f1] text-white'
          : 'bg-white/5 text-muted-foreground hover:text-foreground'
      }`}
    >
      {label}
    </Link>
  )

  return (
    <>
      <Nav />
      <main className="min-h-screen bg-background pt-24 pb-16 px-6">
        <div className="max-w-7xl mx-auto">

          <div className="mb-10">
            <h1 className="text-4xl font-black text-foreground">Admin Panel</h1>
            <p className="text-muted-foreground mt-1">Platform-wide visibility and health monitoring</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            {statCards.map((s) => (
              <div key={s.label} className="bg-card border border-white/8 rounded-xl p-6">
                <p className="text-sm text-muted-foreground mb-1">{s.label}</p>
                <p className="text-3xl font-black text-foreground">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Checkout health (24h) */}
          <div className="bg-card border border-white/8 rounded-xl overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-white/8">
              <h2 className="text-lg font-bold text-foreground">Checkout Health (24h)</h2>
            </div>
            {checkoutRes.rows.length === 0 ? (
              <div className="px-6 py-10 text-center text-muted-foreground">No checkout attempts in the last 24 hours</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/8">
                    {['Outcome', 'Count', 'Avg Latency', 'Max Latency'].map((h) => (
                      <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {checkoutRes.rows.map((row: { outcome: string; count: number; avg_latency_ms: number; max_latency_ms: number }) => (
                    <tr key={row.outcome}>
                      <td className={`px-6 py-4 font-semibold capitalize ${outcomeStyles[row.outcome] || 'text-foreground'}`}>
                        {row.outcome.replace('_', ' ')}
                      </td>
                      <td className="px-6 py-4 text-foreground">{row.count}</td>
                      <td className="px-6 py-4 text-muted-foreground">{row.avg_latency_ms ?? '—'}ms</td>
                      <td className="px-6 py-4 text-muted-foreground">{row.max_latency_ms ?? '—'}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Drops */}
          <div className="bg-card border border-white/8 rounded-xl overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-white/8 flex items-center justify-between gap-4">
              <h2 className="text-lg font-bold text-foreground">
                {activeOnly ? 'Active Drops' : 'All Drops'}
              </h2>
              <div className="flex gap-2">
                {filterLink('all', 'All')}
                {filterLink('active', 'Active only')}
              </div>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/8">
                  {['Drop', 'Seller', 'Status', 'Revenue', 'Orders'].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {dropsRes.rows.map((d: { id: string; title: string; price: number; total_stock: number; status: string; seller_name: string; revenue: string; order_count: string }) => (
                  <tr key={d.id} className="hover:bg-white/2 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-foreground">{d.title}</p>
                      <p className="text-sm text-muted-foreground">${(d.price / 100).toFixed(2)} · {d.total_stock} units</p>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{d.seller_name}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-3 py-1 rounded-lg text-xs font-semibold ${statusStyles[d.status] || statusStyles.ended}`}>
                        {d.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-foreground">${(parseInt(d.revenue) / 100).toFixed(2)}</td>
                    <td className="px-6 py-4 text-foreground">{d.order_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Recent Orders */}
          <div className="bg-card border border-white/8 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/8">
              <h2 className="text-lg font-bold text-foreground">Recent Orders</h2>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/8">
                  {['Drop', 'Buyer', 'Amount', 'Status', 'Time'].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {ordersRes.rows.map((o: { id: string; drop_title: string; buyer_email: string; total_amount: number; status: string; reserved_at: string }) => (
                  <tr key={o.id} className="hover:bg-white/2 transition-colors">
                    <td className="px-6 py-4 font-semibold text-foreground">{o.drop_title}</td>
                    <td className="px-6 py-4 text-muted-foreground">{o.buyer_email}</td>
                    <td className="px-6 py-4 font-bold text-foreground">${(o.total_amount / 100).toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-3 py-1 rounded-lg text-xs font-semibold ${statusStyles[o.status] || statusStyles.ended}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-sm">
                      {new Date(o.reserved_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      </main>
    </>
  )
}
