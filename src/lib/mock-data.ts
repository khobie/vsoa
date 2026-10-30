/**
 * Shared election types, institution details, and formatting helpers.
 * Runtime election, candidate, voter, tally, and audit records come from the
 * production APIs. This module contains no sample or fallback records.
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
  photoUrl?: string | null
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

/** Anonymous tally — contains no voter identity. */
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

export const institution: Institution = {
  name: 'School of Anaesthesia Ridge',
  shortName: 'SAR',
  motto: 'Students’ Representative Council Elections',
  email: '',
  phone: '',
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
