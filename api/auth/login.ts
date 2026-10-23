import { getSql } from '../_db'
import {
  SESSION_SECONDS,
  createSessionToken,
  getSessionUser,
  hashSessionToken,
  methodNotAllowed,
  sessionCookie,
  verifyPassword,
} from './_utils'

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST')
  try {
    const institutionalId = String(req.body?.institutionalId ?? '').trim()
    const password = String(req.body?.password ?? '')
    if (!institutionalId || institutionalId.length > 100 || password.length < 8 || password.length > 200) {
      return res.status(400).json({ error: 'Enter your institutional ID and password' })
    }

    const sql = await getSql()
    const users = await sql`
      SELECT id, password_hash, is_active
      FROM users
      WHERE institutional_id = ${institutionalId}`
    const user = users[0]
    if (!user || !user.is_active || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid institutional ID or password' })
    }

    const token = createSessionToken()
    await sql`DELETE FROM auth_sessions WHERE expires_at <= now()`
    await sql`
      INSERT INTO auth_sessions (user_id, token_hash, expires_at)
      VALUES (${user.id}, ${hashSessionToken(token)}, now() + make_interval(secs => ${SESSION_SECONDS}))`

    res.setHeader('Set-Cookie', sessionCookie(token))
    res.setHeader('Cache-Control', 'no-store')
    const sessionUser = await getSessionUser({ headers: { cookie: `evote_session=${token}` } })
    return res.status(200).json({ user: sessionUser })
  } catch (error: any) {
    return res.status(500).json({ error: 'Sign-in is temporarily unavailable', detail: String(error?.message ?? error).slice(0, 200) })
  }
}
