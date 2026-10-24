import { getSql } from '../_db.js'
import { recordAudit } from '../_audit.js'
import { getSessionUser, hashSessionToken, methodNotAllowed } from '../auth/_utils.js'
import { createVotingToken, decryptToken } from './_tokens.js'
import { isSmsConfigured, sendSmsToken } from './_sms.js'

const STAFF = ['super_admin', 'commissioner', 'officer']
export const config = { maxDuration: 60 }

function normalizePhone(value: string) {
  const compact = value.replace(/[\s()-]/g, '')
  if (/^0\d{9}$/.test(compact)) return `+233${compact.slice(1)}`
  return /^\+[1-9]\d{7,14}$/.test(compact) ? compact : null
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST')
  try {
    const action = String(req.body?.action ?? 'reissue')
    const sql = await getSql()

    if (action === 'delivery-report') {
      const supplied = String(req.headers['x-webhook-secret'] ?? '')
      const expected = String(process.env.SMS_WEBHOOK_SECRET ?? '')
      if (!expected || hashSessionToken(supplied) !== hashSessionToken(expected)) return res.status(401).json({ error: 'Invalid delivery-report credential' })
      const providerMessageId = String(req.body?.providerMessageId ?? '')
      const status = String(req.body?.status ?? '')
      if (!providerMessageId || !['delivered', 'failed'].includes(status)) return res.status(400).json({ error: 'Invalid delivery report' })
      const detail = String(req.body?.detail ?? '').slice(0, 180) || null
      const updated = await sql`UPDATE sms_messages SET status = ${status}, detail = ${detail},
        delivered_at = CASE WHEN ${status} = 'delivered' THEN now() ELSE delivered_at END
        WHERE provider_message_id = ${providerMessageId} RETURNING id`
      return updated[0] ? res.status(200).json({ recorded: true }) : res.status(404).json({ error: 'SMS message not found' })
    }

    const actor = await getSessionUser(req)
    if (!actor) return res.status(401).json({ error: 'Sign in required' })
    if (!actor.roles.some((role) => STAFF.includes(role))) return res.status(403).json({ error: 'Electoral staff access required' })
    const institutionalId = String(req.body?.institutionalId ?? '').trim().toUpperCase()
    const electionRef = String(req.body?.electionId ?? 'el-src-2026')

    if (action === 'correct-phone') {
      const phone = normalizePhone(String(req.body?.phone ?? ''))
      if (!institutionalId || !phone) return res.status(400).json({ error: 'A valid Student ID and telephone number are required' })
      const updated = await sql`UPDATE student_registrations r SET phone = ${phone}, phone_verified = false, updated_at = now()
        FROM users u, elections e WHERE r.user_id = u.id AND r.election_id = e.id
          AND u.institutional_id = ${institutionalId} AND (e.slug = ${electionRef} OR e.id::text = ${electionRef})
        RETURNING r.id`
      if (!updated[0]) return res.status(404).json({ error: 'Student registration not found' })
      await recordAudit(sql, { type: 'REGISTRATION_PHONE_CORRECTED', actorId: actor.id, actorLabel: actor.institutionalId,
        detail: `Telephone corrected for ${institutionalId}; verification reset.` }).catch(() => undefined)
      return res.status(200).json({ corrected: true })
    }

    if (action === 'reissue') {
      if (!institutionalId) return res.status(400).json({ error: 'Select a registered student' })
      const students = await sql`SELECT u.id, u.institutional_id AS "institutionalId", u.name,
          r.phone, e.id AS election_id, p.id AS participation_id
        FROM users u JOIN elections e ON (e.slug = ${electionRef} OR e.id::text = ${electionRef})
        JOIN voter_eligibility ve ON ve.voter_id = u.id AND ve.election_id = e.id
        JOIN student_registrations r ON r.user_id = u.id AND r.election_id = e.id
        LEFT JOIN participation_records p ON p.voter_id = u.id AND p.election_id = e.id
        WHERE u.institutional_id = ${institutionalId} AND u.is_active = true`
      const student = students[0]
      if (!student) return res.status(404).json({ error: 'Registered student not found' })
      if (student.participation_id) return res.status(409).json({ error: 'This student has already voted' })
      const generated = await createVotingToken(sql, student, student.election_id, true)
      await recordAudit(sql, { type: 'VOTING_TOKEN_REISSUED', actorId: actor.id, actorLabel: actor.institutionalId,
        electionId: student.election_id, detail: `Token ${generated.tokenId} replaced for ${institutionalId}; older tokens revoked.` }).catch(() => undefined)
      const delivery = isSmsConfigured() ? await sendSmsToken(sql, {
        tokenId: generated.tokenId, userId: student.id, electionId: student.election_id,
        institutionalId, phone: student.phone, token: generated.token,
      }) : { status: 'pending', detail: 'Ready for secure SMS export' }
      return res.status(200).json({ status: delivery.status, sent: delivery.status === 'sent' ? 1 : 0,
        failed: delivery.status === 'failed' ? 1 : 0, detail: delivery.detail })
    }

    if (action === 'send-sms') {
      if (!isSmsConfigured()) return res.status(503).json({ error: 'SMS gateway is not configured. Use the secure SMS dispatch export instead.' })
      const students = await sql`SELECT u.id, u.institutional_id AS "institutionalId", r.phone,
          e.id AS election_id, t.id AS token_id, t.encrypted_token
        FROM elections e
        JOIN voter_eligibility ve ON ve.election_id = e.id
        JOIN users u ON u.id = ve.voter_id AND u.is_active = true
        JOIN student_registrations r ON r.user_id = u.id AND r.election_id = e.id
        JOIN LATERAL (
          SELECT id, encrypted_token FROM voting_tokens vt
          WHERE vt.user_id = u.id AND vt.election_id = e.id
            AND vt.consumed_at IS NULL AND vt.invalidated_at IS NULL AND vt.expires_at > now()
          ORDER BY vt.created_at DESC LIMIT 1
        ) t ON true
        LEFT JOIN participation_records p ON p.voter_id = u.id AND p.election_id = e.id
        WHERE (e.slug = ${electionRef} OR e.id::text = ${electionRef}) AND p.id IS NULL
          AND (${institutionalId} = '' OR u.institutional_id = ${institutionalId})
          AND NOT EXISTS (
            SELECT 1 FROM sms_messages sm WHERE sm.token_id = t.id AND sm.status IN ('sent','delivered')
          )
        ORDER BY u.name LIMIT 100`
      if (!students.length) return res.status(404).json({ error: 'No registered students are waiting for SMS delivery' })
      const results = []
      for (const student of students) {
        try {
          const token = decryptToken(student.encrypted_token)
          const delivery = await sendSmsToken(sql, {
            tokenId: student.token_id, userId: student.id, electionId: student.election_id,
            institutionalId: student.institutionalId, phone: student.phone, token,
          })
          results.push({ institutionalId: student.institutionalId, ...delivery })
          await recordAudit(sql, { type: 'SMS_TOKEN_DISPATCHED', actorId: actor.id, actorLabel: actor.institutionalId,
            electionId: student.election_id, outcome: delivery.status === 'failed' ? 'failure' : 'success',
            detail: `SMS token dispatch for ${student.institutionalId}: ${delivery.status}.` }).catch(() => undefined)
        } catch {
          results.push({ institutionalId: student.institutionalId, status: 'failed', detail: 'Secure token could not be decrypted' })
        }
      }
      const sent = results.filter((result) => result.status === 'sent').length
      return res.status(200).json({ sent, failed: results.length - sent, results })
    }
    return res.status(400).json({ error: 'Unknown token-management action' })
  } catch (error: any) {
    if (error?.message === 'TOKEN_VAULT_NOT_CONFIGURED') return res.status(503).json({ error: 'Secure token storage is not configured' })
    return res.status(500).json({ error: 'Unable to process voting tokens', detail: String(error?.message ?? error).slice(0, 200) })
  }
}
