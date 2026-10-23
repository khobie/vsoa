import { getSql } from '../_db'
import { DDL_STATEMENTS } from '../_schema-sql'

/**
 * One-time database setup endpoint (development convenience).
 *
 *   POST /api/admin/setup?step=migrate   → applies DDL (idempotent)
 *   POST /api/admin/setup?step=seed      → inserts SYNTHETIC demo data (once)
 *
 * Guarded by the SETUP_SECRET environment variable. This endpoint is removed
 * before any real election.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const expected = process.env.SETUP_SECRET
  if (!expected) {
    return res.status(503).json({
      error: 'SETUP_SECRET environment variable is not configured on Vercel.',
    })
  }
  if (req.headers['x-setup-secret'] !== expected) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const sql = await getSql()
  const step = String(req.query.step ?? '')

  if (step === 'migrate') {
    const results: string[] = []
    for (const stmt of DDL_STATEMENTS) {
      try {
        await sql.query(stmt)
        results.push('ok')
      } catch (e: any) {
        return res.status(500).json({ error: `Statement failed: ${e.message}`, statement: stmt.slice(0, 120), completed: results.length })
      }
    }
    return res.status(200).json({ ok: true, step: 'migrate', statements: results.length })
  }

  if (step === 'seed') {
    const existing = await sql`SELECT count(*)::int AS n FROM elections`
    if (existing[0].n > 0) {
      return res.status(409).json({ error: 'Database already seeded — refusing to overwrite.' })
    }

    // ---- Users (synthetic; password hashes are placeholders until auth phase)
    await sql`INSERT INTO users (institutional_id, email, password_hash, name, faculty, department, year_group)
      VALUES ('10987654','aserwaa@st.ug.edu.gh','PENDING_AUTH_PHASE','Ama Serwaa','Faculty of Science','Computer Science','Level 300')`
    await sql`INSERT INTO users (institutional_id, email, password_hash, name, faculty, department, year_group)
      VALUES ('STAFF-0142','kasante@ug.edu.gh','PENDING_AUTH_PHASE','Dr. Kofi Asante','Office of the Electoral Commission','Electoral Commission','—')`
    const [voter] = await sql`SELECT id FROM users WHERE institutional_id='10987654'`
    const [comm] = await sql`SELECT id FROM users WHERE institutional_id='STAFF-0142'`
    await sql`INSERT INTO user_roles (user_id, role) VALUES (${voter.id}, 'VOTER')`
    await sql`INSERT INTO user_roles (user_id, role) VALUES (${comm.id}, 'COMMISSIONER')`

    // ---- Elections
    const insertElection = async (
      slug: string, name: string, org: string, desc: string, status: string,
      start: string, end: string
    ) => {
      const [row] = await sql`INSERT INTO elections (slug, name, organization, description, status, start_at, end_at, created_by)
        VALUES (${slug}, ${name}, ${org}, ${desc}, ${status}::election_status, ${start}, ${end}, ${comm.id})
        RETURNING id`
      return row.id as string
    }

    const src = await insertElection('el-src-2026', 'SRC General Election 2026', "Students' Representative Council",
      'Annual general election of the SRC. All registered students are eligible.', 'OPEN',
      '2026-10-22T08:00:00Z', '2026-10-22T17:00:00Z')
    const pgsa = await insertElection('el-pgsa-2026', 'Postgraduate Students Association Election', 'Postgraduate Students Association',
      'Election of PGSA executives for 2026/27. Restricted to postgraduate students.', 'SCHEDULED',
      '2026-10-27T08:00:00Z', '2026-10-27T17:00:00Z')
    const fsa = await insertElection('el-sci-2026', 'Faculty of Science Association Election', 'Faculty of Science Association',
      'FSA executive election. Voting closed 20 Oct 2026; tally awaits verification.', 'CLOSED',
      '2026-10-20T08:00:00Z', '2026-10-20T17:00:00Z')
    const cs = await insertElection('el-cs-2025', 'Computer Science Department Election 2025', 'Computer Science Students Association',
      'Departmental election held 14 May 2025. Results verified and published.', 'PUBLISHED',
      '2025-05-14T08:00:00Z', '2025-05-14T16:00:00Z')

    // ---- Positions + candidates helper
    const addPosition = async (electionId: string, title: string, desc: string, sort: number, cands: [string, string, string, string][]) => {
      const [pos] = await sql`INSERT INTO positions (election_id, title, description, sort_order)
        VALUES (${electionId}, ${title}, ${desc}, ${sort}) RETURNING id`
      for (const [cname, faculty, manifesto, bio] of cands) {
        await sql`INSERT INTO candidates (position_id, name, faculty, manifesto, bio, status, submitted_at)
          VALUES (${pos.id}, ${cname}, ${faculty}, ${manifesto}, ${bio}, 'APPROVED', now())`
      }
    }

    await addPosition(src, 'SRC President', 'Chief executive of the SRC. Select ONE candidate.', 0, [
      ['Kwame Mensah', 'Faculty of Business', 'Transparent SRC finances with monthly public statements, a 24-hour WIFI taskforce, and a student welfare fund.', 'Level 400 BSc Administration student, SRC Financial Secretary.'],
      ['Abena Owusu', 'Faculty of Arts', 'A listening SRC: quarterly town halls, shuttle expansion to Diaspora halls, mental-health first responders.', 'Level 300 Political Science student, Debate Society president.'],
      ['Yaw Darko', 'Faculty of Engineering', 'Digital-first SRC: paperless congress, real-time bus tracking, open spending dashboard.', 'Level 400 Computer Engineering student.'],
    ])
    await addPosition(src, 'SRC Vice President', 'Deputises the President and chairs Welfare. Select ONE candidate.', 1, [
      ['Akosua Boateng', 'School of Medicine', 'Subsidised health screening each semester and a peer counselling network.', 'Level 300 MBChB student.'],
      ['Kwesi Appiah', 'Faculty of Law', 'Stronger representation in disciplinary hearings; a readable SRC constitution.', 'Level 400 LLB student, moot court finalist.'],
    ])
    await addPosition(src, 'General Secretary', 'Chief administrator of the SRC. Select ONE candidate.', 2, [
      ['Efua Adjei', 'Faculty of Arts', 'Minutes within 48 hours; searchable archive of SRC resolutions.', 'Level 300 Communication Studies student.'],
      ['Daniel Osei', 'Faculty of Science', 'Automated event reminders and digitised SRC records.', 'Level 300 Computer Science student.'],
    ])
    await addPosition(src, "Women's Commissioner", 'Advocates for female students. Select ONE candidate.', 3, [
      ['Gifty Ankrah', 'Faculty of Business', 'Sanitary banks in every hall; mentorship bridge to alumnae.', 'Level 300 Marketing student.'],
      ['Mawuli Agbeko', 'Faculty of Arts', 'Campus lighting safety audits; equal access to SRC bursaries.', 'Level 400 Sociology student.'],
    ])
    await addPosition(pgsa, 'PGSA President', 'Select ONE candidate.', 0, [
      ['Dr. Esi Quarshie', 'School of Graduate Studies', 'Research grants clinic and postgraduate housing taskforce.', 'PhD candidate, Development Studies.'],
      ['Tetteh Narh', 'School of Graduate Studies', 'Conference travel fund reform and supervisor-feedback charter.', 'MPhil candidate, Agricultural Economics.'],
    ])
    await addPosition(fsa, 'FSA President', 'Select ONE candidate.', 0, [
      ['Selasie Kudoto', 'Faculty of Science', 'Lab access on weekends and a science career fair.', 'Level 300 Biochemistry student.'],
      ['Priscilla Doe', 'Faculty of Science', 'Free past-question archive and tutorial bootcamps.', 'Level 400 Physics student.'],
    ])
    const csPres = await sql`INSERT INTO positions (election_id, title, description, sort_order) VALUES (${cs}, 'COMPSSA President', 'Select ONE candidate.', 0) RETURNING id`
    const csSec = await sql`INSERT INTO positions (election_id, title, description, sort_order) VALUES (${cs}, 'COMPSSA Secretary', 'Select ONE candidate.', 1) RETURNING id`
    for (const [posId, cname, manifesto] of [
      [csPres[0].id, 'Nana Adwoa Frimpong', 'Hackathon every semester and an alumni internship pipeline.'],
      [csPres[0].id, 'Elikem Hator', 'A department makerspace and free certification vouchers.'],
      [csSec[0].id, 'Adjoa Mansa', 'Weekly digest of tech opportunities and open meeting notes.'],
      [csSec[0].id, 'Kobina Essel', 'A proper website for COMPSSA and documented handovers.'],
    ] as const) {
      await sql`INSERT INTO candidates (position_id, name, faculty, manifesto, bio, status, submitted_at)
        VALUES (${posId}, ${cname}, 'Faculty of Science', ${manifesto}, 'Synthetic demo candidate.', 'APPROVED', now())`
    }

    // ---- Eligibility: demo voter is eligible for SRC + PGSA elections
    await sql`INSERT INTO voter_eligibility (voter_id, election_id) VALUES (${voter.id}, ${src})`
    await sql`INSERT INTO voter_eligibility (voter_id, election_id) VALUES (${voter.id}, ${pgsa})`

    // ---- Seed published tally for COMPSSA 2025 (mirrors mock data)
    const [csTally] = await sql`INSERT INTO tally_records (election_id, results, ballot_count, eligible_count, integrity_hash)
      VALUES (${cs}, ${JSON.stringify([
        { position: 'COMPSSA President', totalValid: 738, blank: 4, results: [ { name: 'Nana Adwoa Frimpong', votes: 402 }, { name: 'Elikem Hator', votes: 336 } ] },
        { position: 'COMPSSA Secretary', totalValid: 731, blank: 11, results: [ { name: 'Adjoa Mansa', votes: 366 }, { name: 'Kobina Essel', votes: 365 } ] },
      ])}, 742, 986, 'demo-seed-hash') RETURNING id`
    await sql`INSERT INTO result_publications (election_id, tally_id, verified_at, published_at)
      VALUES (${cs}, ${csTally.id}, '2025-05-15T11:00:00Z', '2025-05-15T12:00:00Z')`

    // ---- Genesis audit event
    await sql`INSERT INTO audit_events (type, actor_label, outcome, detail, prev_hash, hash)
      VALUES ('DATABASE_SEEDED', 'system', 'success', 'Synthetic demo data inserted for development.', 'GENESIS', 'seed-' || gen_random_uuid()::text)`

    return res.status(200).json({ ok: true, step: 'seed', elections: 4, message: 'Synthetic demo data inserted.' })
  }

  return res.status(400).json({ error: 'Unknown step. Use ?step=migrate or ?step=seed' })
}
