import { getSql } from '../_db.js'
import { getSessionUser, methodNotAllowed } from '../auth/_utils.js'
import { issueToken } from './_tokens.js'

const STAFF = ['super_admin', 'commissioner', 'officer']
export const config = { maxDuration: 60 }

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST')
  try {
    const actor = await getSessionUser(req)
    if (!actor) return res.status(401).json({ error: 'Sign in required' })
    if (!actor.roles.some((role) => STAFF.includes(role))) return res.status(403).json({ error: 'Electoral staff access required' })

    const institutionalId = String(req.body?.institutionalId ?? '').trim().toUpperCase()
    const electionRef = String(req.body?.electionId ?? 'el-src-2026')
    const retryFailed = req.body?.action === 'retry-failed'
    if (!retryFailed && !institutionalId) return res.status(400).json({ error: 'Select a student or retry failed deliveries' })

    const sql = await getSql()
    let students: any[]
    if (retryFailed) {
      students = await sql`
        SELECT u.id, u.institutional_id AS "institutionalId", u.name, u.email
        FROM voter_eligibility ve
        JOIN elections e ON e.id = ve.election_id
        JOIN users u ON u.id = ve.voter_id
        LEFT JOIN LATERAL (
          SELECT delivery_status FROM voting_tokens vt
          WHERE vt.user_id = u.id ORDER BY created_at DESC LIMIT 1
        ) t ON true
        LEFT JOIN participation_records pr ON pr.voter_id = u.id AND pr.election_id = e.id
        WHERE (e.slug = ${electionRef} OR e.id::text = ${electionRef})
          AND u.is_active = true AND pr.id IS NULL
          AND (t.delivery_status = 'failed' OR t.delivery_status IS NULL)
        ORDER BY u.name LIMIT 100`
    } else {
      students = await sql`
        SELECT u.id, u.institutional_id AS "institutionalId", u.name, u.email,
               pr.id AS participation_id
        FROM voter_eligibility ve
        JOIN elections e ON e.id = ve.election_id
        JOIN users u ON u.id = ve.voter_id
        LEFT JOIN participation_records pr ON pr.voter_id = u.id AND pr.election_id = e.id
        WHERE (e.slug = ${electionRef} OR e.id::text = ${electionRef})
          AND u.institutional_id = ${institutionalId} AND u.is_active = true`
      if (students[0]?.participation_id) return res.status(409).json({ error: 'This student has already voted; a new token is not needed' })
    }
    if (!students.length) return res.status(404).json({ error: retryFailed ? 'No failed or missing token deliveries remain' : 'Eligible student not found' })

    const results = []
    for (const student of students) {
      try {
        results.push(await issueToken(sql, student))
      } catch {
        results.push({ institutionalId: student.institutionalId, status: 'failed', detail: 'Token generation failed' })
      }
    }
    const sent = results.filter((result) => result.status === 'sent').length
    return res.status(200).json({ sent, failed: results.length - sent, results })
  } catch (error: any) {
    return res.status(500).json({ error: 'Unable to issue the voting token', detail: String(error?.message ?? error).slice(0, 200) })
  }
}
