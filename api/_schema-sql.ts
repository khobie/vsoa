/**
 * Database DDL — matches prisma/schema.prisma (the design contract).
 * Executed statement-by-statement by /api/admin/setup?step=migrate.
 * All statements are idempotent (IF NOT EXISTS / duplicate_object guards).
 *
 * BALLOT SECRECY: participation_records (WHO voted) and anonymous_ballots
 * (WHAT was voted) share NO foreign key. The unique index on
 * participation_records(voter_id, election_id) is the one-person-one-vote
 * enforcement point.
 */
export const DDL_STATEMENTS: string[] = [
  `DO $$ BEGIN CREATE TYPE role_name AS ENUM ('SUPER_ADMIN','COMMISSIONER','OFFICER','CANDIDATE','VOTER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN CREATE TYPE election_status AS ENUM ('DRAFT','SCHEDULED','OPEN','SUSPENDED','CLOSED','PUBLISHED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN CREATE TYPE candidate_status AS ENUM ('DRAFT','SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED','WITHDRAWN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  `CREATE TABLE IF NOT EXISTS users (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     institutional_id text NOT NULL UNIQUE,
     email text NOT NULL UNIQUE,
     password_hash text NOT NULL,
     name text NOT NULL,
     faculty text,
     department text,
     year_group text,
     is_active boolean NOT NULL DEFAULT true,
     activated_at timestamptz,
     created_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now()
   )`,

  `CREATE TABLE IF NOT EXISTS user_roles (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     role role_name NOT NULL,
     created_at timestamptz NOT NULL DEFAULT now(),
     UNIQUE (user_id, role)
   )`,

  `CREATE TABLE IF NOT EXISTS auth_sessions (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     token_hash text NOT NULL UNIQUE,
     expires_at timestamptz NOT NULL,
     created_at timestamptz NOT NULL DEFAULT now()
   )`,

  `CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry ON auth_sessions(expires_at)`,

  `CREATE TABLE IF NOT EXISTS elections (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     slug text NOT NULL UNIQUE,
     name text NOT NULL,
     organization text NOT NULL,
     description text,
     status election_status NOT NULL DEFAULT 'DRAFT',
     timezone text NOT NULL DEFAULT 'Africa/Accra',
     start_at timestamptz NOT NULL,
     end_at timestamptz NOT NULL,
     suspended_at timestamptz,
     suspension_reason text,
     created_by uuid REFERENCES users(id),
     created_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now()
   )`,

  `CREATE TABLE IF NOT EXISTS election_groups (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     election_id uuid NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
     label text NOT NULL,
     filter jsonb,
     UNIQUE (election_id, label)
   )`,

  `CREATE TABLE IF NOT EXISTS positions (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     election_id uuid NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
     title text NOT NULL,
     description text,
     max_selections int NOT NULL DEFAULT 1,
     allow_abstain boolean NOT NULL DEFAULT true,
     sort_order int NOT NULL DEFAULT 0,
     UNIQUE (election_id, title)
   )`,

  `CREATE TABLE IF NOT EXISTS candidates (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     position_id uuid NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
     user_id uuid REFERENCES users(id),
     name text NOT NULL,
     photo_url text,
     faculty text,
     manifesto text,
     bio text,
     status candidate_status NOT NULL DEFAULT 'DRAFT',
     submitted_at timestamptz,
     reviewed_at timestamptz,
     reviewed_by uuid,
     created_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now()
   )`,

  `CREATE TABLE IF NOT EXISTS voter_eligibility (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     voter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     election_id uuid NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
     created_at timestamptz NOT NULL DEFAULT now(),
     UNIQUE (voter_id, election_id)
   )`,

  // WHO voted — never contains choices
  `CREATE TABLE IF NOT EXISTS participation_records (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     voter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     election_id uuid NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
     accepted_at timestamptz NOT NULL DEFAULT now(),
     receipt_hash text NOT NULL UNIQUE,
     UNIQUE (voter_id, election_id)
   )`,

  // WHAT was voted — never contains voter identity
  `CREATE TABLE IF NOT EXISTS anonymous_ballots (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     election_id uuid NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
     accepted_at timestamptz NOT NULL DEFAULT now(),
     ballot_ref text NOT NULL UNIQUE
   )`,

  `CREATE TABLE IF NOT EXISTS ballot_selections (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     ballot_id uuid NOT NULL REFERENCES anonymous_ballots(id) ON DELETE CASCADE,
     position_id uuid NOT NULL REFERENCES positions(id),
     candidate_id uuid REFERENCES candidates(id),
     UNIQUE (ballot_id, position_id)
   )`,

  `CREATE TABLE IF NOT EXISTS tally_records (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     election_id uuid NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
     computed_at timestamptz NOT NULL DEFAULT now(),
     results jsonb NOT NULL,
     ballot_count int NOT NULL,
     eligible_count int NOT NULL,
     integrity_hash text NOT NULL,
     is_recount boolean NOT NULL DEFAULT false
   )`,

  `CREATE TABLE IF NOT EXISTS result_publications (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     election_id uuid NOT NULL UNIQUE REFERENCES elections(id) ON DELETE CASCADE,
     tally_id uuid NOT NULL REFERENCES tally_records(id),
     verified_by uuid,
     verified_at timestamptz,
     published_by uuid,
     published_at timestamptz
   )`,

  `CREATE TABLE IF NOT EXISTS audit_events (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     type text NOT NULL,
     actor_id uuid REFERENCES users(id),
     actor_label text,
     election_id uuid,
     outcome text NOT NULL,
     detail text,
     prev_hash text NOT NULL,
     hash text NOT NULL UNIQUE,
     created_at timestamptz NOT NULL DEFAULT now()
   )`,

  `CREATE TABLE IF NOT EXISTS security_events (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     type text NOT NULL,
     severity text NOT NULL,
     subject text,
     detail text,
     created_at timestamptz NOT NULL DEFAULT now()
   )`,

  `CREATE INDEX IF NOT EXISTS idx_audit_events_election ON audit_events(election_id)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_events_created ON audit_events(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_ballot_selections_position ON ballot_selections(position_id)`,
  `CREATE INDEX IF NOT EXISTS idx_anonymous_ballots_election ON anonymous_ballots(election_id)`,
]
