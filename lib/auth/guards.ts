'use server'

import { auth } from './auth'

/**
 * Guard for server actions that require authentication
 * Throws if user is not authenticated
 */
export async function requireAuth() {
  const session = await auth()

  if (!session?.user) {
    throw new Error('Authentication required')
  }

  return session.user
}

/**
 * Guard for server actions that require a specific role
 * Throws if user doesn't have the required role
 */
export async function requireRole(role: 'buyer' | 'seller' | 'admin') {
  const user = await requireAuth()

  if (user.role !== role) {
    throw new Error(`${role} access required`)
  }

  return user
}

/**
 * Guard for server actions that require one of multiple roles
 */
export async function requireAnyRole(roles: ('buyer' | 'seller' | 'admin')[]) {
  const user = await requireAuth()

  if (!roles.includes(user.role)) {
    throw new Error(`Access denied. Required roles: ${roles.join(', ')}`)
  }

  return user
}
