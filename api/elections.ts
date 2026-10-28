/**
 * GET /api/elections
 * Public-safe election list: approved candidates only, no voter data,
 * no vote totals unless the election is PUBLISHED (totals come from the
 * verified tally record, never from raw ballots).
 */
export default async function handler(req: any, res: any) {
  try {
    const url = process.env.DATABASE_URL
    if (!url) return res.status(503).json({ error: 'Database not configured' })

    const { neon } = await import('@neondatabase/serverless')
    const sql = neon(url)

    const candidatePhoto = String(req.query?.candidatePhoto ?? '')
    if (candidatePhoto) {
      const photos = await sql`SELECT photo_url FROM candidates WHERE id = ${candidatePhoto} AND status = 'APPROVED'`
      const photoUrl = String(photos[0]?.photo_url ?? '')
      const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(photoUrl)
      if (!match) return res.status(404).json({ error: 'Candidate photo not found' })
      const contentTypes: Record<string, string> = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }
      res.setHeader('Content-Type', contentTypes[match[1]])
      res.setHeader('Cache-Control', 'public, max-age=300')
      return res.status(200).send(Buffer.from(match[2], 'base64'))
    }

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
      SELECT c.id, c.position_id AS "positionId", c.name, c.faculty, c.manifesto, c.bio,
             CASE WHEN c.photo_url LIKE 'data:image/%' THEN NULL ELSE c.photo_url END AS "photoUrl",
             (c.photo_url LIKE 'data:image/%') AS "hasEmbeddedPhoto"
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
          candidates: candidates
            .filter((c: any) => c.positionId === p.id)
            .map((c: any) => ({
              ...c,
              photoUrl: c.hasEmbeddedPhoto ? `/api/elections?candidatePhoto=${encodeURIComponent(c.id)}` : c.photoUrl,
            })),
        })),
    }))

    res.status(200).json({ elections: payload })
  } catch (e: any) {
    res.status(500).json({ error: 'Internal error', detail: String(e?.message ?? e).slice(0, 300) })
  }
}
