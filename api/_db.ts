import { neon } from '@neondatabase/serverless'

/**
 * Shared Neon (PostgreSQL) connection for serverless API routes.
 * Uses Neon's serverless HTTP driver — no connection pooling needed on Vercel.
 */
export function getSql() {
  const url = process.env.DATABASE_URL
  if (!url) {
    const err = new Error('DATABASE_URL is not configured')
    ;(err as any).code = 'NO_DB'
    throw err
  }
  return neon(url)
}
