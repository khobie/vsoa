import { createHash } from 'node:crypto'
import { getSql } from './_db.js'
import { recordAudit } from './_audit.js'
import { getSessionUser, methodNotAllowed } from './auth/_utils.js'
import { getRegistrationSettings, saveRegistrationSettings } from './_registration-settings.js'

const STAFF = ['super_admin', 'commissioner', 'officer']

type Sql = Awaited<ReturnType<typeof getSql>>

async function requireStaff(req: any, res: any) {
  const user = await getSessionUser(req)
  if (!user) {
    res.status(401).json({ error: 'Sign in required' })
    return null
  }
  if (!user.roles.some((role) => STAFF.includes(role))) {
    res.status(403).json({ error: 'Electoral staff access required' })
    return null
  }
  return user
}

async function staffResults(sql: Sql, res: any) {
  const elections = await sql`
    SELECT e.id, e.slug, e.name, e.organization, lower(e.status::text) AS status,
           e.timezone, e.start_at AS "startAt", e.end_at AS "endAt",
           (SELECT count(*)::int FROM voter_eligibility ve WHERE ve.election_id = e.id) AS "eligibleVoters",
           (SELECT count(*)::int FROM participation_records pr WHERE pr.election_id = e.id) AS participated,
           (SELECT count(*)::int FROM anonymous_ballots ab WHERE ab.election_id = e.id) AS "ballotCount",
           t.id AS "tallyId", t.results, t.computed_at AS "computedAt",
           rp.verified_at AS "verifiedAt", rp.published_at AS "publishedAt"
    FROM elections e
    LEFT JOIN LATERAL (
      SELECT id, results, computed_at FROM tally_records
      WHERE election_id = e.id ORDER BY computed_at DESC LIMIT 1
    ) t ON true
    LEFT JOIN result_publications rp ON rp.tally_id = t.id
    WHERE e.status IN ('CLOSED', 'PUBLISHED') OR e.end_at <= now()
    ORDER BY e.end_at DESC`
  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({ elections })
}

