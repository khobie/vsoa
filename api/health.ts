import { getSql } from './_db'

/**
 * Health check — verifies the API layer and database connectivity.
 * GET /api/health
 */
export default async function handler(_req: any, res: any) {
  let database = 'not_configured'
  try {
    const sql = getSql()
    await sql`SELECT 1`
    database = 'connected'
  } catch (e: any) {
    database = e.code === 'NO_DB' ? 'not_configured' : 'error'
  }
  res.status(200).json({
    ok: true,
    service: 'ug-evoting-api',
    time: new Date().toISOString(),
    database,
  })
}
