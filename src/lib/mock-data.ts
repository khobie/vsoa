/**
 * ============================================================================
 * SYNTHETIC MOCK DATA — FRONTEND DEVELOPMENT ONLY
 * ============================================================================
 * This module simulates the future backend API (Phase 4+ of the master plan).
 * Every function here will be replaced by real Next.js API routes backed by
 * PostgreSQL (Neon) + Prisma. No real personal data is used.
 *
 * SECURITY NOTE (future backend): participation records and anonymous ballots
 * will be stored separately with NO voter-to-ballot link. Mock data below
 * mirrors that separation on purpose.
 * ============================================================================
 */

export type Role = 'super_admin' | 'commissioner' | 'officer' | 'candidate' | 'voter'

export type ElectionStatus =
  | 'draft'
  | 'scheduled'
  | 'open'
  | 'suspended'
  | 'closed'
  | 'published'

export type CandidateStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'withdrawn'

export type VerificationStatus = 'not_started' | 'awaiting_verification' | 'verified' | 'published'

export interface Institution {
  name: string
  shortName: string
  motto: string
  email: string
  phone: string
}

export interface User {
  id: string
  name: string
  institutionalId: string
  email: string
  faculty: string
  department: string
  role: Role
  yearGroup: string
}

export interface Candidate {
  id: string
  positionId: string
  name: string
  initials: string
  faculty: string
  manifesto: string
  bio: string
  status: CandidateStatus
  submittedAt: string
}

export interface Position {
  id: string
  electionId: string
  title: string
  description: string
  maxSelections: number
  allowAbstain: boolean
  candidates: Candidate[]
}

export interface Election {
  id: string
  name: string
  organization: string
  description: string
  status: ElectionStatus
  startAt: string
  endAt: string
  timezone: string
  eligibleVoters: number
  participated: number
  verificationStatus: VerificationStatus
  resultsPublishedAt?: string
  positions: Position[]
}

/** Anonymous tally — contains NO voter identity, by design. */
export interface PositionTally {
  positionId: string
  positionTitle: string
  totalValid: number
  blank: number
  results: { candidateId: string; candidateName: string; votes: number; isTie?: boolean }[]
}

export interface AuditEvent {
  id: string
  type: string
  timestamp: string
  actor: string
  electionId?: string
  outcome: 'success' | 'failure' | 'warning'
  detail: string
}

export interface SecurityAlert {
  id: string
  severity: 'low' | 'medium' | 'high'
  title: string
  detail: string
  timestamp: string
}

export interface TurnoutPoint {
  time: string
  ballots: number
}

export interface VoterRecord {
  id: string
  institutionalId: string
  name: string
  email: string
  faculty: string
  department: string
  eligibleElections: number
  status: 'active' | 'pending_verification' | 'deactivated'
}

/* -------------------------------------------------------------------------- */
/* Institution                                                                 */
/* -------------------------------------------------------------------------- */

export const institution: Institution = {
  name: 'University of Ghana, Legon',
  shortName: 'UG',
  motto: 'Integri Procedamus',
  email: 'elections@ug.edu.gh',
  phone: '+233 30 221 3811',
}

/* -------------------------------------------------------------------------- */
/* Demo users                                                                  */
/* -------------------------------------------------------------------------- */

export const demoVoter: User = {
  id: 'u-001',
  name: 'Ama Serwaa',
  institutionalId: '10987654',
  email: 'aserwaa@st.ug.edu.gh',
  faculty: 'Faculty of Science',
  department: 'Computer Science',
  role: 'voter',
  yearGroup: 'Level 300',
}

export const demoAdmin: User = {
  id: 'u-900',
  name: 'Dr. Kofi Asante',
  institutionalId: 'STAFF-0142',
  email: 'kasante@ug.edu.gh',
  faculty: 'Office of the Electoral Commission',
  department: 'Electoral Commission',
  role: 'commissioner',
  yearGroup: '—',
}

/* -------------------------------------------------------------------------- */
/* Elections                                                                   */
/* -------------------------------------------------------------------------- */

