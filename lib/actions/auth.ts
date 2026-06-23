'use server'

import { signIn } from '@/lib/auth/auth'
import { AuthError } from 'next-auth'

export async function loginAction(email: string, password: string) {
  try {
    await signIn('credentials', {
      email,
      password,
      redirect: false,
    })
    return { ok: true }
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return { error: 'Invalid email or password' }
        default:
          return { error: 'Something went wrong. Please try again.' }
      }
    }
    throw error
  }
}
