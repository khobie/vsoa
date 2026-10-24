import { DDL_STATEMENTS } from '../_schema-sql.js'

const TEST_STUDENT = 'TEST-VOTER-2026'
const TEST_ELECTION = 'el-system-verification-2026'

async function removeTestElection(sql: any) {
  const rows = await sql`SELECT id FROM elections WHERE slug = ${TEST_ELECTION}`
  const electionId = rows[0]?.id
  if (!electionId) return
  await sql`DELETE FROM ballot_selections WHERE position_id IN (SELECT id FROM positions WHERE election_id = ${electionId})`
  await sql`DELETE FROM audit_events WHERE election_id = ${electionId}`
  await sql`DELETE FROM candidates WHERE position_id IN (SELECT id FROM positions WHERE election_id = ${electionId})`
  await sql`DELETE FROM positions WHERE election_id = ${electionId}`
  await sql`DELETE FROM elections WHERE id = ${electionId}`
}

export async function runTemporaryAction(sql: any, action: string) {
  if (action === 'migrate') {
    for (const statement of DDL_STATEMENTS) await sql.query(statement)
    return { status: 200, body: { migrated: true, statements: DDL_STATEMENTS.length } }
  }

  if (action === 'test-setup') {
    await removeTestElection(sql)
    const elections = await sql`INSERT INTO elections
      (slug, name, organization, description, status, start_at, end_at)
      VALUES (${TEST_ELECTION}, 'SYSTEM VERIFICATION — DELETE', 'Synthetic test only',
              'Temporary election for automated verification.', 'OPEN', now() - interval '5 minutes', now() + interval '2 hours')
      RETURNING id`
    const electionId = elections[0].id
    const positions = await sql`INSERT INTO positions (election_id, title, sort_order)
      VALUES (${electionId}, 'Synthetic Test Position', 0) RETURNING id`
    const positionId = positions[0].id
    const candidates = await sql`INSERT INTO candidates (position_id, name, status)
      VALUES (${positionId}, 'Synthetic Candidate', 'APPROVED') RETURNING id`
    const candidateId = candidates[0].id
    const eligible = await sql`INSERT INTO voter_eligibility (voter_id, election_id)
      SELECT id, ${electionId} FROM users WHERE institutional_id = ${TEST_STUDENT}
      ON CONFLICT (voter_id, election_id) DO NOTHING RETURNING id`
    if (!eligible[0]) throw new Error('Synthetic student must be imported before test setup')
    return { status: 200, body: { electionId: TEST_ELECTION, positionId, candidateId } }
  }

  if (action === 'test-verify') {
    const counts = await sql`SELECT
      (SELECT count(*) FROM participation_records p JOIN elections e ON e.id = p.election_id WHERE e.slug = ${TEST_ELECTION})::int AS participation,
      (SELECT count(*) FROM anonymous_ballots b JOIN elections e ON e.id = b.election_id WHERE e.slug = ${TEST_ELECTION})::int AS ballots,
      (SELECT count(*) FROM ballot_selections s JOIN positions p ON p.id = s.position_id JOIN elections e ON e.id = p.election_id WHERE e.slug = ${TEST_ELECTION})::int AS selections`
    const identityColumns = await sql`SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name IN ('anonymous_ballots', 'ballot_selections')
        AND column_name IN ('voter_id', 'user_id', 'institutional_id', 'receipt_hash')`
    return { status: 200, body: { counts: counts[0], identityColumns } }
  }

  if (action === 'test-cleanup') {
    await removeTestElection(sql)
    await sql`DELETE FROM audit_events WHERE actor_label = ${TEST_STUDENT} OR detail ILIKE ${'%' + TEST_STUDENT + '%'}`
    await sql`DELETE FROM registration_attempts WHERE institutional_id = ${TEST_STUDENT}`
    await sql`DELETE FROM voter_login_attempts WHERE institutional_id = ${TEST_STUDENT}`
    await sql`DELETE FROM security_events WHERE subject = ${TEST_STUDENT}`
    const removed = await sql`DELETE FROM users WHERE institutional_id = ${TEST_STUDENT} RETURNING id`
    return { status: 200, body: { cleaned: true, syntheticStudentRemoved: Boolean(removed[0]) } }
  }

  return null
}
