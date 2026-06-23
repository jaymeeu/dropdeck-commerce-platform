import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth/auth'
import { getOrder } from '@/lib/actions/checkout'
import { query } from '@/lib/db'
import { Nav } from '@/components/layout/nav'
import { PaymentForm } from '@/components/orders/payment-form'

export const metadata = { title: 'Pay for Order — DropDeck' }

export default async function OrderPayPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')

  const order = await getOrder(id)
  if (!order || order.buyerId !== session.user.id) redirect('/orders')

  if (order.status === 'confirmed' || order.status === 'paid') {
    redirect(`/orders/${id}/success`)
  }

  if (order.status !== 'reserved') {
    redirect('/orders')
  }

  if (new Date(order.expiresAt) <= new Date()) {
    redirect('/orders')
  }

  const dropRes = await query(`SELECT title FROM drops WHERE id = $1`, [order.dropId])
  const dropTitle = dropRes.rows[0]?.title || 'Your order'

  return (
    <>
      <Nav />
      <main className="min-h-screen bg-background pt-24 pb-16 px-6">
        <div className="max-w-lg mx-auto">
          <Link href="/orders" className="text-sm text-muted-foreground hover:text-foreground mb-6 inline-block">
            ← Back to orders
          </Link>
          <PaymentForm
            orderId={order.id}
            dropTitle={dropTitle}
            amount={order.totalAmount}
            quantity={order.quantity}
            expiresAt={order.expiresAt.toISOString()}
          />
        </div>
      </main>
    </>
  )
}
