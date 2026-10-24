import { createHash, randomInt, timingSafeEqual } from 'node:crypto'
import { getSql } from './_db.js'
import { recordAudit } from './_audit.js'
import { hashSessionToken, methodNotAllowed } from './auth/_utils.js'
import { createVotingToken } from './voters/_tokens.js'
import { isSmsConfigured, sendSmsMessage } from './voters/_sms.js'

function normalizePhone(value: string) {
  const compact = value.replace(/[\s()-]/g, '')
  if (/^0\d{9}$/.test(compact)) return `+233${compact.slice(1)}`
  return /^\+[1-9]\d{7,14}$/.test(compact) ? compact : null
}

function otpHash(otp: string, userId: string, electionId: string) {
  return createHash('sha256').update(`${otp}:${userId}:${electionId}`).digest('hex')
}

async function findStudent(sql: any, institutionalId: string, electionRef: string) {
  const rows = await sql`
    SELECT u.id, u.institutional_id AS "institutionalId", u.name, u.email,
           u.department AS programme, u.year_group AS "yearGroup", e.id AS election_id,
           r.id AS registration_id, r.phone, r.phone_verified, p.id AS participation_id
    FROM elections e
    JOIN voter_eligibility ve ON ve.election_id = e.id
    JOIN users u ON u.id = ve.voter_id
    LEFT JOIN student_registrations r ON r.user_id = u.id AND r.election_id = e.id
    LEFT JOIN participation_records p ON p.voter_id = u.id AND p.election_id = e.id
    WHERE (e.slug = ${electionRef} OR e.id::text = ${electionRef})
      AND u.institutional_id = ${institutionalId} AND u.is_active = true
      AND EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role = 'VOTER')`
  return rows[0]
}

async function rateLimited(sql: any, institutionalId: string, ipHash: string) {
  await sql`DELETE FROM registration_attempts WHERE created_at < now() - interval '1 day'`
  const rows = await sql`SELECT
    count(*) FILTER (WHERE institutional_id = ${institutionalId})::int AS student_attempts,
    count(*) FILTER (WHERE ip_hash = ${ipHash})::int AS ip_attempts
    FROM registration_attempts
    WHERE succeeded = false AND created_at > now() - interval '15 minutes'`
  return (rows[0]?.student_attempts ?? 0) >= 10 || (rows[0]?.ip_attempts ?? 0) >= 50
}

