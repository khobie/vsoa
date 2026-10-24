import { createHash, randomBytes } from 'node:crypto'

interface TokenStudent {
  id: string
  institutionalId: string
  name: string
  email: string
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] ?? character)
}

function tokenExpiryHours() {
  const configured = Number(process.env.VOTING_TOKEN_HOURS ?? 72)
  return Number.isFinite(configured) ? Math.min(720, Math.max(1, configured)) : 72
}

async function emailToken(student: TokenStudent, token: string) {
  const apiKey = process.env.RESEND_API_KEY || process.env.EMAIL_API_KEY
  const from = process.env.EMAIL_FROM
  if (!apiKey || !from) {
    return { ok: false, detail: 'Email service is not configured', messageId: null }
  }

  const school = process.env.INSTITUTION_NAME || 'School of Anaesthesia Ridge'
  const safeName = escapeHtml(student.name)
  const safeId = escapeHtml(student.institutionalId)
  const safeToken = escapeHtml(token)
  const text = [
    `Hello ${student.name},`,
    '',
    `Your ${school} SRC voting credentials are:`,
    `Student ID: ${student.institutionalId}`,
    `Voting token: ${token}`,
    '',
    `This token expires in ${tokenExpiryHours()} hours and can be used only once to sign in.`,
    'Keep it private. Electoral staff will never ask you to reveal your ballot choices.',
    '',
    'Use your Student ID and this token on the election sign-in page.',
  ].join('\n')

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [student.email],
        subject: `Your secure SRC voting token — ${school}`,
        text,
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#172554"><h2>Your secure SRC voting token</h2><p>Hello ${safeName},</p><p>Use these credentials to sign in to the ${escapeHtml(school)} election:</p><div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:20px;margin:20px 0"><p><strong>Student ID:</strong> ${safeId}</p><p><strong>Voting token:</strong></p><p style="font-family:monospace;font-size:20px;word-break:break-all;color:#166534"><strong>${safeToken}</strong></p></div><p>This token expires in ${tokenExpiryHours()} hours and can be used only once to sign in. Keep it private.</p><p style="font-size:13px;color:#64748b">Your voting token authenticates you. It never reveals or records your candidate selections.</p></div>`,
      }),
    })
    const data = await response.json().catch(() => ({})) as { id?: string; message?: string; error?: string }
    if (!response.ok) {
      return { ok: false, detail: String(data.message || data.error || `Email provider returned ${response.status}`).slice(0, 180), messageId: null }
    }
    return { ok: true, detail: null, messageId: data.id ?? null }
  } catch {
    return { ok: false, detail: 'Email provider could not be reached', messageId: null }
  }
}

/** Issues a replacement token, invalidates every older token, then emails it. */
export async function issueToken(sql: any, student: TokenStudent) {
  const token = randomBytes(32).toString('base64url')
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const hours = tokenExpiryHours()
  const inserted = await sql.transaction([
    sql`UPDATE voting_tokens
        SET invalidated_at = now(), invalidated_reason = 'REPLACED'
        WHERE user_id = ${student.id} AND consumed_at IS NULL AND invalidated_at IS NULL`,
    sql`INSERT INTO voting_tokens (user_id, token_hash, expires_at)
        VALUES (${student.id}, ${tokenHash}, now() + make_interval(hours => ${hours}))
        RETURNING id`,
  ])
  const tokenId = inserted[1][0]?.id
  if (!tokenId) throw new Error('Token could not be created')

  const delivery = await emailToken(student, token)
  await sql`UPDATE voting_tokens
    SET delivery_status = ${delivery.ok ? 'sent' : 'failed'},
        delivery_detail = ${delivery.detail}, email_message_id = ${delivery.messageId},
        last_sent_at = now()
    WHERE id = ${tokenId}`
  return { institutionalId: student.institutionalId, status: delivery.ok ? 'sent' : 'failed', detail: delivery.detail }
}
