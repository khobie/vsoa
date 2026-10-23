import { getSql } from '../_db.js'
import { methodNotAllowed } from '../auth/_utils.js'

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST')
  try {
    const name = String(req.body?.name ?? '').trim()
    const institutionalId = String(req.body?.institutionalId ?? '').trim().toUpperCase()
    const email = String(req.body?.email ?? '').trim().toLowerCase()
    const yearGroup = String(req.body?.yearGroup ?? '').trim()
    const positionId = String(req.body?.positionId ?? '')
    const manifesto = String(req.body?.manifesto ?? '').trim()
    const bio = String(req.body?.bio ?? '').trim()
    const photo = String(req.body?.photo ?? '')

    if (name.length < 3 || name.length > 120 || !institutionalId || institutionalId.length > 50) {
      return res.status(400).json({ error: 'Enter your full name and a valid institutional ID' })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
      return res.status(400).json({ error: 'Enter a valid email address' })
    }
    if (yearGroup.length > 50 || manifesto.length < 20 || manifesto.length > 5000 || bio.length < 10 || bio.length > 2000) {
      return res.status(400).json({ error: 'Check your year group, manifesto, and biography' })
    }
    if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(photo) || photo.length > 3_000_000) {
      return res.status(400).json({ error: 'Upload a JPG, PNG, or WebP photo no larger than 2 MB' })
    }

    const sql = await getSql()
    const positions = await sql`
      SELECT p.id FROM positions p
      JOIN elections e ON e.id = p.election_id
      WHERE p.id = ${positionId} AND e.slug = 'el-src-2026'`
    if (!positions[0]) return res.status(400).json({ error: 'Select a valid SRC position' })

    const inserted = await sql`
      INSERT INTO candidate_applications
        (position_id, institutional_id, email, name, year_group, manifesto, bio, photo_url)
      VALUES
        (${positionId}, ${institutionalId}, ${email}, ${name}, ${yearGroup || null}, ${manifesto}, ${bio}, ${photo})
      RETURNING id, submitted_at AS "submittedAt"`
    return res.status(201).json({ application: inserted[0] })
  } catch (error: any) {
    if (error?.code === '23505') {
      return res.status(409).json({ error: 'You have already registered for this position' })
    }
    return res.status(500).json({ error: 'Registration is temporarily unavailable', detail: String(error?.message ?? error).slice(0, 200) })
  }
}
