import { createHash, randomBytes } from 'node:crypto'
import { getSql } from '../_db.js'
import { getSessionUser, methodNotAllowed } from '../auth/_utils.js'

interface IncomingSelection {
  positionId: string
  candidateId: string | null
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST')
  try {
    const user = await getSessionUser(req)
    if (!user) return res.status(401).json({ error: 'Sign in with your Student ID and voting token' })
    if (!user.roles.includes('voter')) return res.status(403).json({ error: 'Only eligible students can submit a ballot' })

    const electionRef = String(req.body?.electionId ?? '')
    const selections = Array.isArray(req.body?.selections) ? req.body.selections : []
    if (!electionRef || !selections.length || selections.length > 30) {
      return res.status(400).json({ error: 'A complete ballot is required' })
    }

    const sql = await getSql()
    const elections = await sql`
      SELECT id, slug, status, start_at, end_at FROM elections
      WHERE slug = ${electionRef} OR id::text = ${electionRef}`
    const election = elections[0]
    if (!election) return res.status(404).json({ error: 'Election not found' })
    if (election.status !== 'OPEN') return res.status(403).json({ error: 'This election is not open for voting' })

    const timing = await sql`
      SELECT (now() >= ${election.start_at} AND now() <= ${election.end_at}) AS open`
    if (!timing[0]?.open) return res.status(403).json({ error: 'Voting is not within the published opening and closing times' })

    const eligibility = await sql`
      SELECT id FROM voter_eligibility WHERE voter_id = ${user.id} AND election_id = ${election.id}`
    if (!eligibility[0]) return res.status(403).json({ error: 'Your Student ID is not on the eligible register for this election' })

    const existing = await sql`
      SELECT id FROM participation_records WHERE voter_id = ${user.id} AND election_id = ${election.id}`
    if (existing[0]) return res.status(409).json({ error: 'Your ballot has already been accepted for this election' })

    const positions = await sql`
      SELECT id, allow_abstain FROM positions WHERE election_id = ${election.id}`
    const candidates = await sql`
      SELECT c.id, c.position_id FROM candidates c
      JOIN positions p ON p.id = c.position_id
      WHERE p.election_id = ${election.id} AND c.status = 'APPROVED'`
    const positionMap = new Map(positions.map((position: any) => [position.id, position]))
    const candidateMap = new Map(candidates.map((candidate: any) => [candidate.id, candidate.position_id]))
    if (!positions.length || selections.length !== positions.length) {
      return res.status(400).json({ error: 'Select a candidate or abstain for every position' })
    }

    const seen = new Set<string>()
    const normalized: IncomingSelection[] = selections.map((selection: any) => {
      const positionId = String(selection?.positionId ?? '')
      const candidateId = selection?.candidateId === null ? null : String(selection?.candidateId ?? '')
      const position = positionMap.get(positionId)
      if (!position || seen.has(positionId)) throw new Error('INVALID_BALLOT')
      seen.add(positionId)
      if (candidateId === null) {
        if (!position.allow_abstain) throw new Error('INVALID_BALLOT')
      } else if (candidateMap.get(candidateId) !== positionId) {
        throw new Error('INVALID_BALLOT')
      }
      return { positionId, candidateId }
    })

    const receiptCode = `SAR-${randomBytes(6).toString('hex').toUpperCase()}`
    const receiptHash = createHash('sha256').update(receiptCode).digest('hex')
    const ballotRef = randomBytes(32).toString('base64url')

    // Participation identifies WHO voted. The ballot contains only WHAT was voted.
    // There is deliberately no voter ID, receipt, or participation foreign key on either ballot table.
    const committed = await sql.transaction([
      sql`INSERT INTO participation_records (voter_id, election_id, receipt_hash)
          VALUES (${user.id}, ${election.id}, ${receiptHash})
          RETURNING accepted_at AS "acceptedAt"`,
      sql`WITH ballot AS (
            INSERT INTO anonymous_ballots (election_id, ballot_ref)
            VALUES (${election.id}, ${ballotRef}) RETURNING id
          ), incoming AS (
            SELECT * FROM jsonb_to_recordset(${JSON.stringify(normalized)}::jsonb)
            AS selection("positionId" uuid, "candidateId" uuid)
          )
          INSERT INTO ballot_selections (ballot_id, position_id, candidate_id)
          SELECT ballot.id, incoming."positionId", incoming."candidateId"
          FROM ballot CROSS JOIN incoming
          RETURNING id`,
    ])
    if (committed[1].length !== positions.length) throw new Error('Incomplete ballot transaction')

    res.setHeader('Cache-Control', 'no-store')
    return res.status(201).json({ receiptCode, acceptedAt: committed[0][0].acceptedAt })
  } catch (error: any) {
    if (error?.code === '23505' || String(error?.message).includes('participation_records_voter_id_election_id_key')) {
      return res.status(409).json({ error: 'Your ballot has already been accepted for this election' })
    }
    if (error?.message === 'INVALID_BALLOT') {
      return res.status(400).json({ error: 'The ballot contains an invalid or duplicate selection' })
    }
    return res.status(500).json({ error: 'Your ballot was not accepted. No vote was recorded; please try again.', detail: String(error?.message ?? error).slice(0, 200) })
  }
}
