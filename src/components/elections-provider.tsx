import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Candidate, Election, ElectionStatus, Position, PositionTally } from '@/lib/mock-data'

interface ApiCandidate {
  id: string
  positionId: string
  name: string
  faculty: string
  manifesto: string
  bio: string
  status?: string
  submittedAt?: string
}

interface ApiPosition extends Omit<Position, 'candidates'> {
  candidates: ApiCandidate[]
}

interface ApiTally {
  position: string
  totalValid: number
  blank: number
  results: { name: string; votes: number }[]
}

interface ApiElection extends Omit<Election, 'id' | 'status' | 'verificationStatus' | 'positions' | 'resultsPublishedAt'> {
  id: string
  slug?: string
  status: string
  publishedAt: string | null
  publishedResults: ApiTally[] | null
  positions: ApiPosition[]
}

interface ElectionsContextValue {
  elections: Election[]
  tallies: Record<string, PositionTally[]>
  getElection: (id: string) => Election | undefined
  refresh: () => Promise<void>
}

const ElectionsContext = createContext<ElectionsContextValue | null>(null)

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter((part) => !['dr.', 'mr.', 'mrs.', 'ms.', 'prof.'].includes(part.toLowerCase()))
  return `${parts[0]?.[0] ?? ''}${parts.length > 1 ? parts[parts.length - 1][0] : ''}`.toUpperCase()
}

function normalizeElection(raw: ApiElection): Election {
  const id = raw.slug || raw.id
  const status = raw.status.toLowerCase() as ElectionStatus
  return {
    id,
    name: raw.name,
    organization: raw.organization,
    description: raw.description,
    status,
    startAt: raw.startAt,
    endAt: raw.endAt,
    timezone: raw.timezone,
    eligibleVoters: raw.eligibleVoters,
    participated: raw.participated,
    verificationStatus: status === 'published' ? 'published' : status === 'closed' ? 'awaiting_verification' : 'not_started',
    resultsPublishedAt: raw.publishedAt ?? undefined,
    positions: raw.positions.map((position) => ({
      id: position.id,
      electionId: id,
      title: position.title,
      description: position.description,
      maxSelections: position.maxSelections,
      allowAbstain: position.allowAbstain,
      candidates: position.candidates.map((candidate): Candidate => ({
        id: candidate.id,
        positionId: candidate.positionId,
        name: candidate.name,
        initials: initials(candidate.name),
        faculty: candidate.faculty,
        manifesto: candidate.manifesto,
        bio: candidate.bio,
        status: (candidate.status?.toLowerCase() ?? 'approved') as Candidate['status'],
        submittedAt: candidate.submittedAt ?? '',
      })),
    })),
  }
}

function normalizeTallies(election: Election, raw: ApiTally[] | null): PositionTally[] {
  return (raw ?? []).map((tally) => {
    const position = election.positions.find((item) => item.title === tally.position)
    return {
      positionId: position?.id ?? tally.position,
      positionTitle: tally.position,
      totalValid: tally.totalValid,
      blank: tally.blank,
      results: tally.results.map((result) => ({
        candidateId: position?.candidates.find((candidate) => candidate.name === result.name)?.id ?? result.name,
        candidateName: result.name,
        votes: result.votes,
      })),
    }
  })
}

export function ElectionsProvider({ children }: { children: ReactNode }) {
  const [elections, setElections] = useState<Election[]>([])
  const [tallies, setTallies] = useState<Record<string, PositionTally[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const endpoint = import.meta.env.VITE_ELECTIONS_API_URL ?? '/api/elections'
      const response = await fetch(endpoint, { headers: { Accept: 'application/json' } })
      if (!response.ok) throw new Error(`Election service returned ${response.status}`)
      const data = await response.json() as { elections?: ApiElection[]; error?: string }
      if (!Array.isArray(data.elections)) throw new Error(data.error || 'Election service returned an invalid response')
      const normalized = data.elections.map(normalizeElection)
      setElections(normalized)
      setTallies(Object.fromEntries(data.elections.map((raw, index) => [
        normalized[index].id,
        normalizeTallies(normalized[index], raw.publishedResults),
      ])))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load election data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const value = useMemo<ElectionsContextValue>(() => ({
    elections,
    tallies,
    getElection: (id) => elections.find((election) => election.id === id),
    refresh,
  }), [elections, tallies, refresh])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">Loading live election data…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md rounded-xl border bg-white p-8 text-center shadow-sm">
          <AlertCircle className="mx-auto h-9 w-9 text-red-500" />
          <h1 className="mt-4 text-lg font-semibold">Election data is unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <Button className="mt-5" onClick={() => void refresh()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Try again
          </Button>
        </div>
      </div>
    )
  }

  return <ElectionsContext.Provider value={value}>{children}</ElectionsContext.Provider>
}

export function useElections() {
  const context = useContext(ElectionsContext)
  if (!context) throw new Error('useElections must be used within ElectionsProvider')
  return context
}
