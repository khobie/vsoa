import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { AlertCircle, ArrowRight, BarChart3, CheckCircle2, ClipboardCheck, Clock3, Loader2, RefreshCw, ShieldCheck, TrendingUp, UserCheck, Users, Vote } from 'lucide-react'
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
    { label: 'Eligible voters', detail: 'Approved student register', value: voterStats?.eligibleVoters ?? 0, icon: Users, tone: 'bg-blue-50 text-blue-700', accent: 'bg-blue-500' },
    { label: 'Students registered', detail: 'Registration completed', value: voterStats?.registeredStudents ?? summary.registeredStudents, icon: UserCheck, tone: 'bg-emerald-50 text-emerald-700', accent: 'bg-emerald-500' },
    { label: 'Ballots accepted', detail: 'Successfully recorded', value: voterStats?.participated ?? 0, icon: Vote, tone: 'bg-violet-50 text-violet-700', accent: 'bg-violet-500' },
    { label: 'Voter turnout', detail: 'Of eligible voters', value: `${turnout}%`, icon: TrendingUp, tone: 'bg-amber-50 text-amber-700', accent: 'bg-amber-500' },
  ]

  return (
    <div className="mx-auto max-w-7xl space-y-7 pb-8">
      <header className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-green-800 p-6 text-white shadow-xl md:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-amber-400/15 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-emerald-300/10 blur-2xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-white/10 px-3 py-1 text-xs font-bold tracking-[0.14em] text-emerald-100 backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-300 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-300" />
              </span>
              ELECTION CONTROL CENTRE
            </div>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">EC Dashboard</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-100 md:text-base">
              Live turnout, candidate performance, registration totals, and results publication—secured for Electoral Commission officials.
            </p>
            {voterStats && (
              <div className="mt-5 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-white/10 px-3 py-1.5 font-medium text-white">{voterStats.name}</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 px-3 py-1.5 font-medium text-amber-100">
                  <Clock3 className="h-3.5 w-3.5" /> Closes {formatDateTime(voterStats.endAt)}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-3 py-1.5 font-medium text-emerald-100">
                  <ShieldCheck className="h-3.5 w-3.5" /> Ballot secrecy protected
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-col items-start gap-2 lg:items-end">
            <Button className="w-full border-0 bg-white text-emerald-950 shadow-lg hover:bg-amber-300 sm:w-auto" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh live data
            </Button>
            {lastUpdated && (
              <span className="text-xs text-emerald-200">
                Updated {lastUpdated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · refreshes every minute
              </span>
            )}
          </div>
        </div>
      </header>

      {error && (
        <p className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
          <AlertCircle className="h-4 w-4" /> {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="overflow-hidden border-slate-200/80 py-0 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <div className={`h-1 w-full ${stat.accent}`} />
            <CardContent className="flex items-center gap-4 py-5">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${stat.tone}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold tracking-tight">{loading && !voterStats ? '—' : typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}</p>
                <p className="text-xs font-semibold text-slate-700">{stat.label}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{stat.detail}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader className="border-b bg-gradient-to-r from-emerald-50/80 to-white">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-100 p-2"><TrendingUp className="h-5 w-5 text-emerald-700" /></div>
              <div>
                <CardTitle className="text-lg">Cumulative voter turnout</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Total accepted ballots since voting opened.</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            {trend.length === 0 ? (
              <p className="flex h-64 items-center justify-center rounded-xl bg-slate-50 text-sm text-muted-foreground">The voting trend will appear when voting begins.</p>
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
                    <Area type="monotone" dataKey="cumulative" stroke="#059669" strokeWidth={2.5} fill="url(#ec-turnout)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader className="border-b bg-gradient-to-r from-amber-50/80 to-white">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-100 p-2"><BarChart3 className="h-5 w-5 text-amber-700" /></div>
              <div>
                <CardTitle className="text-lg">Ballots by hour</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Voting activity during each hour of the election.</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            {trend.length === 0 ? (
              <p className="flex h-64 items-center justify-center rounded-xl bg-slate-50 text-sm text-muted-foreground">No hourly voting activity is available yet.</p>
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

      <div className="rounded-2xl border border-emerald-100 bg-gradient-to-b from-emerald-50/70 via-white to-white p-4 shadow-sm md:p-6">
        <CandidatePerformance />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 shadow-sm">
          <CardHeader className="flex-row items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-amber-100 p-2.5"><ClipboardCheck className="h-5 w-5 text-amber-700" /></div>
              <div>
                <CardTitle className="text-lg">Election results & publication</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Compute the anonymous tally, verify it, and publish official results after voting closes.
                </p>
              </div>
            </div>
            <Button size="sm" className="shrink-0 bg-amber-500 text-amber-950 hover:bg-amber-400" onClick={() => navigate('/admin/results')}>
              Review results <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardHeader>
        </Card>

        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white shadow-sm">
          <CardHeader className="flex-row items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-emerald-100 p-2.5"><UserCheck className="h-5 w-5 text-emerald-700" /></div>
              <div>
                <CardTitle className="text-lg">Candidate review</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">{summary.aspirants} aspirant{summary.aspirants === 1 ? '' : 's'} registered · {summary.pending} awaiting approval.</p>
              </div>
            </div>
            <Button size="sm" variant="outline" className="shrink-0 border-emerald-300 text-emerald-800 hover:bg-emerald-100" onClick={() => navigate('/admin/candidates')}>
              Review aspirants <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardHeader>
        </Card>
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-100 p-2"><CheckCircle2 className="h-5 w-5 text-emerald-700" /></div>
            <div>
              <h2 className="text-lg font-semibold">Approved candidate arrangement</h2>
              <p className="text-xs text-muted-foreground">Verified ballot order for each contested position.</p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-bold tracking-wider text-emerald-800">VERIFIED BALLOT ORDER</span>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {elections[0]?.positions.map((position) => (
            <Card key={position.id} className="overflow-hidden border-slate-200/80 py-0 shadow-sm transition-shadow hover:shadow-md">
              <CardHeader className="border-b bg-slate-50/80 py-4">
                <CardTitle className="text-base">{position.title}</CardTitle>
                <p className="text-xs text-muted-foreground">{position.candidates.length} approved candidate{position.candidates.length === 1 ? '' : 's'}</p>
              </CardHeader>
              <CardContent className="space-y-2.5 py-4">
                {position.candidates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No approved candidates yet.</p>
                ) : position.candidates.map((candidate, index) => (
                  <div key={candidate.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 transition-colors hover:border-emerald-200 hover:bg-emerald-50/40">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">{index + 1}</span>
                    <Avatar className="h-11 w-11 border-2 border-white shadow-sm ring-1 ring-emerald-100">
                      {candidate.photoUrl && <AvatarImage src={candidate.photoUrl} alt={candidate.name} className="object-cover" />}
                      <AvatarFallback className="bg-emerald-100 text-emerald-800">{initials(candidate.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{candidate.name}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-emerald-700"><CheckCircle2 className="h-3 w-3" /> Approved</p>
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