export const elections: Election[] = [
  {
    id: 'el-src-2026',
    name: 'SRC General Election 2026',
    organization: "Students' Representative Council",
    description:
      'Annual general election of the Students\' Representative Council. All registered undergraduate and postgraduate students are eligible to vote for all positions.',
    status: 'open',
    startAt: '2026-10-22T08:00:00Z',
    endAt: '2026-10-22T17:00:00Z',
    timezone: 'Africa/Accra (GMT)',
    eligibleVoters: 12480,
    participated: 4792,
    verificationStatus: 'not_started',
    positions: [
      {
        id: 'pos-pres',
        electionId: 'el-src-2026',
        title: 'SRC President',
        description: 'Chief executive of the SRC. Select ONE candidate.',
        maxSelections: 1,
        allowAbstain: true,
        candidates: [
          {
            id: 'cand-001',
            positionId: 'pos-pres',
            name: 'Kwame Mensah',
            initials: 'KM',
            faculty: 'Faculty of Business',
            manifesto:
              'Transparent SRC finances with monthly public statements, a 24-hour WIFI taskforce, and a student welfare fund for emergencies.',
            bio: 'Level 400 BSc Administration student, current SRC Financial Secretary, former JCR president of Legon Hall.',
            status: 'approved',
            submittedAt: '2026-09-28T10:14:00Z',
          },
          {
            id: 'cand-002',
            positionId: 'pos-pres',
            name: 'Abena Owusu',
            initials: 'AO',
            faculty: 'Faculty of Arts',
            manifesto:
              'A listening SRC: quarterly town halls in every hall, shuttle route expansion to Diaspora halls, and mental-health first responders on campus.',
            bio: 'Level 300 Political Science student and President of the Debate Society.',
            status: 'approved',
            submittedAt: '2026-09-27T15:02:00Z',
          },
          {
            id: 'cand-003',
            positionId: 'pos-pres',
            name: 'Yaw Darko',
            initials: 'YD',
            faculty: 'Faculty of Engineering',
            manifesto:
              'Digital-first SRC: paperless congress, real-time bus tracking, and an open dashboard for every cedi the SRC spends.',
            bio: 'Level 400 Computer Engineering student, built the UG shuttle tracking prototype.',
            status: 'approved',
            submittedAt: '2026-09-29T09:41:00Z',
          },
        ],
      },
      {
        id: 'pos-vp',
        electionId: 'el-src-2026',
        title: 'SRC Vice President',
        description: 'Deputises the President and chairs the Welfare Committee. Select ONE candidate.',
        maxSelections: 1,
        allowAbstain: true,
        candidates: [
          {
            id: 'cand-004',
            positionId: 'pos-vp',
            name: 'Akosua Boateng',
            initials: 'AB',
            faculty: 'School of Medicine',
            manifesto:
              'Health and welfare first: subsidised health screening each semester and a peer counselling network across all halls.',
            bio: 'Level 300 MBChB student, SRC Health Committee member.',
            status: 'approved',
            submittedAt: '2026-09-26T11:20:00Z',
          },
          {
            id: 'cand-005',
            positionId: 'pos-vp',
            name: 'Kwesi Appiah',
            initials: 'KA',
            faculty: 'Faculty of Law',
            manifesto:
              'Stronger student representation in disciplinary hearings and a published SRC constitution everyone can actually read.',
            bio: 'Level 400 LLB student, moot court finalist.',
            status: 'approved',
            submittedAt: '2026-09-28T13:55:00Z',
          },
        ],
      },
      {
        id: 'pos-gensec',
        electionId: 'el-src-2026',
        title: 'General Secretary',
        description: 'Chief administrator of the SRC. Select ONE candidate.',
        maxSelections: 1,
        allowAbstain: true,
        candidates: [
          {
            id: 'cand-006',
            positionId: 'pos-gensec',
            name: 'Efua Adjei',
            initials: 'EA',
            faculty: 'Faculty of Arts',
            manifesto:
              'Minutes within 48 hours of every meeting, a searchable archive of SRC resolutions, and a noticeboard that is actually up to date.',
            bio: 'Level 300 Communication Studies student.',
            status: 'approved',
            submittedAt: '2026-09-27T08:30:00Z',
          },
          {
            id: 'cand-007',
            positionId: 'pos-gensec',
            name: 'Daniel Osei',
            initials: 'DO',
            faculty: 'Faculty of Science',
            manifesto:
              'Automated event reminders, digitised SRC records, and an SMS alert system for all congress resolutions.',
            bio: 'Level 300 Computer Science student, GDSC core member.',
            status: 'approved',
            submittedAt: '2026-09-28T17:10:00Z',
          },
        ],
      },
      {
        id: 'pos-wocom',
        electionId: 'el-src-2026',
        title: "Women's Commissioner",
        description: 'Advocates for the welfare of female students. Select ONE candidate.',
        maxSelections: 1,
        allowAbstain: true,
        candidates: [
          {
            id: 'cand-008',
            positionId: 'pos-wocom',
            name: 'Gifty Ankrah',
            initials: 'GA',
            faculty: 'Faculty of Business',
            manifesto:
              'Sanitary banks in every hall, self-defence workshops each semester, and a mentorship bridge to alumnae in industry.',
            bio: 'Level 300 Marketing student, VP of the Business Students Association.',
            status: 'approved',
            submittedAt: '2026-09-26T14:45:00Z',
          },
          {
            id: 'cand-009',
            positionId: 'pos-wocom',
            name: 'Mawuli Agbeko',
            initials: 'MA',
            faculty: 'Faculty of Arts',
            manifesto:
              'Safety audits of campus lighting, an anonymous reporting channel that works, and equal access to SRC bursaries.',
            bio: 'Level 400 Sociology student.',
            status: 'approved',
            submittedAt: '2026-09-29T12:05:00Z',
          },
        ],
      },
    ],
  },
  {
    id: 'el-pgsa-2026',
    name: 'Postgraduate Students Association Election',
    organization: 'Postgraduate Students Association',
    description:
      'Election of PGSA executives for the 2026/27 academic year. Eligibility is restricted to registered postgraduate students.',
    status: 'scheduled',
    startAt: '2026-10-27T08:00:00Z',
    endAt: '2026-10-27T17:00:00Z',
    timezone: 'Africa/Accra (GMT)',
    eligibleVoters: 2130,
    participated: 0,
    verificationStatus: 'not_started',
    positions: [
      {
        id: 'pos-pgsa-pres',
        electionId: 'el-pgsa-2026',
        title: 'PGSA President',
        description: 'Select ONE candidate.',
        maxSelections: 1,
        allowAbstain: false,
        candidates: [
          {
            id: 'cand-010',
            positionId: 'pos-pgsa-pres',
            name: 'Dr. Esi Quarshie',
            initials: 'EQ',
            faculty: 'School of Graduate Studies',
            manifesto: 'Research grants clinic and a postgraduate housing taskforce.',
            bio: 'PhD candidate, Development Studies.',
            status: 'approved',
            submittedAt: '2026-10-10T09:00:00Z',
          },
          {
            id: 'cand-011',
            positionId: 'pos-pgsa-pres',
            name: 'Tetteh Narh',
            initials: 'TN',
            faculty: 'School of Graduate Studies',
            manifesto: 'Conference travel fund reform and supervisor-feedback charter.',
            bio: 'MPhil candidate, Agricultural Economics.',
            status: 'under_review',
            submittedAt: '2026-10-12T16:22:00Z',
          },
        ],
      },
    ],
  },
  {
    id: 'el-sci-2026',
    name: 'Faculty of Science Association Election',
    organization: 'Faculty of Science Association',
    description:
      'Election of FSA executives. Voting closed at 17:00 on 20 October 2026. Tally awaits verification before publication.',
    status: 'closed',
    startAt: '2026-10-20T08:00:00Z',
    endAt: '2026-10-20T17:00:00Z',
    timezone: 'Africa/Accra (GMT)',
    eligibleVoters: 3402,
    participated: 1871,
    verificationStatus: 'awaiting_verification',
    positions: [
      {
        id: 'pos-fsa-pres',
        electionId: 'el-sci-2026',
        title: 'FSA President',
        description: 'Select ONE candidate.',
        maxSelections: 1,
        allowAbstain: true,
        candidates: [
          {
            id: 'cand-012',
            positionId: 'pos-fsa-pres',
            name: 'Selasie Kudoto',
            initials: 'SK',
            faculty: 'Faculty of Science',
            manifesto: 'Lab access on weekends and a science career fair.',
            bio: 'Level 300 Biochemistry student.',
            status: 'approved',
            submittedAt: '2026-10-02T10:00:00Z',
          },
          {
            id: 'cand-013',
            positionId: 'pos-fsa-pres',
            name: 'Priscilla Doe',
            initials: 'PD',
            faculty: 'Faculty of Science',
            manifesto: 'Free past-question archive and tutorial bootcamps.',
            bio: 'Level 400 Physics student.',
            status: 'approved',
            submittedAt: '2026-10-01T09:30:00Z',
          },
        ],
      },
    ],
  },
  {
    id: 'el-cs-2025',
    name: 'Computer Science Department Election 2025',
    organization: 'Computer Science Students Association',
    description:
      'Departmental association election held on 14 May 2025. Results were verified and officially published.',
    status: 'published',
    startAt: '2025-05-14T08:00:00Z',
    endAt: '2025-05-14T16:00:00Z',
    timezone: 'Africa/Accra (GMT)',
    eligibleVoters: 986,
    participated: 742,
    verificationStatus: 'published',
    resultsPublishedAt: '2025-05-15T12:00:00Z',
    positions: [
      {
        id: 'pos-cs-pres',
        electionId: 'el-cs-2025',
        title: 'COMPSSA President',
        description: 'Select ONE candidate.',
        maxSelections: 1,
        allowAbstain: true,
        candidates: [
          {
            id: 'cand-014',
            positionId: 'pos-cs-pres',
            name: 'Nana Adwoa Frimpong',
            initials: 'NF',
            faculty: 'Faculty of Science',
            manifesto: 'Hackathon every semester and an alumni internship pipeline.',
            bio: 'Level 300 Computer Science student.',
            status: 'approved',
            submittedAt: '2025-04-20T10:00:00Z',
          },
          {
            id: 'cand-015',
            positionId: 'pos-cs-pres',
            name: 'Elikem Hator',
            initials: 'EH',
            faculty: 'Faculty of Science',
            manifesto: 'A department makerspace and free certification vouchers.',
            bio: 'Level 400 Computer Science student.',
            status: 'approved',
            submittedAt: '2025-04-21T11:00:00Z',
          },
        ],
      },
      {
        id: 'pos-cs-sec',
        electionId: 'el-cs-2025',
        title: 'COMPSSA Secretary',
        description: 'Select ONE candidate.',
        maxSelections: 1,
        allowAbstain: true,
        candidates: [
          {
            id: 'cand-016',
            positionId: 'pos-cs-sec',
            name: 'Adjoa Mansa',
            initials: 'AM',
            faculty: 'Faculty of Science',
            manifesto: 'Weekly digest of tech opportunities and open meeting notes.',
            bio: 'Level 200 Computer Science student.',
            status: 'approved',
            submittedAt: '2025-04-22T09:00:00Z',
          },
          {
            id: 'cand-017',
            positionId: 'pos-cs-sec',
            name: 'Kobina Essel',
            initials: 'KE',
            faculty: 'Faculty of Science',
            manifesto: 'A proper website for COMPSSA and documented handovers.',
            bio: 'Level 300 Computer Science student.',
            status: 'approved',
            submittedAt: '2025-04-22T15:00:00Z',
          },
        ],
      },
    ],
  },
]