async function computeTally(sql: Sql, req: any, res: any, user: any) {
  const electionRef = String(req.body?.electionId ?? '')
  const rows = await sql`
    SELECT id, slug, status, end_at FROM elections
    WHERE slug = ${electionRef} OR id::text = ${electionRef}`
  const election = rows[0]
  if (!election) return res.status(404).json({ error: 'Election not found' })
  if (election.status === 'PUBLISHED') return res.status(409).json({ error: 'Published results cannot be recomputed' })
  if (!['OPEN', 'CLOSED'].includes(election.status)) {
    return res.status(409).json({ error: 'This election is not ready for tallying' })
  }
  const timing = await sql`SELECT now() >= ${election.end_at} AS ended`
  if (!timing[0]?.ended) return res.status(409).json({ error: 'Voting must close before the tally is computed' })

  const counts = await sql`
    SELECT
      (SELECT count(*)::int FROM anonymous_ballots WHERE election_id = ${election.id}) AS "ballotCount",
      (SELECT count(*)::int FROM participation_records WHERE election_id = ${election.id}) AS participated,
      (SELECT count(*)::int FROM voter_eligibility WHERE election_id = ${election.id}) AS "eligibleCount"`
  const { ballotCount, participated, eligibleCount } = counts[0]
  if (ballotCount !== participated) {
    return res.status(409).json({
      error: 'Tally integrity check failed: accepted ballot and participation totals do not match',
      ballotCount,
      participated,
    })
  }

  const tallies = await sql`
    WITH position_counts AS (
      SELECT bs.position_id,
             count(bs.candidate_id)::int AS total_valid,
             count(*) FILTER (WHERE bs.candidate_id IS NULL)::int AS blank
      FROM ballot_selections bs
      JOIN anonymous_ballots ab ON ab.id = bs.ballot_id
      WHERE ab.election_id = ${election.id}
      GROUP BY bs.position_id
    ), candidate_counts AS (
      SELECT bs.candidate_id, count(*)::int AS votes
      FROM ballot_selections bs
      JOIN anonymous_ballots ab ON ab.id = bs.ballot_id
      WHERE ab.election_id = ${election.id} AND bs.candidate_id IS NOT NULL
      GROUP BY bs.candidate_id
    )
    SELECT p.id AS "positionId", p.title AS position,
           COALESCE(pc.total_valid, 0) AS "totalValid", COALESCE(pc.blank, 0) AS blank,
           COALESCE((
             SELECT jsonb_agg(jsonb_build_object('name', c.name, 'votes', COALESCE(cc.votes, 0)) ORDER BY c.name)
             FROM candidates c
             LEFT JOIN candidate_counts cc ON cc.candidate_id = c.id
             WHERE c.position_id = p.id AND (c.status = 'APPROVED' OR COALESCE(cc.votes, 0) > 0)
           ), '[]'::jsonb) AS results
    FROM positions p
    LEFT JOIN position_counts pc ON pc.position_id = p.id
    WHERE p.election_id = ${election.id}
    ORDER BY p.sort_order`
  if (!tallies.length) return res.status(409).json({ error: 'No positions are configured for this election' })
  const incomplete = tallies.some((tally: any) => tally.totalValid + tally.blank !== ballotCount)
  if (incomplete) {
    return res.status(409).json({ error: 'Tally integrity check failed: every position must account for every accepted ballot' })
  }

  const results = tallies.map(({ position, totalValid, blank, results: candidateResults }: any) => ({
    position, totalValid, blank, results: candidateResults,
  }))
  const integrityHash = createHash('sha256').update(JSON.stringify({
    electionId: election.id, results, ballotCount, eligibleCount,
  })).digest('hex')
  const previous = await sql`SELECT count(*)::int AS count FROM tally_records WHERE election_id = ${election.id}`

  const committed = await sql`
    WITH inserted AS (
      INSERT INTO tally_records
        (election_id, results, ballot_count, eligible_count, integrity_hash, is_recount)
      VALUES
        (${election.id}, ${JSON.stringify(results)}::jsonb, ${ballotCount}, ${eligibleCount}, ${integrityHash}, ${previous[0].count > 0})
      RETURNING id
    ), publication AS (
      INSERT INTO result_publications (election_id, tally_id)
      SELECT ${election.id}, id FROM inserted
      ON CONFLICT (election_id) DO UPDATE SET
        tally_id = EXCLUDED.tally_id, verified_by = NULL, verified_at = NULL,
        published_by = NULL, published_at = NULL
      RETURNING id
    ), closed AS (
      UPDATE elections SET status = 'CLOSED', updated_at = now()
      WHERE id = ${election.id} AND status = 'OPEN' AND end_at <= now()
      RETURNING id
    )
    SELECT (SELECT id FROM inserted) AS "tallyId"`

  await recordAudit(sql, {
    type: previous[0].count > 0 ? 'TALLY_RECOMPUTED' : 'TALLY_COMPUTED',
    actorId: user.id,
    actorLabel: user.institutionalId,
    electionId: election.id,
    detail: `Anonymous tally computed from ${ballotCount} accepted ballots; ${participated} participation records matched.`,
  }).catch(() => undefined)
  return res.status(200).json({ tallyId: committed[0].tallyId, ballotCount, participated, results })
}

async function verifyOrPublish(sql: Sql, req: any, res: any, user: any, action: 'verify' | 'publish') {
  const electionRef = String(req.body?.electionId ?? '')
  const rows = await sql`
    SELECT e.id, e.status, rp.tally_id, rp.verified_at, rp.published_at
    FROM elections e
    LEFT JOIN result_publications rp ON rp.election_id = e.id
    WHERE e.slug = ${electionRef} OR e.id::text = ${electionRef}`
  const election = rows[0]
  if (!election) return res.status(404).json({ error: 'Election not found' })
  if (election.published_at || election.status === 'PUBLISHED') {
    return res.status(409).json({ error: 'These results have already been published' })
  }
  if (election.status !== 'CLOSED') return res.status(409).json({ error: 'Close the election and compute its tally first' })
  if (!election.tally_id) return res.status(409).json({ error: 'Compute the anonymous tally before verification' })

  if (action === 'verify') {
    if (!election.verified_at) {
      const updated = await sql`
        UPDATE result_publications SET verified_by = ${user.id}, verified_at = now()
        WHERE election_id = ${election.id} AND tally_id = ${election.tally_id} AND published_at IS NULL
        RETURNING verified_at AS "verifiedAt"`
      if (!updated[0]) return res.status(409).json({ error: 'The tally changed; reload and verify the latest tally' })
      await recordAudit(sql, {
        type: 'TALLY_VERIFIED', actorId: user.id, actorLabel: user.institutionalId, electionId: election.id,
        detail: `Electoral staff verified tally ${election.tally_id} for publication.`,
      }).catch(() => undefined)
    }
    return res.status(200).json({ verified: true })
  }

  if (!election.verified_at) return res.status(409).json({ error: 'Verify the latest tally before publishing results' })
  const committed = await sql.transaction([
    sql`UPDATE result_publications SET published_by = ${user.id}, published_at = now()
        WHERE election_id = ${election.id} AND tally_id = ${election.tally_id}
          AND verified_at IS NOT NULL AND published_at IS NULL
        RETURNING published_at AS "publishedAt"`,
    sql`UPDATE elections SET status = 'PUBLISHED', updated_at = now()
        WHERE id = ${election.id} AND status = 'CLOSED' RETURNING id`,
  ])
  if (!committed[0][0] || !committed[1][0]) {
    return res.status(409).json({ error: 'Publication state changed; reload and try again' })
  }
  await recordAudit(sql, {
    type: 'RESULTS_PUBLISHED', actorId: user.id, actorLabel: user.institutionalId, electionId: election.id,
    detail: `Official results published from verified tally ${election.tally_id}.`,
  }).catch(() => undefined)
  return res.status(200).json({ published: true, publishedAt: committed[0][0].publishedAt })
}

