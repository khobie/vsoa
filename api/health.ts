/**
 * Health check — first backend endpoint.
 * Verifies the serverless API layer works and (later) reports DB connectivity.
 * GET /api/health
 */
export default function handler(_req: any, res: any) {
  res.status(200).json({
    ok: true,
    service: 'ug-evoting-api',
    time: new Date().toISOString(),
    database: process.env.DATABASE_URL ? 'configured' : 'not_configured',
  })
}
