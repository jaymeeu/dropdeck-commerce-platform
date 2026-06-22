'use server'

import { query } from '../db'
import type { Drop, DropWithSeller } from '../types'

/**
 * Get a drop by ID
 */
export async function getDrop(dropId: string): Promise<Drop | null> {
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
  const result = await query(
    `SELECT d.id, d.seller_id, d.title, d.description, d.image_urls, d.price, d.total_stock,
            d.start_time, d.end_time, d.status, d.max_per_buyer, d.created_at, d.updated_at,
            u.name, sp.store_name, sp.store_slug
     FROM drops d
     JOIN users u ON d.seller_id = u.id
     LEFT JOIN seller_profiles sp ON u.id = sp.user_id
     WHERE d.status = 'live'
     ORDER BY (
       d.total_stock - COALESCE((
         SELECT SUM(quantity) FROM orders
         WHERE drop_id = d.id AND status IN ('reserved', 'paid', 'confirmed')
       ), 0)
     ) ASC
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
 * Get scheduled drops sorted by start time
 */
export async function getScheduledDrops(limit = 20): Promise<DropWithSeller[]> {
  const result = await query(
    `SELECT d.id, d.seller_id, d.title, d.description, d.image_urls, d.price, d.total_stock,
            d.start_time, d.end_time, d.status, d.max_per_buyer, d.created_at, d.updated_at,
            u.name, sp.store_name, sp.store_slug
     FROM drops d
     JOIN users u ON d.seller_id = u.id
     LEFT JOIN seller_profiles sp ON u.id = sp.user_id
     WHERE d.status = 'scheduled'
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
  const dropResult = await query(
    `SELECT total_stock FROM drops WHERE id = $1`,
    [dropId],
  )

  if (dropResult.rows.length === 0) return 0

  const totalStock = dropResult.rows[0].total_stock

  const soldResult = await query(
    `SELECT COALESCE(SUM(quantity), 0) as total
     FROM orders
     WHERE drop_id = $1 AND status IN ('reserved', 'paid', 'confirmed')`,
    [dropId],
  )

  const sold = Number(soldResult.rows[0].total)
  return Math.max(0, totalStock - sold)
}

/**
 * Create a new drop (seller action)
 */
export async function createDrop(
  sellerId: string,
  data: {
    title: string
    description?: string
    imageUrls?: string[]
    price: number
    totalStock: number
    startTime: Date
    endTime?: Date
    maxPerBuyer?: number
  },
): Promise<Drop> {
  const result = await query(
    `INSERT INTO drops
     (seller_id, title, description, image_urls, price, total_stock, start_time, end_time, status, max_per_buyer)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'scheduled', $9)
     RETURNING id, seller_id, title, description, image_urls, price, total_stock, start_time, end_time, status, max_per_buyer, created_at, updated_at`,
    [
      sellerId,
      data.title,
      data.description || null,
      data.imageUrls || [],
      data.price,
      data.totalStock,
      data.startTime,
      data.endTime || null,
      data.maxPerBuyer || 1,
    ],
  )

  return mapDropRow(result.rows[0])
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
