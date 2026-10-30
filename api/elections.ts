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

async function ecDashboard(sql: Sql, res: any) {
  const rows = await sql`
    SELECT e.id, e.slug, e.name, lower(e.status::text) AS status,
           e.start_at AS "startAt", e.end_at AS "endAt",
           (SELECT count(*)::int FROM voter_eligibility ve WHERE ve.election_id = e.id) AS "eligibleVoters",
           (SELECT count(*)::int FROM student_registrations sr WHERE sr.election_id = e.id) AS "registeredStudents",
           (SELECT count(*)::int FROM participation_records pr WHERE pr.election_id = e.id) AS participated,
           (SELECT count(*)::int FROM anonymous_ballots ab WHERE ab.election_id = e.id) AS "ballotCount"
    FROM elections e WHERE e.slug = 'el-src-2026'`
  const voterStats = rows[0]
  if (!voterStats) return res.status(404).json({ error: 'SRC election not found' })

  const trend = await sql`
    WITH bounds AS (
      SELECT date_trunc('hour', start_at) AS start_hour,
             date_trunc('hour', LEAST(now(), end_at)) AS end_hour
      FROM elections WHERE id = ${voterStats.id}
    ), hours AS (
      SELECT generate_series(start_hour, end_hour, interval '1 hour') AS hour
      FROM bounds WHERE end_hour >= start_hour
    ), hourly AS (
      SELECT date_trunc('hour', accepted_at) AS hour, count(*)::int AS ballots
      FROM participation_records WHERE election_id = ${voterStats.id}
      GROUP BY date_trunc('hour', accepted_at)
    )
    SELECT h.hour, COALESCE(hourly.ballots, 0)::int AS ballots,
           SUM(COALESCE(hourly.ballots, 0)) OVER (ORDER BY h.hour)::int AS cumulative
    FROM hours h LEFT JOIN hourly ON hourly.hour = h.hour
    ORDER BY h.hour`

  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({ voterStats, trend })
}

