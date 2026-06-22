/**
 * DropDeck Database Types
 * Automatically synced with database schema
 */

export type UserRole = 'buyer' | 'seller' | 'admin'
export type DropStatus = 'draft' | 'scheduled' | 'live' | 'sold_out' | 'ended'
export type OrderStatus = 'reserved' | 'paid' | 'confirmed' | 'expired' | 'refunded'
export type CheckoutOutcome = 'success' | 'sold_out' | 'limit_exceeded' | 'not_live' | 'error'

export interface User {
  id: string
  email: string
  passwordHash: string
  role: UserRole
  name: string
  createdAt: Date
  updatedAt: Date
}

export interface SellerProfile {
  id: string
  userId: string
  storeName: string
  storeSlug: string
  bio?: string
  payoutEmail?: string
  stripeAccountId?: string
  createdAt: Date
}

export interface Drop {
  id: string
  sellerId: string
  title: string
  description?: string
  imageUrls: string[]
  price: number // in cents
  totalStock: number
  startTime: Date
  endTime?: Date
  status: DropStatus
  maxPerBuyer: number
  createdAt: Date
  updatedAt: Date
}

export interface Order {
  id: string
  dropId: string
  buyerId: string
  quantity: number
  unitPrice: number // in cents
  totalAmount: number // in cents
  status: OrderStatus
  stripePaymentIntentId?: string
  reservedAt: Date
  paidAt?: Date
  expiresAt: Date
  createdAt: Date
}

export interface CheckoutLog {
  id: string
  dropId: string
  buyerId?: string
  attemptedAt: Date
  outcome: CheckoutOutcome
  orderId?: string
  latencyMs?: number
}

// Composite/View types
export interface DropWithSeller extends Drop {
  seller: {
    name: string
    storeName: string
    storeSlug: string
  }
}

export interface OrderWithDrop extends Order {
  drop: {
    title: string
    price: number
  }
}

export interface CheckoutResponse {
  success: boolean
  order?: Order
  error?: string
  errorCode?: CheckoutOutcome
  latencyMs?: number
}

export class CheckoutError extends Error {
  constructor(
    public code: CheckoutOutcome,
    message?: string,
  ) {
    super(message || code)
    this.name = 'CheckoutError'
  }
}
