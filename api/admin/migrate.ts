import { getSql } from '../_db.js'
import { DDL_STATEMENTS } from '../_schema-sql.js'
import { getSessionUser, methodNotAllowed } from '../auth/_utils.js'

export const config = { maxDuration: 60 }

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST')
  try {
    const user = await getSessionUser(req)
    if (!user) return res.status(401).json({ error: 'Sign in required' })
    if (!user.roles.some((role) => role === 'super_admin' || role === 'commissioner')) {
      return res.status(403).json({ error: 'Commissioner access required' })
    }
    const sql = await getSql()
    for (const statement of DDL_STATEMENTS) await sql.query(statement)
    return res.status(200).json({ migrated: true, statements: DDL_STATEMENTS.length })
  } catch (error: any) {
    return res.status(500).json({ error: 'Migration failed', detail: String(error?.message ?? error).slice(0, 200) })
  }
}
