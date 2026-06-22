import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth'
import { query } from '@/lib/db'

export default async function AdminPage() {
  const session = await auth()

  if (!session?.user || session.user.role !== 'admin') {
    redirect('/')
  }

  // Get platform statistics
  const statsResult = await query(`
    SELECT
      (SELECT COUNT(*) FROM users) as total_users,
      (SELECT COUNT(*) FROM users WHERE role = 'seller') as total_sellers,
      (SELECT COUNT(*) FROM drops) as total_drops,
      (SELECT COUNT(*) FROM drops WHERE status = 'live') as live_drops,
      (SELECT COUNT(*) FROM orders) as total_orders,
      (SELECT SUM(total_amount) FROM orders WHERE status IN ('reserved', 'paid', 'confirmed')) as platform_gmv
  `)

  const stats = statsResult.rows[0] || {}

  // Get all drops
  const dropsResult = await query(`
    SELECT
      d.id, d.title, d.price, d.total_stock, d.status,
      u.name as seller_name, sp.store_name,
      COUNT(o.id) as order_count,
      SUM(CASE WHEN o.status IN ('reserved', 'paid', 'confirmed') THEN o.total_amount ELSE 0 END) as revenue
    FROM drops d
    JOIN users u ON d.seller_id = u.id
    LEFT JOIN seller_profiles sp ON u.id = sp.user_id
    LEFT JOIN orders o ON d.id = o.drop_id
    GROUP BY d.id, d.title, d.price, d.total_stock, d.status, u.name, sp.store_name
    ORDER BY d.created_at DESC
    LIMIT 50
  `)

  const drops = dropsResult.rows

  // Get recent orders
  const ordersResult = await query(`
    SELECT
      o.id, o.quantity, o.total_amount, o.status, o.reserved_at,
      u.email as buyer_email,
      d.title as drop_title,
      s.name as seller_name
    FROM orders o
    JOIN users u ON o.buyer_id = u.id
    JOIN drops d ON o.drop_id = d.id
    JOIN users s ON d.seller_id = s.id
    ORDER BY o.reserved_at DESC
    LIMIT 50
  `)

  const orders = ordersResult.rows

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800'
      case 'scheduled':
        return 'bg-blue-100 text-blue-800'
      case 'live':
        return 'bg-green-100 text-green-800'
      case 'sold_out':
        return 'bg-red-100 text-red-800'
      case 'ended':
        return 'bg-gray-100 text-gray-800'
      case 'reserved':
        return 'bg-yellow-100 text-yellow-800'
      case 'paid':
        return 'bg-blue-100 text-blue-800'
      case 'confirmed':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const platformGMV = parseInt(stats.platform_gmv || 0)

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

        {/* Platform Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg p-6">
            <div className="text-sm text-gray-600">Total Users</div>
            <div className="text-3xl font-bold">{parseInt(stats.total_users || 0)}</div>
          </div>
          <div className="bg-white rounded-lg p-6">
            <div className="text-sm text-gray-600">Total Sellers</div>
            <div className="text-3xl font-bold">{parseInt(stats.total_sellers || 0)}</div>
          </div>
          <div className="bg-white rounded-lg p-6">
            <div className="text-sm text-gray-600">Platform GMV</div>
            <div className="text-3xl font-bold">${(platformGMV / 100).toFixed(2)}</div>
          </div>
          <div className="bg-white rounded-lg p-6">
            <div className="text-sm text-gray-600">Total Drops</div>
            <div className="text-3xl font-bold">{parseInt(stats.total_drops || 0)}</div>
          </div>
          <div className="bg-white rounded-lg p-6">
            <div className="text-sm text-gray-600">Live Drops</div>
            <div className="text-3xl font-bold">{parseInt(stats.live_drops || 0)}</div>
          </div>
          <div className="bg-white rounded-lg p-6">
            <div className="text-sm text-gray-600">Total Orders</div>
            <div className="text-3xl font-bold">{parseInt(stats.total_orders || 0)}</div>
          </div>
        </div>

        {/* Drops Table */}
        <div className="bg-white rounded-lg overflow-hidden mb-8">
          <div className="px-6 py-4 border-b">
            <h2 className="text-xl font-semibold">All Drops</h2>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Title</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Seller</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Price</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Revenue</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Orders</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {drops.map((drop) => (
                <tr key={drop.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium">{drop.title}</td>
                  <td className="px-6 py-4 text-sm">{drop.store_name || drop.seller_name}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(drop.status)}`}>
                      {drop.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">${(drop.price / 100).toFixed(2)}</td>
                  <td className="px-6 py-4 font-semibold">${((drop.revenue || 0) / 100).toFixed(2)}</td>
                  <td className="px-6 py-4">{drop.order_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Drop</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Buyer</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Amount</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-mono text-xs">{order.id.slice(0, 8)}</td>
                  <td className="px-6 py-4 text-sm">{order.drop_title}</td>
                  <td className="px-6 py-4 text-sm">{order.buyer_email}</td>
                  <td className="px-6 py-4 font-semibold">${(order.total_amount / 100).toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {new Date(order.reserved_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
