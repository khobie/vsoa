export interface RegistrationSettings {
  studentOpen: boolean
  aspirantOpen: boolean
  announcement: string
  updatedAt: string | null
}

export const DEFAULT_REGISTRATION_SETTINGS: RegistrationSettings = {
  studentOpen: true,
  aspirantOpen: true,
  announcement: '',
  updatedAt: null,
}

export async function getRegistrationSettings(sql: any, electionRef = 'el-src-2026'): Promise<RegistrationSettings> {
  const table = await sql`SELECT to_regclass('public.election_registration_settings') AS name`
  if (!table[0]?.name) return DEFAULT_REGISTRATION_SETTINGS
  const rows = await sql`
    SELECT s.student_open AS "studentOpen", s.aspirant_open AS "aspirantOpen",
           s.announcement, s.updated_at AS "updatedAt"
    FROM elections e
    JOIN election_registration_settings s ON s.election_id = e.id
    WHERE e.slug = ${electionRef} OR e.id::text = ${electionRef}`
  return rows[0] ?? DEFAULT_REGISTRATION_SETTINGS
}

export async function saveRegistrationSettings(
  sql: any,
  electionRef: string,
  settings: Omit<RegistrationSettings, 'updatedAt'>,
  userId: string,
): Promise<RegistrationSettings | null> {
  const elections = await sql`SELECT id FROM elections WHERE slug = ${electionRef} OR id::text = ${electionRef}`
  const election = elections[0]
  if (!election) return null

  await sql`CREATE TABLE IF NOT EXISTS election_registration_settings (
    election_id uuid PRIMARY KEY REFERENCES elections(id) ON DELETE CASCADE,
    student_open boolean NOT NULL DEFAULT true,
    aspirant_open boolean NOT NULL DEFAULT true,
    announcement text NOT NULL DEFAULT '',
    updated_by uuid REFERENCES users(id),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`
  const rows = await sql`
    INSERT INTO election_registration_settings
      (election_id, student_open, aspirant_open, announcement, updated_by, updated_at)
    VALUES
      (${election.id}, ${settings.studentOpen}, ${settings.aspirantOpen}, ${settings.announcement}, ${userId}, now())
    ON CONFLICT (election_id) DO UPDATE SET
      student_open = EXCLUDED.student_open,
      aspirant_open = EXCLUDED.aspirant_open,
      announcement = EXCLUDED.announcement,
      updated_by = EXCLUDED.updated_by,
      updated_at = now()
    RETURNING student_open AS "studentOpen", aspirant_open AS "aspirantOpen",
              announcement, updated_at AS "updatedAt"`
  return rows[0]
}
