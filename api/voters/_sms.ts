import { tokenExpiryHours } from './_tokens.js'

export function isSmsConfigured() {
  return Boolean(process.env.SMS_WEBHOOK_URL && process.env.SMS_WEBHOOK_SECRET && process.env.SMS_SENDER_ID)
}

export async function sendSmsMessage(phone: string, message: string, reference?: string) {
  if (!isSmsConfigured()) return { ok: false, providerMessageId: null, detail: 'SMS gateway is not configured' }
  try {
    const response = await fetch(String(process.env.SMS_WEBHOOK_URL), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.SMS_WEBHOOK_SECRET}` },
      body: JSON.stringify({ to: phone, from: process.env.SMS_SENDER_ID, message, reference }),
      signal: AbortSignal.timeout(10_000),
    })
    const data = await response.json().catch(() => ({})) as { id?: string; message_id?: string; message?: string; error?: string }
    if (!response.ok) return { ok: false, providerMessageId: null, detail: String(data.message || data.error || `SMS gateway returned ${response.status}`).slice(0, 180) }
    return { ok: true, providerMessageId: data.id || data.message_id || null, detail: null }
  } catch {
    return { ok: false, providerMessageId: null, detail: 'SMS gateway could not be reached' }
  }
}

export async function sendSmsToken(sql: any, input: {
  tokenId: string
  userId: string
  electionId: string
  institutionalId: string
  phone: string
  token: string
}) {
  if (!isSmsConfigured()) return { status: 'pending', detail: 'SMS gateway is not configured' }
  const message = `School of Anaesthesia Ridge SRC\nStudent ID: ${input.institutionalId}\nVoting token: ${input.token}\nExpires in ${tokenExpiryHours()} hours. Use once to sign in. Keep it private.`
  const delivery = await sendSmsMessage(input.phone, message, input.tokenId)
  const status = delivery.ok ? 'sent' : 'failed'
  await sql`INSERT INTO sms_messages
    (token_id, user_id, election_id, provider_message_id, status, detail, sent_at)
    VALUES (${input.tokenId}, ${input.userId}, ${input.electionId}, ${delivery.providerMessageId}, ${status}, ${delivery.detail},
            ${delivery.ok ? new Date().toISOString() : null})`
  return { status, detail: delivery.detail, providerMessageId: delivery.providerMessageId }
}
