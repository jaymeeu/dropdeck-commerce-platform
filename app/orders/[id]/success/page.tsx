import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth/auth'
import { getOrder } from '@/lib/actions/checkout'
import { query } from '@/lib/db'
import { Nav } from '@/components/layout/nav'
import { Button } from '@/components/ui/button'

export const metadata = { title: 'Order Confirmed — DropDeck' }

export default async function OrderSuccessPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')

  const order = await getOrder(id)
  if (!order || order.buyerId !== session.user.id) redirect('/orders')

  if (!['paid', 'confirmed'].includes(order.status)) {
    if (order.status === 'reserved') redirect(`/orders/${id}/pay`)
    redirect('/orders')
  }

  const dropRes = await query(`SELECT title FROM drops WHERE id = $1`, [order.dropId])
  const dropTitle = dropRes.rows[0]?.title || 'Your order'

  return (
    <>
      <Nav />
      <main className="min-h-screen bg-background pt-24 pb-16 px-6">
        <div className="max-w-lg mx-auto text-center">
          <div className="bg-card border border-emerald-500/30 rounded-2xl p-10 space-y-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center text-3xl">
              ✓
            </div>
            <div>
              <h1 className="text-3xl font-black text-foreground mb-2">Order confirmed</h1>
              <p className="text-muted-foreground">
                Your purchase of <span className="text-foreground font-semibold">{dropTitle}</span> is confirmed.
              </p>
            </div>
            <div className="bg-background/50 border border-white/8 rounded-xl p-5 text-left space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Order ID</span>
                <span className="font-mono text-foreground text-xs">{order.id.slice(0, 8)}…</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Quantity</span>
                <span className="text-foreground">{order.quantity}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total paid</span>
                <span className="text-foreground font-bold">${(order.totalAmount / 100).toFixed(2)}</span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/orders">
                <Button variant="outline" className="border-white/20 w-full sm:w-auto">
                  View all orders
                </Button>
              </Link>
              <Link href="/">
                <Button className="bg-[#6366f1] hover:bg-[#6366f1]/90 w-full sm:w-auto">
                  Continue shopping
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