/* -------------------------------------------------------------------------- */
/* Anonymous tallies (no voter identity — ever)                                */
/* -------------------------------------------------------------------------- */

export const tallies: Record<string, PositionTally[]> = {
  'el-cs-2025': [
    {
      positionId: 'pos-cs-pres',
      positionTitle: 'COMPSSA President',
      totalValid: 738,
      blank: 4,
      results: [
        { candidateId: 'cand-014', candidateName: 'Nana Adwoa Frimpong', votes: 402 },
        { candidateId: 'cand-015', candidateName: 'Elikem Hator', votes: 336 },
      ],
    },
    {
      positionId: 'pos-cs-sec',
      positionTitle: 'COMPSSA Secretary',
      totalValid: 731,
      blank: 11,
      results: [
        { candidateId: 'cand-016', candidateName: 'Adjoa Mansa', votes: 366, isTie: true },
        { candidateId: 'cand-017', candidateName: 'Kobina Essel', votes: 365 },
      ],
    },
  ],
  'el-sci-2026': [
    {
      positionId: 'pos-fsa-pres',
      positionTitle: 'FSA President',
      totalValid: 1855,
      blank: 16,
      results: [
        { candidateId: 'cand-012', candidateName: 'Selasie Kudoto', votes: 951 },
        { candidateId: 'cand-013', candidateName: 'Priscilla Doe', votes: 904 },
      ],
    },
  ],
}

