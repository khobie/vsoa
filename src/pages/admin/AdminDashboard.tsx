import { useState } from 'react'
import { useNavigate } from 'react-router'
import {
  Users,
  Vote,
  UserCheck,
  ClipboardCheck,
  ShieldAlert,
  Activity,
  ChevronRight,
  HardDrive,
  BellRing,
  Megaphone,
  Save,
  Loader2,
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ElectionStatusBadge } from '@/components/StatusBadge'
import { cn } from '@/lib/utils'
import { turnoutSeries, securityAlerts, turnoutPercent, formatDateTime } from '@/lib/mock-data'
import { useElections, type RegistrationSettings } from '@/components/elections-provider'
import { useAuth } from '@/components/auth-provider'
import EcDashboard from './EcDashboard'

const severityStyles = {
  low: 'border-blue-200 bg-blue-50 text-blue-700',
  medium: 'border-amber-200 bg-amber-50 text-amber-700',
  high: 'border-red-200 bg-red-50 text-red-700',
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { elections, registration, updateRegistration } = useElections()
  const { user } = useAuth()
  const [draft, setDraft] = useState<RegistrationSettings>(registration)
  const [savingRegistration, setSavingRegistration] = useState(false)
  const [registrationNotice, setRegistrationNotice] = useState('')
  const [registrationError, setRegistrationError] = useState('')

  async function saveRegistration(next: RegistrationSettings) {
    setSavingRegistration(true)
    setRegistrationNotice('')
    setRegistrationError('')
    try {
      const response = await fetch('/api/elections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          action: 'update-registration',
          studentOpen: next.studentOpen,
          aspirantOpen: next.aspirantOpen,
          announcement: next.announcement,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Unable to save registration settings')
      setDraft(data.registration)
      updateRegistration(data.registration)
      setRegistrationNotice('Registration controls and public announcement saved.')
    } catch (cause) {
      setRegistrationError(cause instanceof Error ? cause.message : 'Unable to save registration settings')
    } finally {
      setSavingRegistration(false)
    }
  }

  if (user && !user.roles.includes('super_admin')) return <EcDashboard />

  const open = elections.filter((election) => election.status === 'open')
  const openElection = open[0]
  const srcElection = elections.find((election) => election.id === 'el-src-2026')

  const pendingCandidates = elections
    .flatMap((e) => e.positions.flatMap((p) => p.candidates))
    .filter((c) => c.status === 'submitted' || c.status === 'under_review').length

  const awaitingVerification = elections.filter((e) => e.verificationStatus === 'awaiting_verification')

  const stats = [
    { label: 'Registered voters', value: (srcElection?.eligibleVoters ?? 0).toLocaleString(), icon: Users, tone: 'text-primary', href: '/admin/voters' },
    { label: 'Active elections', value: String(open.length), icon: Vote, tone: 'text-emerald-600', href: '/admin/elections' },
    { label: 'Candidates to review', value: String(pendingCandidates), icon: UserCheck, tone: 'text-amber-600', href: '/admin/candidates' },
    { label: 'Results awaiting verification', value: String(awaitingVerification.length), icon: ClipboardCheck, tone: 'text-violet-600', href: '/admin/results' },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Commission Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          System-wide overview. Turnout figures never include individual voting choices.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => navigate(s.href)}>
            <CardContent className="flex items-center gap-4 py-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100">
                <s.icon className={cn('h-5 w-5', s.tone)} />
              </div>
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Megaphone className="h-5 w-5 text-primary" /> Registration controls & public announcement
          </CardTitle>
          <CardDescription>
            Opening or closing takes effect immediately on the public forms and server-side submissions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {registrationNotice && (
            <Alert className="border-emerald-200 bg-emerald-50">
              <AlertDescription className="text-emerald-800">{registrationNotice}</AlertDescription>
            </Alert>
          )}
          {registrationError && (
            <Alert variant="destructive"><AlertDescription>{registrationError}</AlertDescription></Alert>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {([
              { key: 'studentOpen' as const, label: 'Student registration', description: 'Student ID lookup, telephone registration, and token generation.' },
              { key: 'aspirantOpen' as const, label: 'Aspirant registration', description: 'New aspirant applications, position selections, and photo uploads.' },
            ]).map((control) => (
              <div key={control.key} className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{control.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{control.description}</p>
                  </div>
                  <span className={cn(
                    'shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold',
                    draft[control.key] ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800',
                  )}>
                    {draft[control.key] ? 'Open' : 'Closed'}
                  </span>
                </div>
                <Button
                  className={cn('mt-4 w-full', draft[control.key] && 'border-red-200 text-red-700 hover:bg-red-50')}
                  variant={draft[control.key] ? 'outline' : 'default'}
                  disabled={savingRegistration}
                  onClick={() => void saveRegistration({ ...draft, [control.key]: !draft[control.key] })}
                >
                  {savingRegistration && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {draft[control.key] ? `Close ${control.label.toLowerCase()}` : `Open ${control.label.toLowerCase()}`}
                </Button>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="public-announcement">Homepage announcement</Label>
            <Textarea
              id="public-announcement"
              className="min-h-24"
              maxLength={500}
              placeholder="Example: SRC voter registration will start on 2 November at 8:00 AM."
              value={draft.announcement}
              onChange={(event) => setDraft((current) => ({ ...current, announcement: event.target.value }))}
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">Leave blank to hide the announcement. {draft.announcement.length}/500 characters.</p>
              <Button disabled={savingRegistration} onClick={() => void saveRegistration(draft)}>
                {savingRegistration ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save announcement
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Turnout chart */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Live turnout — {openElection?.name ?? 'No open election'}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Cumulative accepted ballots (counts only — no choices)
              </p>
            </div>
            {openElection && (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
                {turnoutPercent(openElection)}%
              </span>
            )}
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={turnoutSeries} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="turnout" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1d4ed8" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => [`${v.toLocaleString()} ballots`, 'Accepted']} />
                  <Area type="monotone" dataKey="ballots" stroke="#1d4ed8" strokeWidth={2} fill="url(#turnout)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {openElection && (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Voting closes {formatDateTime(openElection.endAt)} ({openElection.timezone})
              </p>
            )}
          </CardContent>
        </Card>

        {/* Security alerts */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldAlert className="h-5 w-5 text-red-500" /> Security alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {securityAlerts.map((a) => (
              <div key={a.id} className={cn('rounded-lg border p-3', severityStyles[a.severity])}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{a.title}</p>
                  <span className="rounded bg-white/70 px-1.5 py-0.5 text-[10px] font-bold uppercase">{a.severity}</span>
                </div>
                <p className="mt-1 text-xs opacity-90">{a.detail}</p>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full" onClick={() => navigate('/admin/audit')}>
              Open audit trail <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Elections overview */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-lg">Elections</CardTitle>
            <Button size="sm" onClick={() => navigate('/admin/elections/new')}>New election</Button>
          </CardHeader>
          <CardContent className="divide-y">
            {elections.map((e) => (
              <div
                key={e.id}
                className="flex cursor-pointer items-center justify-between gap-3 py-3 hover:bg-slate-50"
                onClick={() => navigate(`/admin/elections/${e.id}`)}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{e.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.positions.length} position(s) · Turnout {turnoutPercent(e)}%
                  </p>
                </div>
                <ElectionStatusBadge status={e.status} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* System health + tasks */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-5 w-5 text-emerald-600" /> System health
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Application</span>
                <span className="font-semibold text-emerald-600">Healthy</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Database</span>
                <span className="font-semibold text-emerald-600">Connected</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Last backup</span>
                <span className="font-semibold">02:00 GMT (encrypted)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Recovery test</span>
                <span className="font-semibold text-amber-600">Due in 3 days</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BellRing className="h-5 w-5 text-primary" /> Pending tasks
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="rounded-lg bg-slate-50 p-3">
                Verify FSA election tally <span className="text-muted-foreground">— closed 20 Oct</span>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                Review {pendingCandidates} candidate nomination(s)
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                Verify 3 flagged voter register records
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-3">
                <HardDrive className="h-4 w-4 shrink-0 text-muted-foreground" />
                Schedule quarterly restore test
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
