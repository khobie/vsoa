import { getSql } from '../_db.js'
import { clearSessionCookie, hashSessionToken, methodNotAllowed, readSessionToken } from './_utils.js'

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST')
  try {
    const token = readSessionToken(req)
    if (token) {
      const sql = await getSql()
      await sql`DELETE FROM auth_sessions WHERE token_hash = ${hashSessionToken(token)}`
    }
    res.setHeader('Set-Cookie', clearSessionCookie())
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({ ok: true })
  } catch (error: any) {
    return res.status(500).json({ error: 'Unable to sign out', detail: String(error?.message ?? error).slice(0, 200) })
  }
}
