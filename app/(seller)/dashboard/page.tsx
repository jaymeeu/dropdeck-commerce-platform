import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth/auth'
import { getSellerDrops, getAvailableStock } from '@/lib/actions/drops'
import { query } from '@/lib/db'
import { Button } from '@/components/ui/button'

export default async function SellerDashboardPage() {
  const session = await auth()

  if (!session?.user || session.user.role !== 'seller') {
    redirect('/')
  }

  // Fetch seller's drops
  const drops = await getSellerDrops(session.user.id)

  // Calculate stats for each drop
  const dropsWithStats = await Promise.all(
    drops.map(async (drop) => {
      const availableStock = await getAvailableStock(drop.id)

      // Get order stats
      const orderResult = await query(
        `SELECT 
          COUNT(*) as total_orders,
          SUM(CASE WHEN status IN ('reserved', 'paid', 'confirmed') THEN quantity ELSE 0 END) as units_sold,
          SUM(CASE WHEN status IN ('reserved', 'paid', 'confirmed') THEN total_amount ELSE 0 END) as revenue
         FROM orders
         WHERE drop_id = $1`,
        [drop.id],
      )

      const stats = orderResult.rows[0] || {}

      return {
        ...drop,
        availableStock,
        totalOrders: parseInt(stats.total_orders || 0),
        unitsSold: parseInt(stats.units_sold || 0),
        revenue: parseInt(stats.revenue || 0),
      }
    }),
  )

  // Calculate platform totals
  const totalRevenue = dropsWithStats.reduce((sum, d) => sum + d.revenue, 0)
  const totalUnitsSold = dropsWithStats.reduce((sum, d) => sum + d.unitsSold, 0)
  const liveDrops = dropsWithStats.filter((d) => d.status === 'live').length

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
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Seller Dashboard</h1>
            <p className="text-gray-600 mt-2">Manage your drops and track sales</p>
          </div>
          <Link href="/seller/drops/new">
            <Button>Create New Drop</Button>
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg p-6">
            <div className="text-sm text-gray-600">Total Revenue</div>
            <div className="text-3xl font-bold">${(totalRevenue / 100).toFixed(2)}</div>
          </div>
          <div className="bg-white rounded-lg p-6">
            <div className="text-sm text-gray-600">Units Sold</div>
            <div className="text-3xl font-bold">{totalUnitsSold}</div>
          </div>
          <div className="bg-white rounded-lg p-6">
            <div className="text-sm text-gray-600">Live Drops</div>
            <div className="text-3xl font-bold">{liveDrops}</div>
          </div>
          <div className="bg-white rounded-lg p-6">
            <div className="text-sm text-gray-600">Total Drops</div>
            <div className="text-3xl font-bold">{dropsWithStats.length}</div>
          </div>
        </div>

        {/* Drops Table */}
        <div className="bg-white rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Drop Name</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Stock</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Revenue</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Orders</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {dropsWithStats.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No drops yet.{' '}
                    <Link href="/seller/drops/new" className="text-blue-600 hover:underline">
                      Create your first drop
                    </Link>
                  </td>
                </tr>
              ) : (
                dropsWithStats.map((drop) => (
                  <tr key={drop.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium">{drop.title}</div>
                      <div className="text-sm text-gray-500">
                        ${(drop.price / 100).toFixed(2)} × {drop.totalStock} units
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(drop.status)}`}>
                        {drop.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium">{drop.unitsSold}/{drop.totalStock}</div>
                        <div className="mt-1 w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{
                              width: `${(drop.unitsSold / drop.totalStock) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold">
                      ${(drop.revenue / 100).toFixed(2)}
                    </td>
                    <td className="px-6 py-4">{drop.totalOrders}</td>
                    <td className="px-6 py-4">
                      <Link href={`/seller/drops/${drop.id}/analytics`}>
                        <Button variant="outline" size="sm">
                          View
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
