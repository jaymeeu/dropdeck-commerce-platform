'use server'

import { query } from '../db'
import { hashPassword, comparePassword } from '../auth/password'
import type { User, UserRole, SellerProfile } from '../types'

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  const result = await query(
    `SELECT id, email, password_hash, role, name, created_at, updated_at
     FROM users
     WHERE email = $1`,
    [email],
  )

  if (result.rows.length === 0) return null
  return mapUserRow(result.rows[0])
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<User | null> {
  const result = await query(
    `SELECT id, email, password_hash, role, name, created_at, updated_at
     FROM users
     WHERE id = $1`,
    [userId],
  )

  if (result.rows.length === 0) return null
  return mapUserRow(result.rows[0])
}

/**
 * Create a new user (registration)
 */
export async function createUser(
  email: string,
  password: string,
  name: string,
  role: UserRole = 'buyer',
): Promise<User> {
  // Check if user already exists
  const existing = await getUserByEmail(email)
  if (existing) {
    throw new Error('User with this email already exists')
  }

  // Hash password
  const passwordHash = await hashPassword(password)

  const result = await query(
    `INSERT INTO users (email, password_hash, role, name)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, password_hash, role, name, created_at, updated_at`,
    [email, passwordHash, role, name],
  )

  return mapUserRow(result.rows[0])
}

/**
 * Authenticate user (login)
 */
export async function authenticateUser(
  email: string,
  password: string,
): Promise<User | null> {
  console.log('[v0] Authenticating user:', email)
  
  const user = await getUserByEmail(email)
  console.log('[v0] User found:', user ? `${user.id} (${user.name})` : 'null')
  
  if (!user) {
    console.log('[v0] User not found in database')
    return null
  }

  console.log('[v0] Comparing password. Hash starts with:', user.passwordHash?.substring(0, 10))
  const valid = await comparePassword(password, user.passwordHash)
  console.log('[v0] Password comparison result:', valid)
  
  if (!valid) {
    console.log('[v0] Password is invalid')
    return null
  }

  console.log('[v0] Authentication successful')
  return user
}

/**
 * Update user profile
 */
export async function updateUser(
  userId: string,
  updates: {
    name?: string
    email?: string
  },
): Promise<User> {
  const { name, email } = updates

  // If email is being changed, check for duplicates
  if (email) {
    const existing = await getUserByEmail(email)
    if (existing && existing.id !== userId) {
      throw new Error('Email already in use')
    }
  }

  const updateFields: string[] = ['updated_at = NOW()']
  const values: unknown[] = [userId]
  let paramCount = 1

  if (name !== undefined) {
    paramCount++
    updateFields.push(`name = $${paramCount}`)
    values.push(name)
  }

  if (email !== undefined) {
    paramCount++
    updateFields.push(`email = $${paramCount}`)
    values.push(email)
  }

  const result = await query(
    `UPDATE users
     SET ${updateFields.join(', ')}
     WHERE id = $1
     RETURNING id, email, password_hash, role, name, created_at, updated_at`,
    values,
  )

  return mapUserRow(result.rows[0])
}

/**
 * Get or create seller profile
 */
export async function getOrCreateSellerProfile(userId: string): Promise<SellerProfile> {
  const user = await getUserById(userId)
  if (!user) throw new Error('User not found')

  if (user.role !== 'seller') {
    throw new Error('User is not a seller')
  }

  // Check if profile exists
  const result = await query(
    `SELECT id, user_id, store_name, store_slug, bio, payout_email, stripe_account_id, created_at
     FROM seller_profiles
     WHERE user_id = $1`,
    [userId],
  )

  if (result.rows.length > 0) {
    return mapSellerProfileRow(result.rows[0])
  }

  // Create default seller profile
  const storeSlug = `store-${userId.slice(0, 8)}`
  const createResult = await query(
    `INSERT INTO seller_profiles (user_id, store_name, store_slug)
     VALUES ($1, $2, $3)
     RETURNING id, user_id, store_name, store_slug, bio, payout_email, stripe_account_id, created_at`,
    [userId, user.name, storeSlug],
  )

  return mapSellerProfileRow(createResult.rows[0])
}

/**
 * Update seller profile
 */
export async function updateSellerProfile(
  userId: string,
  updates: {
    storeName?: string
    storeSlug?: string
    bio?: string
    payoutEmail?: string
    stripeAccountId?: string
  },
): Promise<SellerProfile> {
  const updateFields: string[] = []
  const values: unknown[] = [userId]
  let paramCount = 1

  if (updates.storeName !== undefined) {
    paramCount++
    updateFields.push(`store_name = $${paramCount}`)
    values.push(updates.storeName)
  }

  if (updates.storeSlug !== undefined) {
    // Check for slug uniqueness
    const existing = await query(
      `SELECT id FROM seller_profiles WHERE store_slug = $1 AND user_id != $2`,
      [updates.storeSlug, userId],
    )
    if (existing.rows.length > 0) {
      throw new Error('Store slug already in use')
    }

    paramCount++
    updateFields.push(`store_slug = $${paramCount}`)
    values.push(updates.storeSlug)
  }

  if (updates.bio !== undefined) {
    paramCount++
    updateFields.push(`bio = $${paramCount}`)
    values.push(updates.bio)
  }

  if (updates.payoutEmail !== undefined) {
    paramCount++
    updateFields.push(`payout_email = $${paramCount}`)
    values.push(updates.payoutEmail)
  }

  if (updates.stripeAccountId !== undefined) {
    paramCount++
    updateFields.push(`stripe_account_id = $${paramCount}`)
    values.push(updates.stripeAccountId)
  }

  if (updateFields.length === 0) {
    // No updates, just return existing
    const result = await query(
      `SELECT id, user_id, store_name, store_slug, bio, payout_email, stripe_account_id, created_at
       FROM seller_profiles
       WHERE user_id = $1`,
      [userId],
    )
    return mapSellerProfileRow(result.rows[0])
  }

  const result = await query(
    `UPDATE seller_profiles
     SET ${updateFields.join(', ')}
     WHERE user_id = $1
     RETURNING id, user_id, store_name, store_slug, bio, payout_email, stripe_account_id, created_at`,
    values,
  )

  return mapSellerProfileRow(result.rows[0])
}

/**
 * Get seller profile by store slug
 */
export async function getSellerProfileBySlug(storeSlug: string): Promise<SellerProfile | null> {
  const result = await query(
    `SELECT id, user_id, store_name, store_slug, bio, payout_email, stripe_account_id, created_at
     FROM seller_profiles
     WHERE store_slug = $1`,
    [storeSlug],
  )

  if (result.rows.length === 0) return null
  return mapSellerProfileRow(result.rows[0])
}

// Helper functions
function mapUserRow(row: any): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    name: row.name,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

function mapSellerProfileRow(row: any): SellerProfile {
  return {
    id: row.id,
    userId: row.user_id,
    storeName: row.store_name,
    storeSlug: row.store_slug,
    bio: row.bio,
    payoutEmail: row.payout_email,
    stripeAccountId: row.stripe_account_id,
    createdAt: new Date(row.created_at),
  }
}