/**
 * Public GET: approved candidates and published totals only.
 * Staff GET ?staffResults=1: private tally previews and publication state.
 * Staff POST: compute-tally, verify, or publish. No voter identity or ballot link is returned.
 */
export default async function handler(req: any, res: any) {
  if (!['GET', 'POST'].includes(req.method ?? '')) return methodNotAllowed(res, 'GET, POST')
  try {
    const sql = await getSql()

    const candidatePhoto = String(req.query?.candidatePhoto ?? '')
    if (req.method === 'GET' && candidatePhoto) {
      const photos = await sql`SELECT photo_url FROM candidates WHERE id = ${candidatePhoto} AND status = 'APPROVED'`
      const photoUrl = String(photos[0]?.photo_url ?? '')
      const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(photoUrl)
      if (!match) return res.status(404).json({ error: 'Candidate photo not found' })
      const contentTypes: Record<string, string> = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }
      res.setHeader('Content-Type', contentTypes[match[1]])
      res.setHeader('Cache-Control', 'public, max-age=300')
      return res.status(200).send(Buffer.from(match[2], 'base64'))
    }

    if (req.method === 'POST' || String(req.query?.staffResults ?? '') === '1') {
      const user = await requireStaff(req, res)
      if (!user) return
      if (req.method === 'GET') return await staffResults(sql, res)
      const action = String(req.body?.action ?? '')
      if (action === 'update-registration') {
        if (!user.roles.includes('super_admin')) {
          return res.status(403).json({ error: 'Full administrator access is required to change registration settings' })
        }
        const studentOpen = req.body?.studentOpen
        const aspirantOpen = req.body?.aspirantOpen
        const announcement = req.body?.announcement
        if (typeof studentOpen !== 'boolean' || typeof aspirantOpen !== 'boolean' ||
            typeof announcement !== 'string' || announcement.trim().length > 500) {
          return res.status(400).json({ error: 'Valid registration states and an announcement of up to 500 characters are required' })
        }
        const registration = await saveRegistrationSettings(sql, 'el-src-2026', {
          studentOpen, aspirantOpen, announcement: announcement.trim(),
        }, user.id)
        if (!registration) return res.status(404).json({ error: 'SRC election not found' })
        const srcElection = await sql`SELECT id FROM elections WHERE slug = 'el-src-2026'`
        await recordAudit(sql, {
          type: 'REGISTRATION_SETTINGS_UPDATED', actorId: user.id, actorLabel: user.institutionalId,
          electionId: srcElection[0].id,
          detail: `Student registration ${studentOpen ? 'opened' : 'closed'}; aspirant registration ${aspirantOpen ? 'opened' : 'closed'}; public announcement updated.`,
        }).catch(() => undefined)
        res.setHeader('Cache-Control', 'no-store')
        return res.status(200).json({ registration })
      }
      if (action === 'compute-tally') return await computeTally(sql, req, res, user)
      if (action === 'verify' || action === 'publish') return await verifyOrPublish(sql, req, res, user, action)
      return res.status(400).json({ error: 'A valid election action is required' })
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

    const registration = await getRegistrationSettings(sql)
    return res.status(200).json({ elections: payload, registration })
  } catch (e: any) {
    return res.status(500).json({ error: 'Unable to process the election request', detail: String(e?.message ?? e).slice(0, 300) })
  }
}
