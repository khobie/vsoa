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
      const applicationPhoto = String(req.query?.applicationPhoto ?? '')
      if (applicationPhoto) {
        const photos = await sql`SELECT photo_url FROM candidate_applications WHERE id = ${applicationPhoto}`
        const photoUrl = String(photos[0]?.photo_url ?? '')
        const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(photoUrl)
        if (!match) return res.status(404).json({ error: 'Aspirant photo not found' })
        const contentTypes: Record<string, string> = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }
        res.setHeader('Content-Type', contentTypes[match[1]])
        res.setHeader('Cache-Control', 'private, max-age=300')
        return res.status(200).send(Buffer.from(match[2], 'base64'))
      }

      if (String(req.query?.summary ?? '') === '1') {
        const counts = await sql`
          SELECT
            (SELECT count(*)::int FROM student_registrations r
             JOIN elections e ON e.id = r.election_id WHERE e.slug = 'el-src-2026') AS "registeredStudents",
            count(*)::int AS aspirants,
            count(*) FILTER (WHERE a.status IN ('SUBMITTED', 'UNDER_REVIEW'))::int AS pending
          FROM candidate_applications a
          JOIN positions p ON p.id = a.position_id
          JOIN elections e ON e.id = p.election_id
          WHERE e.slug = 'el-src-2026'`
        res.setHeader('Cache-Control', 'no-store')
        return res.status(200).json({ summary: counts[0] })
      }

      const applications = await sql`
        SELECT a.id, a.institutional_id AS "institutionalId", a.email, a.name,
               a.year_group AS "yearGroup", a.manifesto, a.bio,
               CASE WHEN a.photo_url LIKE 'data:image/%'
                 THEN '/api/aspirants/applications?applicationPhoto=' || a.id::text
                 ELSE a.photo_url END AS "photoUrl",
               a.status, a.position_id AS "positionId", a.submitted_at AS "submittedAt",
               p.title AS "positionTitle", e.name AS "electionName"
        FROM candidate_applications a
        JOIN positions p ON p.id = a.position_id
        JOIN elections e ON e.id = p.election_id
        WHERE e.slug = 'el-src-2026'
        ORDER BY a.submitted_at DESC`
      const registrationCounts = await sql`
        SELECT count(*)::int AS "registeredStudents"
        FROM student_registrations r
        JOIN elections e ON e.id = r.election_id
        WHERE e.slug = 'el-src-2026'`
      const summary = {
        registeredStudents: registrationCounts[0]?.registeredStudents ?? 0,
        aspirants: applications.length,
        pending: applications.filter((application: any) => ['SUBMITTED', 'UNDER_REVIEW'].includes(application.status)).length,
      }
      res.setHeader('Cache-Control', 'no-store')
      return res.status(200).json({ applications, summary })
    }

    const id = String(req.body?.id ?? '')
    const action = String(req.body?.action ?? '')
    if (!id || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'A valid application and review action are required' })
    }
    const status = action === 'approve' ? 'APPROVED' : 'REJECTED'

    const rows = await sql`
      SELECT id, position_id, name, manifesto, bio, photo_url, submitted_at
      FROM candidate_applications WHERE id = ${id}`
    const application = rows[0]
    if (!application) return res.status(404).json({ error: 'Application not found' })

    const reviewQuery = sql`
      UPDATE candidate_applications
      SET status = ${status}::candidate_status, reviewed_at = now(), reviewed_by = ${user.id}
      WHERE id = ${id}
      RETURNING id, status`
    const ballotQuery = action === 'approve' ? sql`
      INSERT INTO candidates
        (application_id, position_id, name, photo_url, faculty, manifesto, bio, status, submitted_at, reviewed_at, reviewed_by)
      VALUES
        (${id}, ${application.position_id}, ${application.name}, ${application.photo_url}, 'School of Anaesthesia Ridge',
         ${application.manifesto}, ${application.bio}, 'APPROVED', ${application.submitted_at}, now(), ${user.id})
      ON CONFLICT (application_id) WHERE application_id IS NOT NULL DO UPDATE SET
        position_id = EXCLUDED.position_id, name = EXCLUDED.name, photo_url = EXCLUDED.photo_url,
        manifesto = EXCLUDED.manifesto, bio = EXCLUDED.bio, status = 'APPROVED',
        reviewed_at = now(), reviewed_by = ${user.id}, updated_at = now()`
      : sql`DELETE FROM candidates WHERE application_id = ${id}`

    const results = await sql.transaction([ballotQuery, reviewQuery])
    return res.status(200).json({ application: results[1][0] })
  } catch (error: any) {
    return res.status(500).json({ error: 'Unable to process the candidate application', detail: String(error?.message ?? error).slice(0, 200) })
  }
}
