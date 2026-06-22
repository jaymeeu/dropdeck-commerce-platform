import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth'
import { getDrop } from '@/lib/actions/drops'
import { query } from '@/lib/db'

interface AnalyticsPageProps {
  params: {
    id: string
  }
}

export default async function AnalyticsPage({ params }: AnalyticsPageProps) {
  const session = await auth()

  if (!session?.user || session.user.role !== 'seller') {
    redirect('/')
  }

  // Get drop
  const drop = await getDrop(params.id)

  if (!drop || drop.sellerId !== session.user.id) {
    redirect('/seller/dashboard')
  }

  // Get order statistics
  const orderResult = await query(
    `SELECT 
      COUNT(*) as total_orders,
      SUM(CASE WHEN status IN ('reserved', 'paid', 'confirmed') THEN quantity ELSE 0 END) as units_sold,
      SUM(CASE WHEN status IN ('reserved', 'paid', 'confirmed') THEN total_amount ELSE 0 END) as total_revenue,
      SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END) as paid_revenue
     FROM orders
     WHERE drop_id = $1`,
    [drop.id],
  )

  const stats = orderResult.rows[0] || {}

  const totalOrders = parseInt(stats.total_orders || 0)
  const unitsSold = parseInt(stats.units_sold || 0)
  const totalRevenue = parseInt(stats.total_revenue || 0)
  const paidRevenue = parseInt(stats.paid_revenue || 0)

  // Get detailed orders
  const ordersResult = await query(
    `SELECT 
      o.id, o.buyer_id, o.quantity, o.unit_price, o.total_amount, o.status, o.reserved_at,
      u.email
     FROM orders o
     JOIN users u ON o.buyer_id = u.id
     WHERE o.drop_id = $1
     ORDER BY o.reserved_at DESC
     LIMIT 100`,
    [drop.id],
  )

  const orders = ordersResult.rows

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

  const price = drop.price / 100
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders / 100 : 0

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{drop.title} - Analytics</h1>
          <p className="text-gray-600">Price: ${price.toFixed(2)} | Stock: {drop.totalStock}</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg p-6">
            <div className="text-sm text-gray-600">Total Revenue</div>
            <div className="text-3xl font-bold">${(totalRevenue / 100).toFixed(2)}</div>
            <div className="text-xs text-gray-500 mt-1">Confirmed: ${(paidRevenue / 100).toFixed(2)}</div>
          </div>
          <div className="bg-white rounded-lg p-6">
            <div className="text-sm text-gray-600">Units Sold</div>
            <div className="text-3xl font-bold">{unitsSold}</div>
            <div className="text-xs text-gray-500 mt-1">of {drop.totalStock} ({((unitsSold / drop.totalStock) * 100).toFixed(1)}%)</div>
          </div>
          <div className="bg-white rounded-lg p-6">
            <div className="text-sm text-gray-600">Total Orders</div>
            <div className="text-3xl font-bold">{totalOrders}</div>
          </div>
          <div className="bg-white rounded-lg p-6">
            <div className="text-sm text-gray-600">Avg. Order Value</div>
            <div className="text-3xl font-bold">${avgOrderValue.toFixed(2)}</div>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h2 className="text-xl font-semibold">Recent Orders</h2>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Order ID</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Buyer Email</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Qty</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Amount</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No orders yet
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-mono text-xs">{order.id.slice(0, 8)}</td>
                    <td className="px-6 py-4 text-sm">{order.email}</td>
                    <td className="px-6 py-4">{order.quantity}</td>
                    <td className="px-6 py-4 font-semibold">${(order.total_amount / 100).toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(order.reserved_at).toLocaleDateString()} {new Date(order.reserved_at).toLocaleTimeString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Export CSV Button */}
        <div className="mt-8">
          <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Export Orders as CSV
          </button>
        </div>
      </div>
    </div>
  )
}
