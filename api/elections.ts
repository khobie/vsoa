import { getSql } from '../_db'

/**
 * GET /api/elections
 * Public-safe election list: approved candidates only, no voter data,
 * no vote totals unless the election is PUBLISHED (totals come from the
 * verified tally record, never from raw ballots).
 */
export default async function handler(_req: any, res: any) {
  try {
    const sql = await getSql()

    const elections = await sql`
      SELECT id, slug, name, organization, description, status, timezone,
             start_at AS "startAt", end_at AS "endAt"
      FROM elections
      ORDER BY start_at DESC`

    const positions = await sql`
      SELECT id, election_id AS "electionId", title, description,
             max_selections AS "maxSelections", allow_abstain AS "allowAbstain", sort_order
      FROM positions ORDER BY sort_order`

    const candidates = await sql`
      SELECT c.id, c.position_id AS "positionId", c.name, c.faculty, c.manifesto, c.bio
      FROM candidates c
      WHERE c.status = 'APPROVED'`

    const eligibilityCounts = await sql`
      SELECT election_id, count(*)::int AS n FROM voter_eligibility GROUP BY election_id`
    const participationCounts = await sql`
      SELECT election_id, count(*)::int AS n FROM participation_records GROUP BY election_id`

    const published = await sql`
      SELECT rp.election_id, rp.published_at AS "publishedAt", t.results
      FROM result_publications rp
      JOIN tally_records t ON t.id = rp.tally_id
      WHERE rp.published_at IS NOT NULL`

    const eligMap = Object.fromEntries(eligibilityCounts.map((r: any) => [r.election_id, r.n]))
    const partMap = Object.fromEntries(participationCounts.map((r: any) => [r.election_id, r.n]))
    const pubMap = Object.fromEntries(published.map((r: any) => [r.election_id, r]))

    const payload = elections.map((e: any) => ({
      ...e,
      eligibleVoters: eligMap[e.id] ?? 0,
      participated: partMap[e.id] ?? 0,
      publishedAt: pubMap[e.id]?.publishedAt ?? null,
      publishedResults: pubMap[e.id]?.results ?? null,
      positions: positions
        .filter((p: any) => p.electionId === e.id)
        .map((p: any) => ({
          ...p,
          candidates: candidates.filter((c: any) => c.positionId === p.id),
        })),
    }))

    res.status(200).json({ elections: payload })
  } catch (e: any) {
    if (e.code === 'NO_DB') return res.status(503).json({ error: 'Database not configured' })
    res.status(500).json({ error: 'Internal error' })
  }
}
