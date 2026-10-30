import { createHash, randomBytes } from 'node:crypto'
import { getSql } from '../_db.js'
import { recordAudit } from '../_audit.js'
import { getSessionUser, hashPassword, methodNotAllowed } from '../auth/_utils.js'
import { decryptToken, tokenExpiryHours } from './_tokens.js'
import { isSmsConfigured } from './_sms.js'

const STAFF = ['super_admin']
const DEFAULT_ELECTION = 'el-src-2026'

interface ImportStudent {
  institutionalId: string
  name: string
  email: string
  faculty: string
  department: string
  yearGroup: string
}

function normalizeStudent(raw: any, index: number) {
  const student: ImportStudent = {
    institutionalId: String(raw?.institutionalId ?? raw?.studentId ?? '').trim().toUpperCase(),
    name: String(raw?.name ?? '').trim().replace(/\s+/g, ' '),
    email: String(raw?.email ?? '').trim().toLowerCase(),
    faculty: String(raw?.faculty ?? 'School of Anaesthesia Ridge').trim(),
    department: String(raw?.department ?? raw?.programme ?? '').trim(),
    yearGroup: String(raw?.yearGroup ?? '').trim(),
  }
  if (!student.institutionalId || student.institutionalId.length > 50) return { error: `Row ${index + 1}: a valid Student ID is required` }
  if (student.name.length < 3 || student.name.length > 120) return { error: `Row ${index + 1}: enter the student's full name` }
  if (student.email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(student.email) || student.email.length > 200)) {
    return { error: `Row ${index + 1}: enter a valid email or leave it blank` }
  }
  if (!student.email) {
    const idHash = createHash('sha256').update(student.institutionalId).digest('hex')
    student.email = `${idHash}@no-email.local`
  }
  if (student.faculty.length > 120 || student.department.length > 120 || student.yearGroup.length > 50) return { error: `Row ${index + 1}: a detail field is too long` }
  return { student }
}

async function staffUser(req: any) {
  const user = await getSessionUser(req)
  if (!user) return { error: 'Sign in required', status: 401 }
  if (!user.roles.some((role) => STAFF.includes(role))) return { error: 'Electoral staff access required', status: 403 }
  return { user }
}

