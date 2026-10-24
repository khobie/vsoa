import { randomBytes } from 'node:crypto'
import { getSql } from '../_db.js'
import { getSessionUser, hashPassword, methodNotAllowed } from '../auth/_utils.js'
import { issueToken } from './_tokens.js'

const STAFF = ['super_admin', 'commissioner', 'officer']
const DEFAULT_ELECTION = 'el-src-2026'

interface ImportStudent {
  institutionalId: string
  name: string
  email: string
  faculty: string
  department: string
  yearGroup: string
}

function normalizeStudent(raw: any, index: number): { student?: ImportStudent; error?: string } {
  const student: ImportStudent = {
    institutionalId: String(raw?.institutionalId ?? raw?.studentId ?? '').trim().toUpperCase(),
    name: String(raw?.name ?? '').trim().replace(/\s+/g, ' '),
    email: String(raw?.email ?? '').trim().toLowerCase(),
    faculty: String(raw?.faculty ?? 'School of Anaesthesia Ridge').trim(),
    department: String(raw?.department ?? '').trim(),
    yearGroup: String(raw?.yearGroup ?? '').trim(),
  }
  if (!student.institutionalId || student.institutionalId.length > 50) return { error: `Row ${index + 1}: a valid Student ID is required` }
  if (student.name.length < 3 || student.name.length > 120) return { error: `Row ${index + 1}: enter the student's full name` }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(student.email) || student.email.length > 200) return { error: `Row ${index + 1}: a valid email is required` }
  if (student.faculty.length > 120 || student.department.length > 120 || student.yearGroup.length > 50) return { error: `Row ${index + 1}: a detail field is too long` }
  return { student }
}

async function staffUser(req: any) {
  const user = await getSessionUser(req)
  if (!user) return { error: 'Sign in required', status: 401 }
  if (!user.roles.some((role) => STAFF.includes(role))) return { error: 'Electoral staff access required', status: 403 }
  return { user }
}