/* -------------------------------------------------------------------------- */
/* Turnout time series (open SRC election)                                     */
/* -------------------------------------------------------------------------- */

export const turnoutSeries: TurnoutPoint[] = [
  { time: '08:00', ballots: 0 },
  { time: '09:00', ballots: 412 },
  { time: '10:00', ballots: 1058 },
  { time: '11:00', ballots: 1904 },
  { time: '12:00', ballots: 2763 },
  { time: '13:00', ballots: 3488 },
  { time: '14:00', ballots: 4115 },
  { time: '15:00', ballots: 4792 },
]

/* -------------------------------------------------------------------------- */
/* Audit trail                                                                 */
/* -------------------------------------------------------------------------- */

export const auditEvents: AuditEvent[] = [
  {
    id: 'ae-001',
    type: 'ELECTION_OPENED',
    timestamp: '2026-10-22T08:00:02Z',
    actor: 'Dr. Kofi Asante (Commissioner)',
    electionId: 'el-src-2026',
    outcome: 'success',
    detail: 'Voting opened on schedule after pre-opening checklist passed.',
  },
  {
    id: 'ae-002',
    type: 'CANDIDATE_APPROVED',
    timestamp: '2026-09-30T11:12:44Z',
    actor: 'Dr. Kofi Asante (Commissioner)',
    electionId: 'el-src-2026',
    outcome: 'success',
    detail: 'Candidate "Yaw Darko" approved for SRC President.',
  },
  {
    id: 'ae-003',
    type: 'VOTER_REGISTER_IMPORTED',
    timestamp: '2026-09-25T09:03:18Z',
    actor: 'Mrs. Efua Adjei (Electoral Officer)',
    outcome: 'success',
    detail: 'CSV import: 12,480 records validated, 0 duplicates, 3 flagged for manual review.',
  },
  {
    id: 'ae-004',
    type: 'LOGIN_FAILURE_SPIKE',
    timestamp: '2026-10-21T22:41:07Z',
    actor: 'system',
    outcome: 'warning',
    detail: '38 failed sign-in attempts from 2 IP ranges in 10 minutes. Rate limiting engaged automatically.',
  },
  {
    id: 'ae-005',
    type: 'ELECTION_CREATED',
    timestamp: '2026-09-20T14:27:50Z',
    actor: 'Dr. Kofi Asante (Commissioner)',
    electionId: 'el-pgsa-2026',
    outcome: 'success',
    detail: 'PGSA election created and scheduled.',
  },
  {
    id: 'ae-006',
    type: 'ROLE_ASSIGNED',
    timestamp: '2026-09-18T10:00:00Z',
    actor: 'Prof. A. Boateng (Super Administrator)',
    outcome: 'success',
    detail: 'Electoral Officer role granted to Mrs. Efua Adjei.',
  },
  {
    id: 'ae-007',
    type: 'ELECTION_CLOSED',
    timestamp: '2026-10-20T17:00:01Z',
    actor: 'system',
    electionId: 'el-sci-2026',
    outcome: 'success',
    detail: 'FSA election closed automatically at configured end time.',
  },
  {
    id: 'ae-008',
    type: 'RESULTS_PUBLISHED',
    timestamp: '2025-05-15T12:00:10Z',
    actor: 'Dr. Kofi Asante (Commissioner)',
    electionId: 'el-cs-2025',
    outcome: 'success',
    detail: 'COMPSSA 2025 results published after verification record #VR-2025-014.',
  },
]

