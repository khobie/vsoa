import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { getSql } from '../_db.js'

export const SESSION_COOKIE = 'evote_session'
export const SESSION_SECONDS = 60 * 60 * 24 * 7

export interface AuthUser {
  id: string
  name: string
  institutionalId: string
  email: string
  faculty: string
  department: string
  yearGroup: string
  role: 'super_admin' | 'commissioner' | 'officer' | 'candidate' | 'voter'
  roles: AuthUser['role'][]
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `scrypt$${salt}$${hash}`
}

export function verifyPassword(password: string, stored: string) {
  const [algorithm, salt, expectedHex] = stored.split('$')
  if (algorithm !== 'scrypt' || !salt || !expectedHex) return false
  const actual = scryptSync(password, salt, 64)
  const expected = Buffer.from(expectedHex, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function createSessionToken() {
  return randomBytes(32).toString('base64url')
}

export function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function readSessionToken(req: any) {
  const header = String(req.headers.cookie ?? '')
  for (const part of header.split(';')) {
    const [name, ...value] = part.trim().split('=')
    if (name === SESSION_COOKIE) return decodeURIComponent(value.join('='))
  }
  return null
}

export function sessionCookie(token: string) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_SECONDS}`
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
}

export async function getSessionUser(req: any): Promise<AuthUser | null> {
  const token = readSessionToken(req)
  if (!token) return null
  const sql = await getSql()
  const rows = await sql`
    SELECT u.id, u.institutional_id AS "institutionalId", u.email, u.name,
           u.faculty, u.department, u.year_group AS "yearGroup",
           json_agg(r.role) AS roles
    FROM auth_sessions s
    JOIN users u ON u.id = s.user_id
    JOIN user_roles r ON r.user_id = u.id
    WHERE s.token_hash = ${hashSessionToken(token)}
      AND s.expires_at > now()
      AND u.is_active = true
    GROUP BY u.id`
  const row = rows[0]
  if (!row) return null
  const roles = (row.roles as string[]).map((role) => role.toLowerCase()) as AuthUser['role'][]
  const rolePriority: AuthUser['role'][] = ['super_admin', 'commissioner', 'officer', 'candidate', 'voter']
  return {
    id: row.id,
    institutionalId: row.institutionalId,
    email: row.email,
    name: row.name,
    faculty: row.faculty ?? '',
    department: row.department ?? '',
    yearGroup: row.yearGroup ?? '',
    roles,
    role: rolePriority.find((role) => roles.includes(role)) ?? 'voter',
  }
}

export function methodNotAllowed(res: any, allowed: string) {
  res.setHeader('Allow', allowed)
  return res.status(405).json({ error: 'Method not allowed' })
}
