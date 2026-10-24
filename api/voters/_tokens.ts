import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

interface TokenStudent {
  id: string
  institutionalId: string
  name: string
  email?: string
}

function encryptionKey() {
  const value = process.env.TOKEN_ENCRYPTION_KEY
  if (!value) return null
  const key = Buffer.from(value, 'base64')
  return key.length === 32 ? key : null
}

export function tokenExpiryHours() {
  const configured = Number(process.env.VOTING_TOKEN_HOURS ?? 72)
  return Number.isFinite(configured) ? Math.min(720, Math.max(1, configured)) : 72
}

function encryptToken(token: string) {
  const key = encryptionKey()
  if (!key) return null
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.')
}

export function decryptToken(payload: string) {
  const key = encryptionKey()
  const [version, iv, tag, encrypted] = String(payload ?? '').split('.')
  if (!key || version !== 'v1' || !iv || !tag || !encrypted) throw new Error('Secure token vault is unavailable')
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8')
}

/** Creates a unique election token, revokes its predecessors, and optionally encrypts it for SMS dispatch. */
export async function createVotingToken(sql: any, student: TokenStudent, electionId: string, requireEncryption = false) {
  const token = randomBytes(32).toString('base64url')
  const encryptedToken = encryptToken(token)
  if (requireEncryption && !encryptedToken) throw new Error('TOKEN_VAULT_NOT_CONFIGURED')
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const inserted = await sql.transaction([
    sql`UPDATE voting_tokens
        SET invalidated_at = now(), invalidated_reason = 'REPLACED'
        WHERE user_id = ${student.id} AND election_id = ${electionId}
          AND consumed_at IS NULL AND invalidated_at IS NULL`,
    sql`INSERT INTO voting_tokens (user_id, election_id, token_hash, encrypted_token, expires_at)
        VALUES (${student.id}, ${electionId}, ${tokenHash}, ${encryptedToken}, now() + make_interval(hours => ${tokenExpiryHours()}))
        RETURNING id`,
  ])
  const tokenId = inserted[1][0]?.id
  if (!tokenId) throw new Error('Token could not be created')
  return { token, tokenId, institutionalId: student.institutionalId }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] ?? character)
}

async function emailToken(student: TokenStudent, token: string) {
  const apiKey = process.env.RESEND_API_KEY || process.env.EMAIL_API_KEY
  const from = process.env.EMAIL_FROM
  if (!apiKey || !from || !student.email) return { ok: false, detail: 'Email service is not configured', messageId: null }
  const school = process.env.INSTITUTION_NAME || 'School of Anaesthesia Ridge'
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [student.email],
        subject: `Your secure SRC voting token — ${school}`,
        text: `Hello ${student.name},\n\nStudent ID: ${student.institutionalId}\nVoting token: ${token}\n\nThis token expires in ${tokenExpiryHours()} hours and can be used once to sign in.`,
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#172554"><h2>Your secure SRC voting token</h2><p>Hello ${escapeHtml(student.name)},</p><p><strong>Student ID:</strong> ${escapeHtml(student.institutionalId)}</p><p style="font-family:monospace;font-size:20px;word-break:break-all;color:#166534"><strong>${escapeHtml(token)}</strong></p><p>This token expires in ${tokenExpiryHours()} hours and can be used only once to sign in.</p></div>`,
      }),
    })
    const data = await response.json().catch(() => ({})) as { id?: string; message?: string; error?: string }
    if (!response.ok) return { ok: false, detail: String(data.message || data.error || `Email provider returned ${response.status}`).slice(0, 180), messageId: null }
    return { ok: true, detail: null, messageId: data.id ?? null }
  } catch {
    return { ok: false, detail: 'Email provider could not be reached', messageId: null }
  }
}

/** Legacy email delivery remains available to administrators as a fallback. */
export async function issueToken(sql: any, student: TokenStudent, electionId: string) {
  const generated = await createVotingToken(sql, student, electionId)
  const delivery = await emailToken(student, generated.token)
  await sql`UPDATE voting_tokens
    SET delivery_status = ${delivery.ok ? 'sent' : 'failed'}, delivery_detail = ${delivery.detail},
        email_message_id = ${delivery.messageId}, last_sent_at = now()
    WHERE id = ${generated.tokenId}`
  return { institutionalId: student.institutionalId, status: delivery.ok ? 'sent' : 'failed', detail: delivery.detail }
}
