import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth/auth'
import { query } from '@/lib/db'
import { Nav } from '@/components/layout/nav'

export const metadata = { title: 'My Orders — DropDeck' }

const statusStyles: Record<string, string> = {
  reserved:  'bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/40',
  paid:      'bg-[#6366f1]/20 text-[#6366f1] border border-[#6366f1]/40',
  confirmed: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40',
  expired:   'bg-white/5 text-white/40 border border-white/10',
  refunded:  'bg-red-500/20 text-red-400 border border-red-500/40',
}

export default async function OrdersPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')

  const result = await query(
    `SELECT o.id, o.drop_id, o.quantity, o.total_amount, o.status, o.reserved_at,
            d.title as drop_title, u.name as seller_name
     FROM orders o
     JOIN drops d ON o.drop_id = d.id
     JOIN users u ON d.seller_id = u.id
     WHERE o.buyer_id = $1
     ORDER BY o.reserved_at DESC`,
    [session.user.id],
  )

  const orders = result.rows

  return (
    <>
      <Nav />
      <main className="min-h-screen bg-background pt-24 pb-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-black text-foreground mb-10">My Orders</h1>

          {orders.length === 0 ? (
            <div className="bg-card border border-white/8 rounded-xl p-16 text-center">
              <p className="text-muted-foreground mb-6">You haven&apos;t placed any orders yet</p>
              <Link href="/" className="inline-block bg-[#6366f1] hover:bg-[#6366f1]/90 text-white font-semibold px-6 py-3 rounded-xl transition-colors">
                Browse Drops
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order: any) => (
                <div key={order.id} className="bg-card border border-white/8 rounded-xl p-6 flex items-center justify-between gap-6 hover:border-[#6366f1]/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg text-foreground truncate">{order.drop_title}</h3>
                    <p className="text-sm text-muted-foreground">by {order.seller_name}</p>
                    <p className="text-xs text-muted-foreground mt-1" suppressHydrationWarning>
                      {new Date(order.reserved_at).toLocaleDateString()} at {new Date(order.reserved_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-2xl font-black text-foreground">${(order.total_amount / 100).toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground">Qty: {order.quantity}</p>
                  </div>

                  <span className={`shrink-0 px-4 py-2 rounded-lg text-xs font-semibold ${statusStyles[order.status] || statusStyles.expired}`}>
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  )
}