async function recordAttempt(sql: any, institutionalId: string, ipHash: string, action: string, succeeded: boolean) {
  await sql`INSERT INTO registration_attempts (institutional_id, ip_hash, action, succeeded)
            VALUES (${institutionalId}, ${ipHash}, ${action}, ${succeeded})`
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST')
  try {
    const action = String(req.body?.action ?? 'lookup')
    const institutionalId = String(req.body?.institutionalId ?? '').trim().toUpperCase()
    const electionRef = String(req.body?.electionId ?? 'el-src-2026')
    if (!institutionalId || institutionalId.length > 50 || !['lookup', 'register', 'verify-otp'].includes(action)) {
      return res.status(400).json({ error: 'Enter a valid Student ID and registration action' })
    }
    const forwarded = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim()
    const ip = forwarded || String(req.socket?.remoteAddress ?? 'unknown')
    const ipHash = hashSessionToken(`${process.env.SESSION_SECRET ?? 'evote'}:${ip}`)
    const sql = await getSql()
    if (await rateLimited(sql, institutionalId, ipHash)) {
      return res.status(429).json({ error: 'Too many attempts. Wait 15 minutes before trying again.' })
    }
    const student = await findStudent(sql, institutionalId, electionRef)
    if (!student) {
      await recordAttempt(sql, institutionalId, ipHash, action, false)
      return res.status(404).json({ error: 'The Student ID was not found or is not eligible for this election' })
    }
    if (student.participation_id) return res.status(409).json({ error: 'This student has already voted' })

    if (action === 'lookup') {
      if (student.registration_id) return res.status(409).json({ error: 'This Student ID already has an active registration' })
      await recordAttempt(sql, institutionalId, ipHash, action, true)
      res.setHeader('Cache-Control', 'no-store')
      return res.status(200).json({
        student: {
          name: student.name,
          institutionalId: student.institutionalId,
          programme: student.programme || 'Not provided',
          yearGroup: student.yearGroup || 'Not provided',
        },
        otpRequired: isSmsConfigured(),
      })
    }

    if (action === 'register') {
      if (student.registration_id) return res.status(409).json({ error: 'This Student ID already has an active registration' })
      if (req.body?.confirmed !== true) return res.status(400).json({ error: 'Confirm your registered details before continuing' })
      const phone = normalizePhone(String(req.body?.phone ?? ''))
      if (!phone) return res.status(400).json({ error: 'Enter a valid active telephone number, such as 0241234567' })
      if (!isSmsConfigured() && !process.env.TOKEN_ENCRYPTION_KEY) {
        return res.status(503).json({ error: 'Secure registration is not configured. Contact the Electoral Commission.' })
      }
      const inserted = await sql`INSERT INTO student_registrations (user_id, election_id, phone, phone_verified)
        VALUES (${student.id}, ${student.election_id}, ${phone}, false)
        ON CONFLICT (user_id, election_id) DO NOTHING RETURNING id`
      if (!inserted[0]) return res.status(409).json({ error: 'This Student ID already has an active registration' })

      if (isSmsConfigured()) {
        const otp = String(randomInt(0, 1_000_000)).padStart(6, '0')
        await sql`UPDATE phone_otps SET consumed_at = now()
                  WHERE user_id = ${student.id} AND election_id = ${student.election_id} AND consumed_at IS NULL`
        await sql`INSERT INTO phone_otps (user_id, election_id, phone, otp_hash, expires_at)
                  VALUES (${student.id}, ${student.election_id}, ${phone},
                          ${otpHash(otp, student.id, student.election_id)}, now() + interval '10 minutes')`
        const delivery = await sendSmsMessage(phone, `Your School of Anaesthesia Ridge SRC registration code is ${otp}. It expires in 10 minutes.`, inserted[0].id)
        if (!delivery.ok) {
          await sql`DELETE FROM student_registrations WHERE id = ${inserted[0].id}`
          await sql`DELETE FROM phone_otps WHERE user_id = ${student.id} AND election_id = ${student.election_id}`
          return res.status(502).json({ error: 'The verification SMS could not be sent. Please try again or contact the Electoral Commission.' })
        }
        await recordAttempt(sql, institutionalId, ipHash, action, true)
        return res.status(202).json({ registered: false, verificationRequired: true, phone: phone.replace(/(\+\d{3})\d+(\d{2})/, '$1•••••$2') })
      }

      const generated = await createVotingToken(sql, student, student.election_id, true)
      await recordAttempt(sql, institutionalId, ipHash, action, true)
      await recordAudit(sql, {
        type: 'STUDENT_REGISTERED', actorId: student.id, actorLabel: institutionalId,
        electionId: student.election_id, detail: 'Student self-registered a telephone number; no ballot was cast.',
      }).catch(() => undefined)
      await recordAudit(sql, {
        type: 'VOTING_TOKEN_GENERATED', actorId: student.id, actorLabel: institutionalId,
        electionId: student.election_id, detail: `Secure token ${generated.tokenId} generated for SMS distribution.`,
      }).catch(() => undefined)
      return res.status(201).json({ registered: true, verificationRequired: false })
    }

    if (!student.registration_id || student.phone_verified) {
      return res.status(409).json({ error: 'No telephone verification is pending for this registration' })
    }
    const otp = String(req.body?.otp ?? '').trim()
    if (!/^\d{6}$/.test(otp)) return res.status(400).json({ error: 'Enter the 6-digit verification code' })
    const otps = await sql`SELECT id, otp_hash, attempts FROM phone_otps
      WHERE user_id = ${student.id} AND election_id = ${student.election_id}
        AND consumed_at IS NULL AND expires_at > now()
      ORDER BY created_at DESC LIMIT 1`
    const record = otps[0]
    if (!record || record.attempts >= 5) return res.status(401).json({ error: 'The verification code is invalid or expired' })
    const expected = Buffer.from(record.otp_hash, 'hex')
    const actual = Buffer.from(otpHash(otp, student.id, student.election_id), 'hex')
    const matches = expected.length === actual.length && timingSafeEqual(expected, actual)
    await sql`UPDATE phone_otps SET attempts = attempts + 1, consumed_at = CASE WHEN ${matches} OR attempts >= 4 THEN now() ELSE consumed_at END
              WHERE id = ${record.id}`
    if (!matches) {
      await recordAttempt(sql, institutionalId, ipHash, action, false)
      return res.status(401).json({ error: 'The verification code is invalid or expired' })
    }
    await sql`UPDATE student_registrations SET phone_verified = true, updated_at = now() WHERE id = ${student.registration_id}`
    const generated = await createVotingToken(sql, student, student.election_id, true)
    await recordAttempt(sql, institutionalId, ipHash, action, true)
    await recordAudit(sql, {
      type: 'STUDENT_REGISTERED', actorId: student.id, actorLabel: institutionalId,
      electionId: student.election_id, detail: 'Student telephone verified and registration completed; no ballot was cast.',
    }).catch(() => undefined)
    await recordAudit(sql, {
      type: 'VOTING_TOKEN_GENERATED', actorId: student.id, actorLabel: institutionalId,
      electionId: student.election_id, detail: `Secure token ${generated.tokenId} generated after telephone verification.`,
    }).catch(() => undefined)
    return res.status(201).json({ registered: true, verificationRequired: false })
  } catch (error: any) {
    if (error?.message === 'TOKEN_VAULT_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'Secure token storage is not configured. Contact the Electoral Commission.' })
    }
    return res.status(500).json({ error: 'Registration is temporarily unavailable', detail: String(error?.message ?? error).slice(0, 200) })
  }
}