function csvCell(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

export const config = { maxDuration: 60 }

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') return methodNotAllowed(res, 'GET, POST')
  try {
    const access = await staffUser(req)
    if ('error' in access) return res.status(access.status).json({ error: access.error })
    const sql = await getSql()

    if (req.method === 'GET' && req.query?.view === 'audit') {
      const events = await sql`SELECT a.id, a.type, a.created_at AS timestamp,
        COALESCE(a.actor_label, 'system') AS actor, e.slug AS "electionId", a.outcome, a.detail
        FROM audit_events a LEFT JOIN elections e ON e.id = a.election_id
        ORDER BY a.created_at DESC LIMIT 200`
      res.setHeader('Cache-Control', 'no-store')
      return res.status(200).json({ events })
    }

    const electionRef = String(req.method === 'GET' ? req.query?.electionId ?? DEFAULT_ELECTION : req.body?.electionId ?? DEFAULT_ELECTION)
    const elections = await sql`SELECT id, slug FROM elections WHERE slug = ${electionRef} OR id::text = ${electionRef}`
    const election = elections[0]
    if (!election) return res.status(404).json({ error: 'Election not found' })

    if (req.method === 'GET' && req.query?.export === 'sms') {
      const students = await sql`SELECT u.institutional_id, u.name, r.phone, t.id, t.encrypted_token,
        (SELECT sm.status FROM sms_messages sm WHERE sm.token_id = t.id ORDER BY sm.created_at DESC LIMIT 1) AS sms_status
        FROM student_registrations r
        JOIN users u ON u.id = r.user_id
        JOIN voting_tokens t ON t.user_id = r.user_id AND t.election_id = r.election_id
        LEFT JOIN participation_records p ON p.voter_id = r.user_id AND p.election_id = r.election_id
        WHERE r.election_id = ${election.id} AND p.id IS NULL
          AND t.consumed_at IS NULL AND t.invalidated_at IS NULL AND t.expires_at > now()
        ORDER BY u.name`
      const lines = ['student_id,full_name,telephone,voting_token,message,sms_status']
      for (const student of students) {
        const token = decryptToken(student.encrypted_token)
        const message = `School of Anaesthesia Ridge SRC | Student ID: ${student.institutional_id} | Voting token: ${token} | Expires in ${tokenExpiryHours()} hours. Use once to sign in.`
        lines.push([student.institutional_id, student.name, student.phone, token, message, student.sms_status || 'pending'].map(csvCell).join(','))
      }
      await recordAudit(sql, { type: 'SMS_DISPATCH_LIST_EXPORTED', actorId: access.user.id,
        actorLabel: access.user.institutionalId, electionId: election.id,
        detail: `${students.length} encrypted token record(s) decrypted for authorized SMS export.` }).catch(() => undefined)
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', 'attachment; filename="src-sms-dispatch.csv"')
      res.setHeader('Cache-Control', 'no-store')
      return res.status(200).send(lines.join('\r\n'))
    }

    if (req.method === 'GET') {
      const voters = await sql`
        SELECT u.id, u.institutional_id AS "institutionalId", u.name, u.email,
               u.faculty, u.department, u.year_group AS "yearGroup", u.is_active AS "isActive",
               r.phone, r.phone_verified AS "phoneVerified", r.registered_at AS "registeredAt",
               t.id AS "tokenId", t.created_at AS "tokenCreatedAt", t.expires_at AS "tokenExpiresAt",
               t.consumed_at AS "tokenConsumedAt", t.invalidated_at AS "tokenInvalidatedAt",
               sm.status AS "smsStatus", sm.detail AS "smsDetail", sm.sent_at AS "smsSentAt",
               pr.accepted_at AS "votedAt"
        FROM voter_eligibility ve
        JOIN users u ON u.id = ve.voter_id
        LEFT JOIN student_registrations r ON r.user_id = u.id AND r.election_id = ve.election_id
        LEFT JOIN LATERAL (
          SELECT id, created_at, expires_at, consumed_at, invalidated_at
          FROM voting_tokens vt WHERE vt.user_id = u.id AND vt.election_id = ve.election_id
          ORDER BY created_at DESC LIMIT 1
        ) t ON true
        LEFT JOIN LATERAL (
          SELECT status, detail, sent_at FROM sms_messages sm
          WHERE sm.token_id = t.id ORDER BY sm.created_at DESC LIMIT 1
        ) sm ON true
        LEFT JOIN participation_records pr ON pr.voter_id = u.id AND pr.election_id = ve.election_id
        WHERE ve.election_id = ${election.id}
        ORDER BY u.name`
      const voted = voters.filter((voter: any) => voter.votedAt).length
      const summary = {
        total: voters.length,
        registered: voters.filter((voter: any) => voter.registeredAt).length,
        tokensGenerated: voters.filter((voter: any) => voter.tokenCreatedAt).length,
        sent: voters.filter((voter: any) => ['sent', 'delivered'].includes(voter.smsStatus)).length,
        delivered: voters.filter((voter: any) => voter.smsStatus === 'delivered').length,
        failed: voters.filter((voter: any) => voter.smsStatus === 'failed').length,
        pending: voters.filter((voter: any) => voter.tokenCreatedAt && !voter.smsStatus).length,
        voted,
        turnout: voters.length ? Math.round((voted / voters.length) * 1000) / 10 : 0,
      }
      res.setHeader('Cache-Control', 'no-store')
      return res.status(200).json({ voters, summary, smsConfigured: isSmsConfigured() })
    }

    if (req.body?.action === 'export-selected-tokens') {
      const requested = Array.isArray(req.body?.voterIds) ? req.body.voterIds : []
      const voterIds = [...new Set(requested.map((id: unknown) => String(id)))]
      if (!voterIds.length || voterIds.length > 500) {
        return res.status(400).json({ error: 'Select between 1 and 500 students for token export' })
      }
      if (voterIds.some((id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))) {
        return res.status(400).json({ error: 'The selected voter identifiers are invalid' })
      }
      const students = await sql`
        SELECT u.id, u.institutional_id, u.name, u.department, u.year_group, r.phone,
               t.id, t.encrypted_token,
          (SELECT sm.status FROM sms_messages sm WHERE sm.token_id = t.id ORDER BY sm.created_at DESC LIMIT 1) AS sms_status
        FROM student_registrations r
        JOIN users u ON u.id = r.user_id AND u.is_active = true
        JOIN voting_tokens t ON t.user_id = r.user_id AND t.election_id = r.election_id
        LEFT JOIN participation_records p ON p.voter_id = r.user_id AND p.election_id = r.election_id
        WHERE r.election_id = ${election.id} AND u.id = ANY(${voterIds}::uuid[]) AND p.id IS NULL
          AND t.consumed_at IS NULL AND t.invalidated_at IS NULL AND t.expires_at > now()
        ORDER BY u.name`
      if (!students.length) {
        return res.status(404).json({ error: 'None of the selected students has a valid, unused voting token available for export' })
      }
      const lines = ['student_id,full_name,programme,year_group,telephone,voting_token,message,sms_status']
      for (const student of students) {
        const token = decryptToken(student.encrypted_token)
        const message = `School of Anaesthesia Ridge SRC | Student ID: ${student.institutional_id} | Voting token: ${token} | Expires in ${tokenExpiryHours()} hours. Use once to sign in.`
        lines.push([
          student.institutional_id, student.name, student.department || '', student.year_group || '',
          student.phone, token, message, student.sms_status || 'pending',
        ].map(csvCell).join(','))
      }
      await recordAudit(sql, {
        type: 'SELECTED_VOTING_TOKENS_EXPORTED', actorId: access.user.id,
        actorLabel: access.user.institutionalId, electionId: election.id,
        detail: `${students.length} selected voting token(s) decrypted for authorized administrator export.`,
      }).catch(() => undefined)
      res.setHeader('Cache-Control', 'no-store')
      return res.status(200).json({
        csv: lines.join('\r\n'),
        exported: students.length,
        skipped: voterIds.length - students.length,
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

    const existing = await sql`SELECT institutional_id, email FROM users
      WHERE institutional_id = ANY(${students.map((student) => student.institutionalId)})
         OR email = ANY(${students.map((student) => student.email)})`
    const emailOwners = new Map(existing.map((row: any) => [row.email, row.institutional_id]))
    for (const student of students) {
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
            RETURNING id`,
        sql`INSERT INTO user_roles (user_id, role)
            SELECT id, 'VOTER' FROM users WHERE institutional_id = ${student.institutionalId}
            ON CONFLICT (user_id, role) DO NOTHING`,
        sql`INSERT INTO voter_eligibility (voter_id, election_id)
            SELECT id, ${election.id} FROM users WHERE institutional_id = ${student.institutionalId}
            ON CONFLICT (voter_id, election_id) DO NOTHING`,
      )
    }
    await sql.transaction(queries)
    await recordAudit(sql, { type: 'VOTER_REGISTER_IMPORTED', actorId: access.user.id,
      actorLabel: access.user.institutionalId, electionId: election.id,
      detail: `${students.length} eligible student record(s) imported or updated.` }).catch(() => undefined)
    return res.status(201).json({ imported: students.length })
  } catch (error: any) {
    return res.status(500).json({ error: 'Unable to process the voter register', detail: String(error?.message ?? error).slice(0, 200) })
  }
}
