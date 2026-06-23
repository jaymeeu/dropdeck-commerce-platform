'use server'

import { revalidatePath } from 'next/cache'
import { query } from '../db'
import { syncDropLifecycle, ACTIVE_ORDER_STOCK_WHERE, getActiveUnitsSold } from '../drop-lifecycle'
import { requireRole } from '../auth/guards'
import type { Drop, DropWithSeller } from '../types'

export interface DropFormData {
  title: string
  description?: string
  imageUrls?: string[]
  price: number
  totalStock: number
  startTime?: Date
  endTime?: Date
  maxPerBuyer?: number
}

const DRAFT_PLACEHOLDER_START = () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)

/**
 * Get a drop by ID (syncs lifecycle so status/stock are current)
 */
export async function getDrop(dropId: string): Promise<Drop | null> {
  await syncDropLifecycle(dropId)

  const result = await query(
    `SELECT id, seller_id, title, description, image_urls, price, total_stock,
            start_time, end_time, status, max_per_buyer, created_at, updated_at
     FROM drops
     WHERE id = $1`,
    [dropId],
  )

  if (result.rows.length === 0) return null
  return mapDropRow(result.rows[0])
}

/**
 * Get drops by status (for storefront)
 */
export async function getDropsByStatus(status: string, limit = 20): Promise<Drop[]> {
  const result = await query(
    `SELECT id, seller_id, title, description, image_urls, price, total_stock,
            start_time, end_time, status, max_per_buyer, created_at, updated_at
     FROM drops
     WHERE status = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [status, limit],
  )

  return result.rows.map(mapDropRow)
}

/**
 * Get live drops sorted by stock urgency
 */
export async function getLiveDrops(limit = 20): Promise<DropWithSeller[]> {
  await syncDropLifecycle()

  const result = await query(
    `SELECT d.id, d.seller_id, d.title, d.description, d.image_urls, d.price, d.total_stock,
            d.start_time, d.end_time, d.status, d.max_per_buyer, d.created_at, d.updated_at,
            u.name, sp.store_name, sp.store_slug,
            d.total_stock - COALESCE((
              SELECT SUM(quantity) FROM orders o
              WHERE o.drop_id = d.id AND (${ACTIVE_ORDER_STOCK_WHERE})
            ), 0) AS available_stock
     FROM drops d
     JOIN users u ON d.seller_id = u.id
     LEFT JOIN seller_profiles sp ON u.id = sp.user_id
     WHERE d.status = 'live'
     ORDER BY available_stock ASC
     LIMIT $1`,
    [limit],
  )

  return result.rows.map((row) => ({
    ...mapDropRow(row),
    availableStock: Number(row.available_stock),
    seller: {
      name: row.name,
      storeName: row.store_name,
      storeSlug: row.store_slug,
    },
  }))
}

/**
 * Get scheduled drops sorted by start time
 */
export async function getScheduledDrops(limit = 20): Promise<DropWithSeller[]> {
  await syncDropLifecycle()

  const result = await query(
    `SELECT d.id, d.seller_id, d.title, d.description, d.image_urls, d.price, d.total_stock,
            d.start_time, d.end_time, d.status, d.max_per_buyer, d.created_at, d.updated_at,
            u.name, sp.store_name, sp.store_slug
     FROM drops d
     JOIN users u ON d.seller_id = u.id
     LEFT JOIN seller_profiles sp ON u.id = sp.user_id
     WHERE d.status = 'scheduled' AND d.start_time > NOW()
     ORDER BY d.start_time ASC
     LIMIT $1`,
    [limit],
  )

  return result.rows.map((row) => ({
    ...mapDropRow(row),
    seller: {
      name: row.name,
      storeName: row.store_name,
      storeSlug: row.store_slug,
    },
  }))
}

/**
 * Get drops by seller
 */
export async function getSellerDrops(sellerId: string): Promise<Drop[]> {
  const result = await query(
    `SELECT id, seller_id, title, description, image_urls, price, total_stock,
            start_time, end_time, status, max_per_buyer, created_at, updated_at
     FROM drops
     WHERE seller_id = $1
     ORDER BY created_at DESC`,
    [sellerId],
  )

  return result.rows.map(mapDropRow)
}

/**
 * Get available stock for a drop (accounting for active orders)
 */
export async function getAvailableStock(dropId: string): Promise<number> {
  await syncDropLifecycle(dropId)

  const dropResult = await query(
    `SELECT total_stock FROM drops WHERE id = $1`,
    [dropId],
  )

  if (dropResult.rows.length === 0) return 0

  const totalStock = dropResult.rows[0].total_stock
  const sold = await getActiveUnitsSold(dropId)
  return Math.max(0, totalStock - sold)
}

/**
 * Create a drop as the authenticated seller.
 */
export async function createDropAuthenticated(
  data: DropFormData,
  options: { asDraft?: boolean } = {},
): Promise<Drop> {
  const user = await requireRole('seller')
  return createDrop(user.id!, data, options)
}

/**
 * Publish a draft drop (seller must own it).
 */
export async function publishDropAuthenticated(dropId: string): Promise<Drop> {
  const user = await requireRole('seller')

  const drop = await getDrop(dropId)
  if (!drop || drop.sellerId !== user.id) {
    throw new Error('Drop not found or unauthorized')
  }
  if (drop.status !== 'draft') {
    throw new Error('Only draft drops can be published')
  }

  const placeholderCutoff = new Date(Date.now() + 300 * 24 * 60 * 60 * 1000)
  if (drop.startTime > placeholderCutoff) {
    throw new Error('Set a start date before publishing')
  }

  const result = await query(
    `UPDATE drops SET status = 'scheduled', updated_at = NOW()
     WHERE id = $1 AND seller_id = $2 AND status = 'draft'
     RETURNING id, seller_id, title, description, image_urls, price, total_stock, start_time, end_time, status, max_per_buyer, created_at, updated_at`,
    [dropId, user.id],
  )

  if (result.rows.length === 0) {
    throw new Error('Failed to publish drop')
  }

  revalidatePath('/')
  revalidatePath('/seller/dashboard')

  return mapDropRow(result.rows[0])
}

/**
 * Update schedule on a draft drop before publishing.
 */
export async function scheduleDraftAuthenticated(
  dropId: string,
  startTime: Date,
  endTime?: Date,
): Promise<Drop> {
  const user = await requireRole('seller')

  if (endTime && endTime <= startTime) {
    throw new Error('End time must be after start time')
  }

  const result = await query(
    `UPDATE drops
     SET start_time = $3, end_time = $4, updated_at = NOW()
     WHERE id = $1 AND seller_id = $2 AND status = 'draft'
     RETURNING id, seller_id, title, description, image_urls, price, total_stock, start_time, end_time, status, max_per_buyer, created_at, updated_at`,
    [dropId, user.id, startTime, endTime || null],
  )

  if (result.rows.length === 0) {
    throw new Error('Draft not found or unauthorized')
  }

  return mapDropRow(result.rows[0])
}

/**
 * Create a new drop (internal — use createDropAuthenticated from UI)
 */
export async function createDrop(
  sellerId: string,
  data: DropFormData,
  options: { asDraft?: boolean } = {},
): Promise<Drop> {
  const status = options.asDraft ? 'draft' : 'scheduled'
  const startTime = data.startTime ?? DRAFT_PLACEHOLDER_START()

  const result = await query(
    `INSERT INTO drops
     (seller_id, title, description, image_urls, price, total_stock, start_time, end_time, status, max_per_buyer)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, seller_id, title, description, image_urls, price, total_stock, start_time, end_time, status, max_per_buyer, created_at, updated_at`,
    [
      sellerId,
      data.title,
      data.description || null,
      data.imageUrls || [],
      data.price,
      data.totalStock,
      startTime,
      data.endTime || null,
      status,
      data.maxPerBuyer || 1,
    ],
  )

  const drop = mapDropRow(result.rows[0])

  revalidatePath('/')
  revalidatePath('/seller/dashboard')

  return drop
}

/**
 * Update drop details (seller action)
 */
export async function updateDrop(
  dropId: string,
  sellerId: string,
  data: Partial<{
    title: string
    description: string
    imageUrls: string[]
    price: number
    totalStock: number
    startTime: Date
    endTime: Date | null
    maxPerBuyer: number
  }>,
): Promise<Drop> {
  // Build dynamic update query
  const updates: string[] = []
  const values: unknown[] = [dropId, sellerId]
  let paramCount = 2

  if (data.title !== undefined) {
    paramCount++
    updates.push(`title = $${paramCount}`)
    values.push(data.title)
  }

  if (data.description !== undefined) {
    paramCount++
    updates.push(`description = $${paramCount}`)
    values.push(data.description)
  }

  if (data.imageUrls !== undefined) {
    paramCount++
    updates.push(`image_urls = $${paramCount}`)
    values.push(data.imageUrls)
  }

  if (data.price !== undefined) {
    paramCount++
    updates.push(`price = $${paramCount}`)
    values.push(data.price)
  }

  if (data.totalStock !== undefined) {
    paramCount++
    updates.push(`total_stock = $${paramCount}`)
    values.push(data.totalStock)
  }

  if (data.startTime !== undefined) {
    paramCount++
    updates.push(`start_time = $${paramCount}`)
    values.push(data.startTime)
  }

  if (data.endTime !== undefined) {
    paramCount++
    updates.push(`end_time = $${paramCount}`)
    values.push(data.endTime)
  }

  if (data.maxPerBuyer !== undefined) {
    paramCount++
    updates.push(`max_per_buyer = $${paramCount}`)
    values.push(data.maxPerBuyer)
  }

  updates.push('updated_at = NOW()')

  const result = await query(
    `UPDATE drops
     SET ${updates.join(', ')}
     WHERE id = $1 AND seller_id = $2
     RETURNING id, seller_id, title, description, image_urls, price, total_stock, start_time, end_time, status, max_per_buyer, created_at, updated_at`,
    values,
  )

  if (result.rows.length === 0) {
    throw new Error('Drop not found or unauthorized')
  }

  return mapDropRow(result.rows[0])
}

// Helper to map database row to Drop type
function mapDropRow(row: any): Drop {
  return {
    id: row.id,
    sellerId: row.seller_id,
    title: row.title,
    description: row.description,
    imageUrls: row.image_urls || [],
    price: row.price,
    totalStock: row.total_stock,
    startTime: new Date(row.start_time),
    endTime: row.end_time ? new Date(row.end_time) : undefined,
    status: row.status,
    maxPerBuyer: row.max_per_buyer,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}