async function candidatePerformance(sql: Sql, res: any) {
  const electionRows = await sql`
    SELECT e.id, e.slug, e.name,
           lower(CASE WHEN e.status = 'OPEN' AND now() < e.start_at THEN 'SCHEDULED'
                      WHEN e.status = 'OPEN' AND now() > e.end_at THEN 'CLOSED'
                      ELSE e.status::text END) AS status,
           e.start_at AS "startAt", e.end_at AS "endAt"
    FROM elections e WHERE e.slug = 'el-src-2026'`
  const election = electionRows[0]
  if (!election) return res.status(404).json({ error: 'SRC election not found' })

  const standingsRows = await sql`
    WITH candidate_counts AS (
      SELECT bs.candidate_id, count(*)::int AS votes
      FROM ballot_selections bs
      JOIN anonymous_ballots ab ON ab.id = bs.ballot_id
      WHERE ab.election_id = ${election.id} AND bs.candidate_id IS NOT NULL
      GROUP BY bs.candidate_id
    ), position_counts AS (
      SELECT p.id, count(bs.candidate_id)::int AS total_valid,
             count(*) FILTER (WHERE bs.candidate_id IS NULL)::int AS blank
      FROM positions p
      LEFT JOIN ballot_selections bs ON bs.position_id = p.id
      LEFT JOIN anonymous_ballots ab ON ab.id = bs.ballot_id AND ab.election_id = ${election.id}
      WHERE p.election_id = ${election.id}
      GROUP BY p.id
    )
    SELECT p.id AS "positionId", p.title, p.sort_order,
           c.id AS "candidateId", c.name,
           COALESCE(cc.votes, 0)::int AS votes,
           COALESCE(pc.total_valid, 0)::int AS "totalValid",
           COALESCE(pc.blank, 0)::int AS blank
    FROM positions p
    JOIN candidates c ON c.position_id = p.id AND c.status = 'APPROVED'
    LEFT JOIN candidate_counts cc ON cc.candidate_id = c.id
    LEFT JOIN position_counts pc ON pc.id = p.id
    WHERE p.election_id = ${election.id}
    ORDER BY p.sort_order, c.name`

  const trend = await sql`
    WITH bounds AS (
      SELECT date_trunc('hour', start_at) AS start_hour,
             date_trunc('hour', LEAST(now(), end_at)) AS end_hour
      FROM elections WHERE id = ${election.id}
    ), hours AS (
      SELECT generate_series(start_hour, end_hour, interval '1 hour') AS hour
      FROM bounds WHERE end_hour >= start_hour
    ), hourly AS (
      SELECT date_trunc('hour', ab.accepted_at) AS hour, bs.candidate_id, count(*)::int AS ballots
      FROM ballot_selections bs
      JOIN anonymous_ballots ab ON ab.id = bs.ballot_id
      WHERE ab.election_id = ${election.id} AND bs.candidate_id IS NOT NULL
      GROUP BY date_trunc('hour', ab.accepted_at), bs.candidate_id
    )
    SELECT h.hour, p.id AS "positionId", c.id AS "candidateId",
           COALESCE(hourly.ballots, 0)::int AS ballots,
           SUM(COALESCE(hourly.ballots, 0)) OVER (PARTITION BY c.id ORDER BY h.hour)::int AS cumulative
    FROM hours h
    CROSS JOIN candidates c
    JOIN positions p ON p.id = c.position_id
    LEFT JOIN hourly ON hourly.hour = h.hour AND hourly.candidate_id = c.id
    WHERE p.election_id = ${election.id} AND c.status = 'APPROVED'
    ORDER BY p.sort_order, c.name, h.hour`

  const summaryRows = await sql`
    SELECT
      (SELECT count(*)::int FROM anonymous_ballots WHERE election_id = ${election.id}) AS "totalVotesCast",
      (SELECT count(*)::int FROM ballot_selections bs
        JOIN anonymous_ballots ab ON ab.id = bs.ballot_id
        WHERE ab.election_id = ${election.id} AND bs.candidate_id IS NOT NULL) AS "totalValidVotes",
      (SELECT count(*)::int FROM ballot_selections bs
        JOIN anonymous_ballots ab ON ab.id = bs.ballot_id
        WHERE ab.election_id = ${election.id} AND bs.candidate_id IS NULL) AS "totalBlankVotes"`

  const positions: any[] = []
  for (const row of standingsRows) {
    let position = positions.find((item) => item.positionId === row.positionId)
    if (!position) {
      position = {
        positionId: row.positionId,
        title: row.title,
        totalValid: row.totalValid,
        blank: row.blank,
        candidates: [],
      }
      positions.push(position)
    }
    position.candidates.push({
      candidateId: row.candidateId,
      name: row.name,
      votes: row.votes,
      percentage: 0,
      isLeading: false,
    })
  }
  for (const position of positions) {
    const highest = Math.max(0, ...position.candidates.map((candidate: any) => candidate.votes))
    const ranked = [...position.candidates].sort((a, b) => b.votes - a.votes)
    const leaders = highest > 0 ? position.candidates.filter((candidate: any) => candidate.votes === highest) : []
    position.margin = ranked.length > 1 ? ranked[0].votes - ranked[1].votes : highest
    position.leadingCandidate = leaders.map((candidate: any) => candidate.name).join(' / ') || 'No votes yet'
    position.hasTie = leaders.length > 1
    for (const candidate of position.candidates) {
      candidate.percentage = position.totalValid > 0
        ? Math.round((candidate.votes / position.totalValid) * 1000) / 10
        : 0
      candidate.isLeading = highest > 0 && candidate.votes === highest
    }
  }

  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({
    election,
    positions,
    trend,
    summary: summaryRows[0],
    asOf: new Date().toISOString(),
  })
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

    const staffResultsRequest = String(req.query?.staffResults ?? '') === '1'
    const ecDashboardRequest = String(req.query?.ecDashboard ?? '') === '1'
    const candidatePerformanceRequest = String(req.query?.candidatePerformance ?? '') === '1'
    if (req.method === 'POST' || staffResultsRequest || ecDashboardRequest || candidatePerformanceRequest) {
      const user = await requireStaff(req, res)
      if (!user) return
      if (req.method === 'GET' && ecDashboardRequest) return await ecDashboard(sql, res)
      if (req.method === 'GET' && candidatePerformanceRequest) return await candidatePerformance(sql, res)
      if (req.method === 'GET') return await staffResults(sql, res)
      const action = String(req.body?.action ?? '')
      if (action === 'update-schedule') {
        if (!user.roles.includes('super_admin')) {
          return res.status(403).json({ error: 'Full administrator access is required to change the voting schedule' })
        }
        const startAt = String(req.body?.startAt ?? '')
        const endAt = String(req.body?.endAt ?? '')
        const startTime = Date.parse(startAt)
        const endTime = Date.parse(endAt)
        if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
          return res.status(400).json({ error: 'A valid voting opening and closing time are required' })
        }
        const rows = await sql`SELECT id, status FROM elections WHERE slug = 'el-src-2026'`
        const election = rows[0]
        if (!election) return res.status(404).json({ error: 'SRC election not found' })
        if (election.status === 'PUBLISHED') return res.status(409).json({ error: 'A published election schedule cannot be changed' })
        const ballots = await sql`
          SELECT (SELECT count(*)::int FROM anonymous_ballots WHERE election_id = ${election.id}) AS ballots,
                 (SELECT count(*)::int FROM participation_records WHERE election_id = ${election.id}) AS participated`
        if (ballots[0].ballots > 0 || ballots[0].participated > 0) {
          return res.status(409).json({ error: 'The schedule cannot be changed after voting has started' })
        }
        const startIso = new Date(startTime).toISOString()
        const endIso = new Date(endTime).toISOString()
        await sql`UPDATE elections SET start_at = ${startIso}, end_at = ${endIso}, status = 'OPEN', updated_at = now()
                  WHERE id = ${election.id}`
        await recordAudit(sql, {
          type: 'ELECTION_SCHEDULE_UPDATED', actorId: user.id, actorLabel: user.institutionalId, electionId: election.id,
          detail: `SRC voting scheduled from ${startIso} through ${endIso}.`,
        }).catch(() => undefined)
        res.setHeader('Cache-Control', 'no-store')
        return res.status(200).json({ schedule: { startAt: startIso, endAt: endIso } })
      }
      if (action === 'remove-demo-data') {
        if (!user.roles.includes('super_admin')) {
          return res.status(403).json({ error: 'Full administrator access is required to remove demo data' })
        }
        const srcRows = await sql`SELECT id FROM elections WHERE slug = 'el-src-2026'`
        const srcElection = srcRows[0]
        if (!srcElection) return res.status(404).json({ error: 'SRC election not found' })
        const srcActivity = await sql`
          SELECT (SELECT count(*)::int FROM anonymous_ballots WHERE election_id = ${srcElection.id}) AS ballots,
                 (SELECT count(*)::int FROM participation_records WHERE election_id = ${srcElection.id}) AS participated`
        if (srcActivity[0].ballots > 0 || srcActivity[0].participated > 0) {
          return res.status(409).json({ error: 'Demo records can only be removed before voting starts' })
        }
        const demoElectionSlugs = ['el-pgsa-2026', 'el-sci-2026', 'el-cs-2025']
        const protectedElections = await sql`
          SELECT e.slug FROM elections e
          WHERE e.slug = ANY(${demoElectionSlugs})
            AND (EXISTS (SELECT 1 FROM anonymous_ballots ab WHERE ab.election_id = e.id)
              OR EXISTS (SELECT 1 FROM participation_records pr WHERE pr.election_id = e.id))`
        if (protectedElections.length) {
          return res.status(409).json({ error: 'A demo election contains voting records and cannot be removed automatically' })
        }
        const demoCandidateNames = [
          'Kwame Mensah', 'Abena Owusu', 'Yaw Darko',
          'Akosua Boateng', 'Kwesi Appiah',
          'Efua Adjei', 'Daniel Osei',
          'Gifty Ankrah', 'Mawuli Agbeko',
        ]
        const removed = await sql.transaction([
          sql`DELETE FROM audit_events
              WHERE (type = 'DATABASE_SEEDED' AND detail ILIKE '%Synthetic demo%')
                 OR election_id IN (SELECT id FROM elections WHERE slug = ANY(${demoElectionSlugs}))
              RETURNING id`,
          sql`DELETE FROM candidates
              WHERE application_id IS NULL AND name = ANY(${demoCandidateNames})
                AND position_id IN (SELECT id FROM positions WHERE election_id = ${srcElection.id})
              RETURNING id`,
          sql`DELETE FROM elections WHERE slug = ANY(${demoElectionSlugs}) RETURNING id`,
          sql`DELETE FROM users
              WHERE institutional_id = '10987654' AND email = 'aserwaa@student.sar.test'
                AND NOT EXISTS (SELECT 1 FROM participation_records WHERE voter_id = users.id)
              RETURNING id`,
        ])
        const summary = {
          candidates: removed[1].length,
          elections: removed[2].length,
          voters: removed[3].length,
        }
        await recordAudit(sql, {
          type: 'PRODUCTION_DATA_CLEANED', actorId: user.id, actorLabel: user.institutionalId,
          electionId: srcElection.id,
          detail: `Removed ${summary.candidates} demo candidates, ${summary.elections} demo elections, and ${summary.voters} demo voter before voting opened.`,
        }).catch(() => undefined)
        res.setHeader('Cache-Control', 'no-store')
        return res.status(200).json({ removed: summary })
      }
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
      SELECT id, slug, name, organization, description,
             CASE WHEN e.status = 'OPEN' AND now() < e.start_at THEN 'SCHEDULED'
                  WHEN e.status = 'OPEN' AND now() > e.end_at THEN 'CLOSED'
                  ELSE e.status::text END AS status,
             timezone, start_at AS "startAt", end_at AS "endAt"
      FROM elections e
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