export const config = { maxDuration: 60 }

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') return methodNotAllowed(res, 'GET, POST')
  try {
    const access = await staffUser(req)
    if ('error' in access) return res.status(access.status).json({ error: access.error })
    const sql = await getSql()
    const electionRef = String(req.method === 'GET' ? req.query?.electionId ?? DEFAULT_ELECTION : req.body?.electionId ?? DEFAULT_ELECTION)
    const elections = await sql`SELECT id, slug FROM elections WHERE slug = ${electionRef} OR id::text = ${electionRef}`
    const election = elections[0]
    if (!election) return res.status(404).json({ error: 'Election not found' })

    if (req.method === 'GET') {
      const voters = await sql`
        SELECT u.id, u.institutional_id AS "institutionalId", u.name, u.email,
               u.faculty, u.department, u.year_group AS "yearGroup", u.is_active AS "isActive",
               t.created_at AS "tokenCreatedAt", t.expires_at AS "tokenExpiresAt",
               t.consumed_at AS "tokenConsumedAt", t.invalidated_at AS "tokenInvalidatedAt",
               t.delivery_status AS "deliveryStatus", t.delivery_detail AS "deliveryDetail",
               t.last_sent_at AS "lastSentAt", pr.accepted_at AS "votedAt"
        FROM voter_eligibility ve
        JOIN users u ON u.id = ve.voter_id
        LEFT JOIN LATERAL (
          SELECT created_at, expires_at, consumed_at, invalidated_at,
                 delivery_status, delivery_detail, last_sent_at
          FROM voting_tokens vt WHERE vt.user_id = u.id
          ORDER BY created_at DESC LIMIT 1
        ) t ON true
        LEFT JOIN participation_records pr ON pr.voter_id = u.id AND pr.election_id = ve.election_id
        WHERE ve.election_id = ${election.id}
        ORDER BY u.name`
      const voted = voters.filter((voter: any) => voter.votedAt).length
      const summary = {
        total: voters.length,
        tokensGenerated: voters.filter((voter: any) => voter.tokenCreatedAt).length,
        sent: voters.filter((voter: any) => voter.deliveryStatus === 'sent').length,
        failed: voters.filter((voter: any) => voter.deliveryStatus === 'failed').length,
        voted,
        turnout: voters.length ? Math.round((voted / voters.length) * 1000) / 10 : 0,
      }
      res.setHeader('Cache-Control', 'no-store')
      return res.status(200).json({
        voters,
        summary,
        emailConfigured: Boolean((process.env.RESEND_API_KEY || process.env.EMAIL_API_KEY) && process.env.EMAIL_FROM),
      })
    }

    const rows = Array.isArray(req.body?.students) ? req.body.students : []
    if (!rows.length) return res.status(400).json({ error: 'Add at least one student to the import' })
    if (rows.length > 500) return res.status(400).json({ error: 'Import no more than 500 students at a time' })
    const students: ImportStudent[] = []
    const errors: string[] = []
    const seenIds = new Set<string>()
    const seenEmails = new Set<string>()
    rows.forEach((row: any, index: number) => {
      const normalized = normalizeStudent(row, index)
      if (normalized.error) errors.push(normalized.error)
      if (!normalized.student) return
      const student = normalized.student
      if (seenIds.has(student.institutionalId)) errors.push(`Row ${index + 1}: duplicate Student ID in this file`)
      if (seenEmails.has(student.email)) errors.push(`Row ${index + 1}: duplicate email in this file`)
      seenIds.add(student.institutionalId)
      seenEmails.add(student.email)
      students.push(student)
    })
    if (errors.length) return res.status(400).json({ error: 'The student list needs correction', details: errors.slice(0, 20) })

    const existing = await sql`
      SELECT institutional_id, email FROM users
      WHERE institutional_id = ANY(${students.map((student) => student.institutionalId)})
         OR email = ANY(${students.map((student) => student.email)})`
    const idOwners = new Map(existing.map((row: any) => [row.institutional_id, row.email]))
    const emailOwners = new Map(existing.map((row: any) => [row.email, row.institutional_id]))
    for (const student of students) {
      if (idOwners.has(student.institutionalId) && idOwners.get(student.institutionalId) !== student.email) {
        return res.status(409).json({ error: `${student.institutionalId} is already registered with another email. Correct the existing record before reimporting.` })
      }
      if (emailOwners.has(student.email) && emailOwners.get(student.email) !== student.institutionalId) {
        return res.status(409).json({ error: `${student.email} already belongs to another Student ID.` })
      }
    }

    const queries: any[] = []
    for (const student of students) {
      queries.push(
        sql`INSERT INTO users
            (institutional_id, email, password_hash, name, faculty, department, year_group, activated_at)
            VALUES (${student.institutionalId}, ${student.email}, ${hashPassword(randomBytes(32).toString('base64url'))},
                    ${student.name}, ${student.faculty || null}, ${student.department || null}, ${student.yearGroup || null}, now())
            ON CONFLICT (institutional_id) DO UPDATE SET
              email = EXCLUDED.email, name = EXCLUDED.name, faculty = EXCLUDED.faculty,
              department = EXCLUDED.department, year_group = EXCLUDED.year_group,
              is_active = true, activated_at = COALESCE(users.activated_at, now()), updated_at = now()
            RETURNING id, institutional_id AS "institutionalId", name, email`,
        sql`INSERT INTO user_roles (user_id, role)
            SELECT id, 'VOTER' FROM users WHERE institutional_id = ${student.institutionalId}
            ON CONFLICT (user_id, role) DO NOTHING`,
        sql`INSERT INTO voter_eligibility (voter_id, election_id)
            SELECT id, ${election.id} FROM users WHERE institutional_id = ${student.institutionalId}
            ON CONFLICT (voter_id, election_id) DO NOTHING`,
      )
    }
    const inserted = await sql.transaction(queries)
    const importedStudents = students.map((_, index) => inserted[index * 3][0] as TokenStudentForImport)

    const deliveryResults: any[] = []
    for (let index = 0; index < importedStudents.length; index += 4) {
      const batch = importedStudents.slice(index, index + 4)
      const results = await Promise.all(batch.map(async (student) => {
        try {
          return await issueToken(sql, student)
        } catch {
          return { institutionalId: student.institutionalId, status: 'failed', detail: 'Token generation failed; use resend' }
        }
      }))
      deliveryResults.push(...results)
    }
    const sent = deliveryResults.filter((result) => result.status === 'sent').length
    return res.status(201).json({
      imported: students.length,
      sent,
      failed: students.length - sent,
      deliveryResults,
    })
  } catch (error: any) {
    return res.status(500).json({ error: 'Unable to process the voter register', detail: String(error?.message ?? error).slice(0, 200) })
  }
}

interface TokenStudentForImport {
  id: string
  institutionalId: string
  name: string
  email: string
}
