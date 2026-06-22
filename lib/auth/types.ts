import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: 'buyer' | 'seller' | 'admin'
    } & DefaultSession['user']
  }

  interface User {
    id: string
    role: 'buyer' | 'seller' | 'admin'
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: 'buyer' | 'seller' | 'admin'
  }
}
