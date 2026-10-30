import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, BarChart3, Loader2, RefreshCw, ShieldCheck, TrendingUp, Trophy } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

interface CandidateStanding {
  candidateId: string
  name: string
  votes: number
  percentage: number
  isLeading: boolean
}

interface PositionPerformance {
  positionId: string
  title: string
  totalValid: number
  blank: number
  margin: number
  leadingCandidate: string
  hasTie: boolean
  candidates: CandidateStanding[]
}

interface CandidateTrendPoint {
  hour: string
  positionId: string
  candidateId: string
  ballots: number
  cumulative: number
}

interface PerformanceData {
  election: {
    name: string
    status: 'scheduled' | 'open' | 'closed' | 'published' | string
    startAt: string
    endAt: string
  }
  positions: PositionPerformance[]
  trend: CandidateTrendPoint[]
  summary: {
    totalVotesCast: number
    totalValidVotes: number
    totalBlankVotes: number
  }
  asOf: string
}

const lineColors = ['#047857', '#1d4ed8', '#d97706', '#7c3aed', '#dc2626', '#0891b2', '#db2777', '#65a30d']

export default function CandidatePerformance() {
  const [data, setData] = useState<PerformanceData | null>(null)
  const [selectedPositionId, setSelectedPositionId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/elections?candidatePerformance=1', {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Unable to load candidate performance')
      setData(result)
      setSelectedPositionId((current) => (
        result.positions.some((position: PositionPerformance) => position.positionId === current)
          ? current
          : result.positions[0]?.positionId ?? ''
      ))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load candidate performance')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(true), 15_000)
    return () => window.clearInterval(timer)
  }, [load])

  const selectedPosition = data?.positions.find((position) => position.positionId === selectedPositionId) ?? data?.positions[0]
  const rankedCandidates = useMemo(() => (
    [...(selectedPosition?.candidates ?? [])].sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name))
  ), [selectedPosition])

  const candidateTrend = useMemo(() => {
    if (!selectedPosition || !data) return []
    const byHour = new Map<string, Record<string, string | number>>()
    for (const point of data.trend) {
      if (point.positionId !== selectedPosition.positionId) continue
      const existing = byHour.get(point.hour) ?? {
        hour: point.hour,
        time: new Date(point.hour).toLocaleTimeString('en-GB', {
          hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Accra',
        }),
      }
      existing[point.candidateId] = point.cumulative
      byHour.set(point.hour, existing)
    }
    return Array.from(byHour.values()).sort((a, b) => String(a.hour).localeCompare(String(b.hour)))
  }, [data, selectedPosition])

  const statusLabel = data?.election.status === 'open'
    ? 'PROVISIONAL LIVE RESULTS'
    : data?.election.status === 'published'
      ? 'PUBLISHED RESULTS'
      : 'UNVERIFIED RESULTS — NO WINNER DECLARED'

  return (
    <section className="space-y-5" aria-labelledby="candidate-performance-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="candidate-performance-title" className="text-xl font-bold">Live candidate performance</h2>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold tracking-wide text-amber-900">
              {statusLabel}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Aggregate standings and voting trends for authorized Electoral Commission officials.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {data && (
            <span className="text-xs text-muted-foreground">
              Updated {new Date(data.asOf).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · every 15 seconds
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {error && (
        <p className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" /> {error}
        </p>
      )}

      {loading && !data ? (
        <Card>
          <CardContent className="flex h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading aggregate candidate analytics…
          </CardContent>
        </Card>
      ) : data && selectedPosition ? (
        <>
          <Card>
            <CardContent className="flex flex-col gap-2 py-5 sm:flex-row sm:items-end">
              <div className="w-full space-y-2 sm:max-w-md">
                <Label htmlFor="performance-position">Position</Label>
                <select
                  id="performance-position"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedPosition.positionId}
                  onChange={(event) => setSelectedPositionId(event.target.value)}
                >
                  {data.positions.map((position) => (
                    <option key={position.positionId} value={position.positionId}>{position.title}</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-muted-foreground sm:pb-3">
                Standings, valid votes, blank ballots, and margins below apply to this position.
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Card><CardContent className="py-5"><p className="text-2xl font-bold">{data.summary.totalVotesCast.toLocaleString()}</p><p className="text-xs text-muted-foreground">Total votes cast</p></CardContent></Card>
            <Card><CardContent className="py-5"><p className="text-2xl font-bold">{selectedPosition.totalValid.toLocaleString()}</p><p className="text-xs text-muted-foreground">Valid votes — this position</p></CardContent></Card>
            <Card><CardContent className="py-5"><p className="text-2xl font-bold">{selectedPosition.blank.toLocaleString()}</p><p className="text-xs text-muted-foreground">Blank / abstained</p></CardContent></Card>
            <Card className="border-emerald-200 bg-emerald-50"><CardContent className="py-5"><p className="truncate text-lg font-bold text-emerald-900" title={selectedPosition.leadingCandidate}>{selectedPosition.leadingCandidate}</p><p className="text-xs text-emerald-800">{selectedPosition.hasTie ? 'Current leaders — tie' : 'Current leading candidate'}</p></CardContent></Card>
            <Card><CardContent className="py-5"><p className="text-2xl font-bold">{data.summary.totalVotesCast === 0 ? '—' : selectedPosition.margin.toLocaleString()}</p><p className="text-xs text-muted-foreground">Current vote margin</p></CardContent></Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><Trophy className="h-5 w-5 text-amber-600" /> Candidate standings — {selectedPosition.title}</CardTitle>
              <p className="text-sm text-muted-foreground">The current leader is highlighted. This is not a declaration of a winner.</p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-3 pr-4 font-medium">Contestant</th>
                      <th className="py-3 pr-4 font-medium">Votes</th>
                      <th className="py-3 pr-4 font-medium">Valid vote share</th>
                      <th className="py-3 font-medium">Standing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankedCandidates.map((candidate) => (
                      <tr key={candidate.candidateId} className={candidate.isLeading ? 'border-b bg-emerald-50 font-medium' : 'border-b'}>
                        <td className="py-3 pr-4">{candidate.name}</td>
                        <td className="py-3 pr-4">{candidate.votes.toLocaleString()}</td>
                        <td className="py-3 pr-4">{candidate.percentage.toFixed(1)}%</td>
                        <td className="py-3">{candidate.isLeading ? <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">Leading</span> : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><BarChart3 className="h-5 w-5 text-blue-600" /> Candidate vote comparison</CardTitle>
                <p className="text-sm text-muted-foreground">Successfully recorded valid votes for {selectedPosition.title}.</p>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rankedCandidates} layout="vertical" margin={{ top: 5, right: 24, left: 12, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value) => [Number(value).toLocaleString(), 'Votes']} />
                      <Bar dataKey="votes" name="Votes" radius={[0, 5, 5, 0]}>
                        {rankedCandidates.map((candidate) => (
                          <Cell key={candidate.candidateId} fill={candidate.isLeading ? '#059669' : '#3b82f6'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><TrendingUp className="h-5 w-5 text-violet-600" /> Candidate voting trend</CardTitle>
                <p className="text-sm text-muted-foreground">Cumulative timestamped votes for each contestant in this position.</p>
              </CardHeader>
              <CardContent>
                {candidateTrend.length === 0 ? (
                  <p className="flex h-80 items-center justify-center text-sm text-muted-foreground">Candidate trend data will appear when voting opens.</p>
                ) : (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={candidateTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                        <YAxis allowDecimals={false} width={36} />
                        <Tooltip formatter={(value, name) => [Number(value).toLocaleString(), name]} />
                        {selectedPosition.candidates.map((candidate, index) => (
                          <Line
                            key={candidate.candidateId}
                            type="monotone"
                            dataKey={candidate.candidateId}
                            name={candidate.name}
                            stroke={lineColors[index % lineColors.length]}
                            strokeWidth={candidate.isLeading ? 3 : 2}
                            dot={false}
                            connectNulls
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                  {selectedPosition.candidates.map((candidate, index) => (
                    <span key={candidate.candidateId} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: lineColors[index % lineColors.length] }} />
                      {candidate.name}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex items-start gap-3 rounded-lg border bg-slate-50 p-4 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <p>
              Only successfully recorded votes are counted. Invalid or duplicate submissions are rejected and are not included in vote totals.
              Figures remain provisional while voting is ongoing; no winner is declared until voting closes and the EC completes verification.
              These analytics contain aggregate counts only and cannot identify an individual student or reveal an individual ballot choice.
            </p>
          </div>
        </>
      ) : !loading ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No approved candidates are available for analytics.</CardContent></Card>
      ) : null}
    </section>
  )
}
