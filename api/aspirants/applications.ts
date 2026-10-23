import { getSql } from '../_db.js'
import { getSessionUser, methodNotAllowed } from '../auth/_utils.js'

const STAFF = ['super_admin', 'commissioner', 'officer']

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'PATCH') return methodNotAllowed(res, 'GET, PATCH')
  try {
    const user = await getSessionUser(req)
    if (!user) return res.status(401).json({ error: 'Sign in required' })
    if (!user.roles.some((role) => STAFF.includes(role))) {
      return res.status(403).json({ error: 'Electoral staff access required' })
    }

    const sql = await getSql()
    if (req.method === 'GET') {
      const applications = await sql`
        SELECT a.id, a.institutional_id AS "institutionalId", a.email, a.name,
               a.year_group AS "yearGroup", a.manifesto, a.bio, a.status,
               a.position_id AS "positionId", a.submitted_at AS "submittedAt",
               p.title AS "positionTitle", e.name AS "electionName"
        FROM candidate_applications a
        JOIN positions p ON p.id = a.position_id
        JOIN elections e ON e.id = p.election_id
        WHERE e.slug = 'el-src-2026'
        ORDER BY a.submitted_at DESC`
      res.setHeader('Cache-Control', 'no-store')
      return res.status(200).json({ applications })
    }

    const id = String(req.body?.id ?? '')
    const action = String(req.body?.action ?? '')
    if (!id || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'A valid application and review action are required' })
    }
    const status = action === 'approve' ? 'APPROVED' : 'REJECTED'

    const updated = await sql.transaction(async (transaction: any) => {
      const rows = await transaction`
        SELECT id, position_id, name, manifesto, bio, submitted_at
        FROM candidate_applications WHERE id = ${id} FOR UPDATE`
      const application = rows[0]
      if (!application) throw new Error('NOT_FOUND')

      if (action === 'approve') {
        await transaction`
          INSERT INTO candidates
            (application_id, position_id, name, faculty, manifesto, bio, status, submitted_at, reviewed_at, reviewed_by)
          VALUES
            (${id}, ${application.position_id}, ${application.name}, 'School of Anaesthesia Ridge',
             ${application.manifesto}, ${application.bio}, 'APPROVED', ${application.submitted_at}, now(), ${user.id})
          ON CONFLICT (application_id) WHERE application_id IS NOT NULL DO UPDATE SET
            position_id = EXCLUDED.position_id, name = EXCLUDED.name, manifesto = EXCLUDED.manifesto,
            bio = EXCLUDED.bio, status = 'APPROVED', reviewed_at = now(), reviewed_by = ${user.id}, updated_at = now()`
      } else {
        await transaction`DELETE FROM candidates WHERE application_id = ${id}`
      }

      const result = await transaction`
        UPDATE candidate_applications
        SET status = ${status}::candidate_status, reviewed_at = now(), reviewed_by = ${user.id}
        WHERE id = ${id}
        RETURNING id, status`
      return result[0]
    })
    return res.status(200).json({ application: updated })
  } catch (error: any) {
    if (error?.message === 'NOT_FOUND') return res.status(404).json({ error: 'Application not found' })
    return res.status(500).json({ error: 'Unable to process the candidate application', detail: String(error?.message ?? error).slice(0, 200) })
  }
}
