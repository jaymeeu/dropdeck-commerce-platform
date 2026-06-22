import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth'
import { query } from '@/lib/db'

interface OrderWithDropInfo {
  id: string
  drop_id: string
  quantity: number
  total_amount: number
  status: string
  reserved_at: string
  drop_title: string
  seller_name: string
}

export default async function OrdersPage() {
  const session = await auth()

  if (!session?.user) {
    redirect('/auth/signin')
  }

  // Fetch user's orders with drop info
  const result = await query(
    `SELECT 
      o.id, o.drop_id, o.quantity, o.total_amount, o.status, 
      o.reserved_at, d.title as drop_title, u.name as seller_name
     FROM orders o
     JOIN drops d ON o.drop_id = d.id
     JOIN users u ON d.seller_id = u.id
     WHERE o.buyer_id = $1
     ORDER BY o.reserved_at DESC`,
    [session.user.id],
  )

  const orders = result.rows as OrderWithDropInfo[]

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'reserved':
        return 'bg-yellow-100 text-yellow-800'
      case 'paid':
        return 'bg-blue-100 text-blue-800'
      case 'confirmed':
        return 'bg-green-100 text-green-800'
      case 'expired':
        return 'bg-gray-100 text-gray-800'
      case 'refunded':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold mb-8">My Orders</h1>

        {orders.length === 0 ? (
          <div className="bg-white rounded-lg p-8 text-center">
            <p className="text-gray-600 mb-4">You haven&apos;t placed any orders yet</p>
            <a href="/" className="text-blue-600 hover:underline">
              Browse drops
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="bg-white rounded-lg p-6 flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1">{order.drop_title}</h3>
                  <p className="text-sm text-gray-600 mb-2">by {order.seller_name}</p>
                  <p className="text-sm text-gray-500">
                    Order ID: {order.id}
                  </p>
                  <p className="text-sm text-gray-500">
                    {new Date(order.reserved_at).toLocaleDateString()} at{' '}
                    {new Date(order.reserved_at).toLocaleTimeString()}
                  </p>
                </div>

                <div className="text-right mr-6">
                  <div className="text-2xl font-bold mb-2">
                    ${(order.total_amount / 100).toFixed(2)}
                  </div>
                  <p className="text-sm text-gray-600 mb-2">Qty: {order.quantity}</p>
                </div>

                <div className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${getStatusColor(order.status)}`}>
                  {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
