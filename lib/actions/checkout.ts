'use server'

import { query, withTransaction } from '../db'
import { CheckoutError, type CheckoutResponse, type Order } from '../types'
import { env } from '../env'
import { requireAuth } from '../auth/guards'
import { stripe } from '../stripe'
import { syncDropLifecycle, ACTIVE_ORDER_STOCK_WHERE } from '../drop-lifecycle'

/**
 * Core checkout logic with atomic database transaction
 *
 * This implements the zero-oversell guarantee using SELECT ... FOR UPDATE
 * at the database level. The drop row is locked for the duration of the transaction,
 * ensuring no race conditions between concurrent checkout attempts.
 *
 * @param dropId - UUID of the drop being purchased
 * @param buyerId - UUID of the buyer
 * @param quantity - Number of units to purchase
 * @returns CheckoutResponse with order details or error
 */
/**
 * Checkout for the currently authenticated user.
 */
export async function attemptCheckoutAuthenticated(
  dropId: string,
  quantity: number,
): Promise<CheckoutResponse> {
  const user = await requireAuth()
  return attemptCheckout(dropId, user.id!, quantity)
}

export async function attemptCheckout(
  dropId: string,
  buyerId: string,
  quantity: number,
): Promise<CheckoutResponse> {
  const startTime = Date.now()

  try {
    // Validate inputs
    if (!dropId || !buyerId) {
      throw new CheckoutError('error', 'Missing dropId or buyerId')
    }

    if (quantity <= 0 || quantity > env.MAX_UNITS_PER_BUYER) {
      throw new CheckoutError('limit_exceeded', `Quantity must be between 1 and ${env.MAX_UNITS_PER_BUYER}`)
    }

    await syncDropLifecycle(dropId)

    const order = await withTransaction(async (client) => {
      // 1. LOCK the drop row for update - this is the key serialization point
      //    No other transaction can read or modify this row until we commit
      const dropResult = await client.query(
        `SELECT id, seller_id, title, price, total_stock, status, max_per_buyer, start_time, end_time
         FROM drops
         WHERE id = $1
         FOR UPDATE`,
        [dropId],
      )

      const drop = dropResult.rows[0]

      if (!drop) {
        throw new CheckoutError('error', 'Drop not found')
      }

      // 2. Validate drop is live
      if (drop.status !== 'live') {
        throw new CheckoutError('not_live', `Drop status is ${drop.status}, not live`)
      }

      // 3. Count committed (non-expired) orders for this drop
      const soldResult = await client.query(
        `SELECT COALESCE(SUM(quantity), 0) as total
         FROM orders
         WHERE drop_id = $1
           AND (${ACTIVE_ORDER_STOCK_WHERE})`,
        [dropId],
      )

      const unitsSold = Number(soldResult.rows[0].total)
      const available = drop.total_stock - unitsSold

      if (available < quantity) {
        throw new CheckoutError('sold_out', `Only ${available} units available`)
      }

      // 4. Check per-buyer limit
      const buyerOrderResult = await client.query(
        `SELECT COALESCE(SUM(quantity), 0) as total
         FROM orders
         WHERE drop_id = $1
           AND buyer_id = $2
           AND (${ACTIVE_ORDER_STOCK_WHERE})`,
        [dropId, buyerId],
      )

      const buyerTotal = Number(buyerOrderResult.rows[0].total)

      if (buyerTotal + quantity > drop.max_per_buyer) {
        throw new CheckoutError(
          'limit_exceeded',
          `You can only buy ${drop.max_per_buyer} units. You already have ${buyerTotal}.`,
        )
      }

      // 5. Create the reservation order
      const expiresAt = new Date(Date.now() + env.RESERVATION_TIMEOUT_SECONDS * 1000)
      const totalAmount = drop.price * quantity

      const orderResult = await client.query(
        `INSERT INTO orders
         (drop_id, buyer_id, quantity, unit_price, total_amount, status, expires_at)
         VALUES ($1, $2, $3, $4, $5, 'reserved', $6)
         RETURNING id, drop_id, buyer_id, quantity, unit_price, total_amount, status, expires_at, reserved_at, created_at`,
        [dropId, buyerId, quantity, drop.price, totalAmount, expiresAt],
      )

      const newOrder = orderResult.rows[0]

      // 6. If this reservation fills the last unit(s), mark drop as sold out
      if (unitsSold + quantity >= drop.total_stock) {
        await client.query(
          `UPDATE drops
           SET status = 'sold_out', updated_at = NOW()
           WHERE id = $1`,
          [dropId],
        )
      }

      // 7. Log the successful attempt
      const latencyMs = Date.now() - startTime
      await client.query(
        `INSERT INTO checkout_log
         (drop_id, buyer_id, outcome, order_id, latency_ms)
         VALUES ($1, $2, 'success', $3, $4)`,
        [dropId, buyerId, newOrder.id, latencyMs],
      )

      return {
        id: newOrder.id,
        dropId: newOrder.drop_id,
        buyerId: newOrder.buyer_id,
        quantity: newOrder.quantity,
        unitPrice: newOrder.unit_price,
        totalAmount: newOrder.total_amount,
        status: newOrder.status,
        expiresAt: newOrder.expires_at,
        reservedAt: newOrder.reserved_at,
        createdAt: newOrder.created_at,
      } as Order
    })

    const latencyMs = Date.now() - startTime

    return {
      success: true,
      order,
      latencyMs,
    }
  } catch (error) {
    const latencyMs = Date.now() - startTime

    if (error instanceof CheckoutError) {
      return {
        success: false,
        error: error.message,
        errorCode: error.code,
        latencyMs,
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorCode: 'error',
      latencyMs,
    }
  }
}

/**
 * Get order details by ID
 */
export async function getOrder(orderId: string): Promise<Order | null> {
  const result = await query(
    `SELECT id, drop_id, buyer_id, quantity, unit_price, total_amount, status,
            stripe_payment_intent_id, reserved_at, paid_at, expires_at, created_at
     FROM orders
     WHERE id = $1`,
    [orderId],
  )

  if (result.rows.length === 0) return null

  const row = result.rows[0]
  return {
    id: row.id,
    dropId: row.drop_id,
    buyerId: row.buyer_id,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    totalAmount: row.total_amount,
    status: row.status,
    stripePaymentIntentId: row.stripe_payment_intent_id,
    reservedAt: row.reserved_at,
    paidAt: row.paid_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }
}

/**
 * Update order status (used by Stripe webhook)
 */
export async function updateOrderStatus(
  orderId: string,
  newStatus: 'paid' | 'confirmed' | 'expired' | 'refunded',
): Promise<void> {
  const paidAt = newStatus === 'paid' ? new Date() : undefined

  await query(
    `UPDATE orders
     SET status = $1, paid_at = COALESCE($2, paid_at)
     WHERE id = $3`,
    [newStatus, paidAt, orderId],
  )
}

export async function setOrderPaymentIntent(
  orderId: string,
  paymentIntentId: string,
): Promise<void> {
  await query(
    `UPDATE orders SET stripe_payment_intent_id = $1 WHERE id = $2`,
    [paymentIntentId, orderId],
  )
}

/**
 * Verify a succeeded Stripe payment and mark the order confirmed.
 * Used after client-side payment and as a webhook fallback.
 */
export async function confirmOrderPayment(
  orderId: string,
  paymentIntentId: string,
): Promise<void> {
  const user = await requireAuth()
  const order = await getOrder(orderId)

  if (!order || order.buyerId !== user.id) {
    throw new Error('Unauthorized')
  }

  if (order.status !== 'reserved') {
    return
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

  if (paymentIntent.metadata.orderId !== orderId) {
    throw new Error('Payment does not match this order')
  }

  if (paymentIntent.status !== 'succeeded') {
    throw new Error(`Payment not completed: ${paymentIntent.status}`)
  }

  await setOrderPaymentIntent(orderId, paymentIntentId)
  await updateOrderStatus(orderId, 'paid')
  await updateOrderStatus(orderId, 'confirmed')
}

/**
 * Simulated payment for demo/dev when Stripe is unavailable.
 */
export async function simulateOrderPayment(orderId: string): Promise<void> {
  const simulateEnabled =
    process.env.SIMULATE_PAYMENTS === 'true' ||
    (process.env.NODE_ENV === 'development' && !process.env.STRIPE_SECRET_KEY)

  if (!simulateEnabled) {
    throw new Error('Simulated payments are not enabled')
  }

  const user = await requireAuth()
  const order = await getOrder(orderId)

  if (!order || order.buyerId !== user.id) {
    throw new Error('Unauthorized')
  }

  if (order.status !== 'reserved') {
    throw new Error('Order is not awaiting payment')
  }

  if (new Date(order.expiresAt) <= new Date()) {
    throw new Error('Reservation has expired')
  }

  await setOrderPaymentIntent(orderId, `sim_${orderId}`)
  await updateOrderStatus(orderId, 'paid')
  await updateOrderStatus(orderId, 'confirmed')
}
