import { createHash, randomBytes } from 'node:crypto'
import { getSql } from '../_db.js'
import { DDL_STATEMENTS } from '../_schema-sql.js'
import { getSessionUser, methodNotAllowed } from '../auth/_utils.js'

const TEST_ID = 'TEST-VOTER-2026'
const TEST_ELECTION = 'test-voter-workflow-2026'
export const config = { maxDuration: 60 }

async function issueKnownToken(sql: any, userId: string) {
  const token = randomBytes(32).toString('base64url')
  const hash = createHash('sha256').update(token).digest('hex')
  await sql.transaction([
    sql`UPDATE voting_tokens SET invalidated_at = now(), invalidated_reason = 'SECURITY_TEST'
        WHERE user_id = ${userId} AND consumed_at IS NULL AND invalidated_at IS NULL`,
    sql`INSERT INTO voting_tokens (user_id, token_hash, expires_at, delivery_status)
        VALUES (${userId}, ${hash}, now() + interval '1 hour', 'failed')`,
  ])
  return token
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST')
  try {
    const actor = await getSessionUser(req)
    if (!actor) return res.status(401).json({ error: 'Sign in required' })
    if (!actor.roles.some((role) => role === 'super_admin' || role === 'commissioner')) {
      return res.status(403).json({ error: 'Commissioner access required' })
    }
    const sql = await getSql()
    const action = String(req.body?.action ?? 'migrate')

    if (action === 'migrate') {
      for (const statement of DDL_STATEMENTS) await sql.query(statement)
      return res.status(200).json({ migrated: true, statements: DDL_STATEMENTS.length })
    }

    const users = await sql`SELECT id FROM users WHERE institutional_id = ${TEST_ID}`
    const userId = users[0]?.id
    if (action === 'setup') {
      if (!userId) return res.status(400).json({ error: 'Import the synthetic test student first' })
      await sql`DELETE FROM elections WHERE slug = ${TEST_ELECTION}`
      const election = await sql`INSERT INTO elections
        (slug, name, organization, status, start_at, end_at)
        VALUES (${TEST_ELECTION}, 'Temporary Security Test', 'System Test', 'OPEN', now() - interval '1 hour', now() + interval '1 hour')
        RETURNING id`
      const position = await sql`INSERT INTO positions (election_id, title, sort_order)
        VALUES (${election[0].id}, 'Test Position', 0) RETURNING id`
      const candidate = await sql`INSERT INTO candidates (position_id, name, status)
        VALUES (${position[0].id}, 'Test Candidate', 'APPROVED') RETURNING id`
      await sql`INSERT INTO voter_eligibility (voter_id, election_id) VALUES (${userId}, ${election[0].id})`
      const token = await issueKnownToken(sql, userId)
      return res.status(200).json({ token, electionId: TEST_ELECTION, positionId: position[0].id, candidateId: candidate[0].id })
    }
    if (action === 'refresh-token') {
      if (!userId) return res.status(400).json({ error: 'Synthetic test student not found' })
      return res.status(200).json({ token: await issueKnownToken(sql, userId) })
    }
    if (action === 'verify') {
      const counts = await sql`SELECT
        (SELECT count(*)::int FROM participation_records pr JOIN elections e ON e.id = pr.election_id
         WHERE pr.voter_id = ${userId} AND e.slug = ${TEST_ELECTION}) AS participation,
        (SELECT count(*)::int FROM anonymous_ballots ab JOIN elections e ON e.id = ab.election_id
         WHERE e.slug = ${TEST_ELECTION}) AS ballots,
        (SELECT count(*)::int FROM ballot_selections bs JOIN anonymous_ballots ab ON ab.id = bs.ballot_id
         JOIN elections e ON e.id = ab.election_id WHERE e.slug = ${TEST_ELECTION}) AS selections`
      return res.status(200).json(counts[0])
    }
    if (action === 'cleanup') {
      await sql`DELETE FROM elections WHERE slug = ${TEST_ELECTION}`
      await sql`DELETE FROM users WHERE institutional_id = ${TEST_ID}`
      return res.status(200).json({ cleaned: true })
    }
    return res.status(400).json({ error: 'Unknown action' })
  } catch (error: any) {
    return res.status(500).json({ error: 'Administration request failed', detail: String(error?.message ?? error).slice(0, 200) })
  }
}