/* -------------------------------------------------------------------------- */
/* Security alerts                                                             */
/* -------------------------------------------------------------------------- */

export const securityAlerts: SecurityAlert[] = [
  {
    id: 'sa-001',
    severity: 'medium',
    title: 'Failed sign-in spike',
    detail: '38 failed attempts from 2 IP ranges last night. Rate limiting engaged; no account was compromised.',
    timestamp: '2026-10-21T22:41:07Z',
  },
  {
    id: 'sa-002',
    severity: 'low',
    title: '3 voter records pending manual review',
    detail: 'CSV import flagged 3 records with mismatched institutional IDs. They cannot vote until verified.',
    timestamp: '2026-09-25T09:03:18Z',
  },
  {
    id: 'sa-003',
    severity: 'high',
    title: 'Backup verification due',
    detail: 'Last recovery test was 27 days ago. Policy requires a restore test every 30 days.',
    timestamp: '2026-10-21T06:00:00Z',
  },
]

/* -------------------------------------------------------------------------- */
/* Voter register (mock subset)                                                */
/* -------------------------------------------------------------------------- */

export const voterRegister: VoterRecord[] = [
  { id: 'vr-001', institutionalId: '10987654', name: 'Ama Serwaa', email: 'aserwaa@st.ug.edu.gh', faculty: 'Faculty of Science', department: 'Computer Science', eligibleElections: 2, status: 'active' },
  { id: 'vr-002', institutionalId: '10881233', name: 'Kojo Antwi', email: 'kantwi@st.ug.edu.gh', faculty: 'Faculty of Business', department: 'Accounting', eligibleElections: 1, status: 'active' },
  { id: 'vr-003', institutionalId: '10765490', name: 'Afi Dzifa', email: 'adzifa@st.ug.edu.gh', faculty: 'Faculty of Law', department: 'Law', eligibleElections: 1, status: 'active' },
  { id: 'vr-004', institutionalId: '10912387', name: 'Sena Agbozo', email: 'sagbozo@st.ug.edu.gh', faculty: 'School of Medicine', department: 'Medicine', eligibleElections: 1, status: 'active' },
  { id: 'vr-005', institutionalId: '10667712', name: 'Emeka Obi', email: 'eobi@st.ug.edu.gh', faculty: 'Faculty of Engineering', department: 'Computer Engineering', eligibleElections: 2, status: 'active' },
  { id: 'vr-006', institutionalId: '10998821', name: 'Adjoa Poku', email: 'apoku@st.ug.edu.gh', faculty: 'Faculty of Arts', department: 'Political Science', eligibleElections: 1, status: 'pending_verification' },
  { id: 'vr-007', institutionalId: '10554401', name: 'Yaw Owusu-Ansah', email: 'yowusu@st.ug.edu.gh', faculty: 'Faculty of Science', department: 'Physics', eligibleElections: 2, status: 'active' },
  { id: 'vr-008', institutionalId: '10332218', name: 'Delali Normeshie', email: 'dnormeshie@st.ug.edu.gh', faculty: 'School of Graduate Studies', department: 'Development Studies', eligibleElections: 2, status: 'active' },
]

/* -------------------------------------------------------------------------- */
/* Helper functions (stand-ins for future API calls)                           */
/* -------------------------------------------------------------------------- */

export function getElection(id: string): Election | undefined {
  return elections.find((e) => e.id === id)
}

export function openElections(): Election[] {
  return elections.filter((e) => e.status === 'open')
}

export function upcomingElections(): Election[] {
  return elections.filter((e) => e.status === 'scheduled')
}

export function publishedElections(): Election[] {
  return elections.filter((e) => e.status === 'published')
}

export function turnoutPercent(e: Election): number {
  if (e.eligibleVoters === 0) return 0
  return Math.round((e.participated / e.eligibleVoters) * 1000) / 10
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Africa/Accra',
  })
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Accra',
  })
}
