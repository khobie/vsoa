import { getSql } from '../_db.js'
import {
  createSessionToken,
  getSessionUser,
  hashSessionToken,
  methodNotAllowed,
  sessionCookie,
} from './_utils.js'

const VOTER_SESSION_SECONDS = 60 * 60 * 12

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST')
  try {
    const institutionalId = String(req.body?.institutionalId ?? '').trim().toUpperCase()
    const votingToken = String(req.body?.votingToken ?? '').trim()
    if (!institutionalId || institutionalId.length > 50 || votingToken.length < 8 || votingToken.length > 200) {
      return res.status(400).json({ error: 'Enter your Student ID and voting token' })
    }

    const forwarded = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim()
    const ip = forwarded || String(req.socket?.remoteAddress ?? 'unknown')
    const ipHash = hashSessionToken(`${process.env.SESSION_SECRET ?? 'evote'}:${ip}`)
    const sql = await getSql()
    await sql`DELETE FROM voter_login_attempts WHERE created_at < now() - interval '1 day'`
    const attempts = await sql`
      SELECT count(*) FILTER (WHERE institutional_id = ${institutionalId})::int AS student_attempts,
             count(*) FILTER (WHERE ip_hash = ${ipHash})::int AS ip_attempts
      FROM voter_login_attempts
      WHERE succeeded = false AND created_at > now() - interval '15 minutes'`
    if ((attempts[0]?.student_attempts ?? 0) >= 5 || (attempts[0]?.ip_attempts ?? 0) >= 30) {
      return res.status(429).json({ error: 'Too many unsuccessful attempts. Wait 15 minutes before trying again.' })
    }

    const sessionToken = createSessionToken()
    const sessionHash = hashSessionToken(sessionToken)
    const tokenHash = hashSessionToken(votingToken)
    const created = await sql`
      WITH consumed AS (
        UPDATE voting_tokens vt SET consumed_at = now()
        FROM users u
        WHERE vt.user_id = u.id
          AND u.institutional_id = ${institutionalId}
          AND u.is_active = true
          AND EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role = 'VOTER')
          AND vt.token_hash = ${tokenHash}
          AND vt.consumed_at IS NULL
          AND vt.invalidated_at IS NULL
          AND vt.expires_at > now()
        RETURNING vt.user_id
      ), session AS (
        INSERT INTO auth_sessions (user_id, token_hash, expires_at)
        SELECT user_id, ${sessionHash}, now() + make_interval(secs => ${VOTER_SESSION_SECONDS})
        FROM consumed
        RETURNING user_id
      )
      SELECT user_id FROM session`

    if (!created[0]) {
      await sql`INSERT INTO voter_login_attempts (institutional_id, ip_hash, succeeded)
                VALUES (${institutionalId}, ${ipHash}, false)`
      return res.status(401).json({ error: 'Invalid Student ID or voting token, or the token has expired or already been used' })
    }

    await sql`DELETE FROM voter_login_attempts WHERE institutional_id = ${institutionalId} OR ip_hash = ${ipHash}`
    res.setHeader('Set-Cookie', sessionCookie(sessionToken, VOTER_SESSION_SECONDS))
    res.setHeader('Cache-Control', 'no-store')
    const user = await getSessionUser({ headers: { cookie: `evote_session=${sessionToken}` } })
    return res.status(200).json({ user })
  } catch (error: any) {
    return res.status(500).json({ error: 'Student sign-in is temporarily unavailable', detail: String(error?.message ?? error).slice(0, 200) })
  }
}
