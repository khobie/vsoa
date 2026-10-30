import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { AlertCircle, ArrowRight, BarChart3, CheckCircle2, ClipboardCheck, Loader2, RefreshCw, TrendingUp, UserCheck, Users, Vote } from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useElections } from '@/components/elections-provider'
import CandidatePerformance from '@/components/CandidatePerformance'
import { formatDateTime } from '@/lib/mock-data'

interface Summary {
  registeredStudents: number
  aspirants: number
  pending: number
}

interface VoterStats {
  id: string
  slug: string
  name: string
  status: string
  startAt: string
  endAt: string
  eligibleVoters: number
  registeredStudents: number
  participated: number
  ballotCount: number
}

interface ChartPoint {
  hour: string
  time: string
  ballots: number
  cumulative: number
}

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
}

export default function EcDashboard() {
  const navigate = useNavigate()
  const { elections } = useElections()
  const [summary, setSummary] = useState<Summary>({ registeredStudents: 0, aspirants: 0, pending: 0 })
  const [voterStats, setVoterStats] = useState<VoterStats | null>(null)
  const [trend, setTrend] = useState<ChartPoint[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError('')
    try {
      const [summaryResponse, dashboardResponse] = await Promise.all([
        fetch('/api/aspirants/applications?summary=1', { headers: { Accept: 'application/json' } }),
        fetch('/api/elections?ecDashboard=1', { headers: { Accept: 'application/json' } }),
      ])
      const [summaryData, dashboardData] = await Promise.all([
        summaryResponse.json().catch(() => ({})),
        dashboardResponse.json().catch(() => ({})),
      ])
      if (!summaryResponse.ok) throw new Error(summaryData.error || 'Unable to load EC registration totals')
      if (!dashboardResponse.ok) throw new Error(dashboardData.error || 'Unable to load live voter statistics')
      setSummary(summaryData.summary)
      setVoterStats(dashboardData.voterStats)
      setTrend((dashboardData.trend ?? []).map((point: Omit<ChartPoint, 'time'>) => ({
        ...point,
        time: new Date(point.hour).toLocaleTimeString('en-GB', {
          hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Accra',
        }),
      })))
      setLastUpdated(new Date())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load EC dashboard data')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(true), 60_000)
    return () => window.clearInterval(timer)
  }, [load])

  const turnout = voterStats && voterStats.eligibleVoters > 0
    ? Math.round((voterStats.participated / voterStats.eligibleVoters) * 1000) / 10
    : 0
  const stats = [
    { label: 'Eligible voters', value: voterStats?.eligibleVoters ?? 0, icon: Users, tone: 'text-primary' },
    { label: 'Students registered', value: voterStats?.registeredStudents ?? summary.registeredStudents, icon: UserCheck, tone: 'text-emerald-600' },
    { label: 'Ballots accepted', value: voterStats?.participated ?? 0, icon: Vote, tone: 'text-violet-600' },
    { label: 'Voter turnout', value: `${turnout}%`, icon: TrendingUp, tone: 'text-amber-600' },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">EC Dashboard</h1>
          <p className="mt-1 text-muted-foreground">Live voter turnout, registration totals, candidate review, and results publication. Individual choices remain secret.</p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && <span className="text-xs text-muted-foreground">Updated {lastUpdated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · refreshes every minute</span>}
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh live data
          </Button>
        </div>
      </div>

      {error && (
        <p className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" /> {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 py-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100">
                <stat.icon className={`h-5 w-5 ${stat.tone}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{loading && !voterStats ? '—' : typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><TrendingUp className="h-5 w-5 text-emerald-600" /> Cumulative voter turnout</CardTitle>
            <p className="text-sm text-muted-foreground">Total accepted ballots since voting opened.</p>
          </CardHeader>
          <CardContent>
            {trend.length === 0 ? (
              <p className="flex h-64 items-center justify-center text-sm text-muted-foreground">The voting trend will appear when voting begins.</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="ec-turnout" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#059669" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} width={36} />
                    <Tooltip formatter={(value: number) => [value.toLocaleString(), 'Total ballots']} />
                    <Area type="monotone" dataKey="cumulative" stroke="#059669" strokeWidth={2} fill="url(#ec-turnout)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><BarChart3 className="h-5 w-5 text-amber-600" /> Ballots by hour</CardTitle>
            <p className="text-sm text-muted-foreground">Voting activity during each hour of the election.</p>
          </CardHeader>
          <CardContent>
            {trend.length === 0 ? (
              <p className="flex h-64 items-center justify-center text-sm text-muted-foreground">No hourly voting activity is available yet.</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} width={36} />
                    <Tooltip formatter={(value: number) => [value.toLocaleString(), 'Ballots accepted']} />
                    <Bar dataKey="ballots" fill="#f59e0b" radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <CandidatePerformance />

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg"><ClipboardCheck className="h-5 w-5 text-violet-600" /> Election results & publication</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              After voting closes, compute the anonymous tally, verify it, and publish the official results.
              {voterStats && ` Scheduled close: ${formatDateTime(voterStats.endAt)}.`}
            </p>
          </div>
          <Button size="sm" onClick={() => navigate('/admin/results')}>
            Review & publish results <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Candidate review</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{summary.aspirants} aspirant{summary.aspirants === 1 ? '' : 's'} registered · {summary.pending} awaiting approval.</p>
          </div>
          <Button size="sm" onClick={() => navigate('/admin/candidates')}>
            Review aspirants <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardHeader>
      </Card>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <h2 className="text-lg font-semibold">Approved candidate arrangement</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {elections[0]?.positions.map((position) => (
            <Card key={position.id}>
              <CardHeader>
                <CardTitle className="text-base">{position.title}</CardTitle>
                <p className="text-xs text-muted-foreground">{position.candidates.length} approved candidate{position.candidates.length === 1 ? '' : 's'}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {position.candidates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No approved candidates yet.</p>
                ) : position.candidates.map((candidate, index) => (
                  <div key={candidate.id} className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
                    <span className="w-5 text-center text-xs font-semibold text-muted-foreground">{index + 1}</span>
                    <Avatar className="h-10 w-10">
                      {candidate.photoUrl && <AvatarImage src={candidate.photoUrl} alt={candidate.name} />}
                      <AvatarFallback>{initials(candidate.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{candidate.name}</p>
                      <p className="text-xs text-muted-foreground">Approved</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {loading && !voterStats && (
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading live election statistics…</p>
      )}
    </div>
  )
}
