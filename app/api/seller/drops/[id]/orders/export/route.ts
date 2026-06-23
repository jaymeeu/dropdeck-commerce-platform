import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth'
import { getDrop } from '@/lib/actions/drops'
import { query } from '@/lib/db'

function escapeCsv(value: string | number | null | undefined): string {
  const str = String(value ?? '')
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const session = await auth()

  if (!session?.user?.id || (session.user as { role?: string }).role !== 'seller') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const drop = await getDrop(id)
  if (!drop || drop.sellerId !== session.user.id) {
    return NextResponse.json({ error: 'Drop not found' }, { status: 404 })
  }

  const result = await query(
    `SELECT o.id, u.email AS buyer_email, u.name AS buyer_name,
            o.quantity, o.unit_price, o.total_amount, o.status,
            o.reserved_at, o.paid_at, o.expires_at
     FROM orders o
     JOIN users u ON o.buyer_id = u.id
     WHERE o.drop_id = $1
     ORDER BY o.reserved_at DESC`,
    [id],
  )

  const headers = [
    'order_id',
    'buyer_email',
    'buyer_name',
    'quantity',
    'unit_price_cents',
    'total_amount_cents',
    'status',
    'reserved_at',
    'paid_at',
    'expires_at',
  ]

  const rows = result.rows.map((o) =>
    [
      o.id,
      o.buyer_email,
      o.buyer_name,
      o.quantity,
      o.unit_price,
      o.total_amount,
      o.status,
      o.reserved_at ? new Date(o.reserved_at).toISOString() : '',
      o.paid_at ? new Date(o.paid_at).toISOString() : '',
      o.expires_at ? new Date(o.expires_at).toISOString() : '',
    ]
      .map(escapeCsv)
      .join(','),
  )

  const csv = [headers.join(','), ...rows].join('\n')
  const filename = `${drop.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-orders.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
