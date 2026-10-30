import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  Users,
  Vote,
  UserCheck,
  ClipboardCheck,
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
import { turnoutPercent, formatDateTime, type TurnoutPoint } from '@/lib/mock-data'
import { useElections, type RegistrationSettings } from '@/components/elections-provider'
import { useAuth } from '@/components/auth-provider'
import EcDashboard from './EcDashboard'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { elections, registration, updateRegistration } = useElections()
  const { user } = useAuth()
  const [draft, setDraft] = useState<RegistrationSettings>(registration)
  const [savingRegistration, setSavingRegistration] = useState(false)
  const [registrationNotice, setRegistrationNotice] = useState('')
  const [registrationError, setRegistrationError] = useState('')
  const [turnoutSeries, setTurnoutSeries] = useState<TurnoutPoint[]>([])
  const [pendingCandidates, setPendingCandidates] = useState(0)

  useEffect(() => {
    let active = true

    async function loadLiveData() {
      try {
        const response = await fetch('/api/elections?ecDashboard=1', { headers: { Accept: 'application/json' } })
        if (!response.ok) throw new Error('Unable to load turnout')
        const data = await response.json()
        if (!active) return
        setTurnoutSeries((data.trend ?? []).map((point: { hour: string; cumulative: number }) => ({
          time: new Date(point.hour).toLocaleTimeString('en-GB', {
            hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Accra',
          }),
          ballots: point.cumulative,
        })))
      } catch {
        if (active) setTurnoutSeries([])
      }

      try {
        const response = await fetch('/api/aspirants/applications?summary=1', { headers: { Accept: 'application/json' } })
        if (!response.ok) throw new Error('Unable to load aspirant summary')
        const data = await response.json()
        if (active) setPendingCandidates(data.summary?.pending ?? 0)
      } catch {
        if (active) setPendingCandidates(0)
      }
    }

    void loadLiveData()
    const interval = window.setInterval(() => void loadLiveData(), 60000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [])

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

  const srcElection = elections.find((election) => election.id === 'el-src-2026')
  const activeElections = elections.filter((election) => election.status === 'open').length
  const awaitingVerification = elections.filter((election) => election.verificationStatus === 'awaiting_verification').length

  const stats = [
    { label: 'Registered voters', value: (srcElection?.eligibleVoters ?? 0).toLocaleString(), icon: Users, tone: 'text-primary', href: '/admin/voters' },
    { label: 'Active elections', value: String(activeElections), icon: Vote, tone: 'text-emerald-600', href: '/admin/elections' },
    { label: 'Candidates to review', value: String(pendingCandidates), icon: UserCheck, tone: 'text-amber-600', href: '/admin/candidates' },
    { label: 'Results awaiting verification', value: String(awaitingVerification), icon: ClipboardCheck, tone: 'text-violet-600', href: '/admin/results' },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Commission Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Live election overview. Turnout figures never include individual voting choices.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => navigate(stat.href)}>
            <CardContent className="flex items-center gap-4 py-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100">
                <stat.icon className={cn('h-5 w-5', stat.tone)} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
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

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Live turnout — {srcElection?.name ?? 'SRC election'}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Cumulative accepted ballots from the production database
            </p>
          </div>
          {srcElection && (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
              {turnoutPercent(srcElection)}%
            </span>
          )}
        </CardHeader>
        <CardContent>
          {turnoutSeries.length === 0 ? (
            <div className="flex h-64 items-center justify-center rounded-lg bg-slate-50 text-sm text-muted-foreground">
              Live turnout will appear when voting opens.
            </div>
          ) : (
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
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip formatter={(value) => [`${Number(value).toLocaleString()} ballots`, 'Accepted']} />
                  <Area type="monotone" dataKey="ballots" stroke="#1d4ed8" strokeWidth={2} fill="url(#turnout)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
          {srcElection && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Voting closes {formatDateTime(srcElection.endAt)} ({srcElection.timezone})
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-lg">Election</CardTitle>
          <Button size="sm" onClick={() => navigate('/admin/elections/new')}>New election</Button>
        </CardHeader>
        <CardContent className="divide-y">
          {elections.map((election) => (
            <div
              key={election.id}
              className="flex cursor-pointer items-center justify-between gap-3 py-3 hover:bg-slate-50"
              onClick={() => navigate(`/admin/elections/${election.id}`)}
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{election.name}</p>
                <p className="text-xs text-muted-foreground">
                  {election.positions.length} position(s) · Turnout {turnoutPercent(election)}%
                </p>
              </div>
              <ElectionStatusBadge status={election.status} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
