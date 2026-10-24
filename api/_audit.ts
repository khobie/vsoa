import { createHash, randomBytes } from 'node:crypto'

export async function recordAudit(sql: any, event: {
  type: string
  actorId?: string | null
  actorLabel?: string
  electionId?: string | null
  outcome?: 'success' | 'failure' | 'warning'
  detail: string
}) {
  const previous = await sql`SELECT hash FROM audit_events ORDER BY created_at DESC LIMIT 1`
  const prevHash = previous[0]?.hash ?? 'GENESIS'
  const hash = createHash('sha256').update([
    prevHash, event.type, event.actorId ?? '', event.electionId ?? '',
    event.outcome ?? 'success', event.detail, new Date().toISOString(), randomBytes(16).toString('hex'),
  ].join('|')).digest('hex')
  await sql`INSERT INTO audit_events
    (type, actor_id, actor_label, election_id, outcome, detail, prev_hash, hash)
    VALUES (${event.type}, ${event.actorId ?? null}, ${event.actorLabel ?? 'system'},
            ${event.electionId ?? null}, ${event.outcome ?? 'success'}, ${event.detail}, ${prevHash}, ${hash})`
}
