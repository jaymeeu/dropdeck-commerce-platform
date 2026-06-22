/**
 * Environment variables validation and helpers
 * Ensures all required variables are set before application starts
 */

const requiredEnvVars = [
  'AWS_REGION',
  'AWS_ROLE_ARN',
  'PGHOST',
  'PGUSER',
  'PGDATABASE',
]

const optionalEnvVars = [
  'NEXTAUTH_URL',
  'NEXTAUTH_SECRET',
  'STRIPE_SECRET_KEY',
  'STRIPE_PUBLISHABLE_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_APP_URL',
]

export const env = {
  // Database
  AWS_REGION: process.env.AWS_REGION || '',
  AWS_ROLE_ARN: process.env.AWS_ROLE_ARN || '',
  PGHOST: process.env.PGHOST || '',
  PGUSER: process.env.PGUSER || 'postgres',
  PGDATABASE: process.env.PGDATABASE || 'postgres',

  // Authentication
  NEXTAUTH_URL: process.env.NEXTAUTH_URL || '',
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || '',

  // Stripe
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
  STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY || '',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',

  // App
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  PLATFORM_FEE_PERCENT: Number(process.env.PLATFORM_FEE_PERCENT || '5'),
  RESERVATION_TIMEOUT_SECONDS: Number(process.env.RESERVATION_TIMEOUT_SECONDS || '300'),
  MAX_UNITS_PER_BUYER: Number(process.env.MAX_UNITS_PER_BUYER || '5'),
}

/**
 * Validate that all required environment variables are set
 * Called at application startup
 */
export function validateEnv() {
  const missing = requiredEnvVars.filter((varName) => !process.env[varName])

  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing)
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }

  console.log('✓ All required environment variables are set')
}

/**
 * Get the database connection string for CLI tools
 */
export function getDatabaseUrl() {
  return `postgres://${env.PGUSER}@${env.PGHOST}/${env.PGDATABASE}`
}
