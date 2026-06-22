import { auth } from './auth'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Middleware to protect routes based on authentication and role
 */
export async function withAuth(request: NextRequest, requiredRoles?: string[]) {
  const session = await auth()

  if (!session) {
    return NextResponse.redirect(new URL('/auth/signin', request.url))
  }

  if (requiredRoles && !requiredRoles.includes(session.user.role)) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return null
}

/**
 * Get the current session in server components
 */
export async function getCurrentSession() {
  return await auth()
}

/**
 * Get the current user in server components
 */
export async function getCurrentUser() {
  const session = await auth()
  return session?.user || null
}

/**
 * Check if user has a specific role
 */
export function hasRole(userRole: string, requiredRole: string) {
  return userRole === requiredRole
}

/**
 * Check if user has one of multiple roles
 */
export function hasAnyRole(userRole: string, roles: string[]) {
  return roles.includes(userRole)
}
