'use client'

import { useSession } from 'next-auth/react'

/**
 * Hook to access the current session and user
 * Returns loading state, session, and user info
 */
export function useAuth() {
  const { data: session, status } = useSession()

  return {
    isLoading: status === 'loading',
    isAuthenticated: status === 'authenticated',
    user: session?.user || null,
    session,
  }
}

/**
 * Hook to check if user has a specific role
 */
export function useHasRole(role: 'buyer' | 'seller' | 'admin') {
  const { user } = useAuth()
  return user?.role === role
}

/**
 * Hook to check if user has one of multiple roles
 */
export function useHasAnyRole(roles: ('buyer' | 'seller' | 'admin')[]) {
  const { user } = useAuth()
  return user ? roles.includes(user.role) : false
}
