/**
 * Health check — verifies the API layer and database connectivity.
 * GET /api/health
 */
export default async function handler(_req: any, res: any) {
  let database = 'not_configured'
  let detail: string | undefined
  try {
    const { neon } = await import('@neondatabase/serverless')
    const url = process.env.DATABASE_URL
    if (!url) {
      database = 'not_configured'
    } else {
      const sql = neon(url)
      await sql`SELECT 1`
      database = 'connected'
    }
  } catch (e: any) {
    database = 'error'
    detail = String(e?.message ?? e).slice(0, 200)
  }
  res.status(200).json({
    ok: true,
    service: 'sar-evoting-api',
    time: new Date().toISOString(),
    database,
    detail,
  })
}
