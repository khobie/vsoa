/**
 * Shared Neon (PostgreSQL) connection for serverless API routes.
 * Uses Neon's serverless HTTP driver — no connection pooling needed on Vercel.
 * Dynamic import: Vercel's function bundler mishandles the static ESM import.
 */
export async function getSql() {
  const url = process.env.DATABASE_URL
  if (!url) {
    const err = new Error('DATABASE_URL is not configured')
    ;(err as any).code = 'NO_DB'
    throw err
  }
  const { neon } = await import('@neondatabase/serverless')
  return neon(url)
}
