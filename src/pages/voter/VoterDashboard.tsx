import { useNavigate } from 'react-router'
import { Vote, CalendarClock, CheckCircle2, Archive, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ElectionStatusBadge } from '@/components/StatusBadge'
import { formatDateTime, turnoutPercent } from '@/lib/mock-data'
import { useElections } from '@/components/elections-provider'
import { useAuth } from '@/components/auth-provider'

export default function VoterDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { elections } = useElections()
  if (!user) return null
  const open = elections.filter((election) => election.status === 'open')
  const upcoming = elections.filter((election) => election.status === 'scheduled')
  const past = elections.filter((e) => e.status === 'closed' || e.status === 'published')

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold">Akwaaba, {user.name.split(' ')[0]} 👋</h1>
        <p className="mt-1 text-muted-foreground">
          {user.department}, {user.faculty} · {user.yearGroup}
        </p>
      </div>

      {/* Open elections */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Vote className="h-5 w-5 text-emerald-600" /> Open for voting
        </h2>
        {open.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No elections are open right now. You will be notified when voting opens.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {open.map((e) => (
              <Card key={e.id} className="border-emerald-200">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-xl">{e.name}</CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">{e.organization}</p>
                    </div>
                    <ElectionStatusBadge status={e.status} />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{e.description}</p>
                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs text-muted-foreground">Positions</p>
                      <p className="font-semibold">{e.positions.length}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs text-muted-foreground">Voting closes</p>
                      <p className="font-semibold">{formatDateTime(e.endAt)}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs text-muted-foreground">Current turnout</p>
                      <p className="font-semibold">{turnoutPercent(e)}%</p>
                    </div>
                  </div>
                  <Button className="mt-5 w-full sm:w-auto" size="lg" onClick={() => navigate(`/vote/${e.id}`)}>
                    Cast your ballot <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Upcoming */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <CalendarClock className="h-5 w-5 text-blue-600" /> Upcoming elections
        </h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing scheduled at the moment.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {upcoming.map((e) => (
              <Card key={e.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{e.name}</CardTitle>
                    <ElectionStatusBadge status={e.status} />
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <p>Opens {formatDateTime(e.startAt)}</p>
                  <p className="mt-1">{e.positions.length} position(s) · {e.eligibleVoters.toLocaleString()} eligible voters</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Past */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Archive className="h-5 w-5 text-slate-500" /> Closed & published
        </h2>
        <div className="space-y-3">
          {past.map((e) => (
            <Card key={e.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="font-medium">{e.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Closed {formatDateTime(e.endAt)} · Turnout {turnoutPercent(e)}%
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {e.status === 'published' ? (
                    <Button variant="outline" size="sm" onClick={() => navigate(`/results/${e.id}`)}>
                      <CheckCircle2 className="mr-1.5 h-4 w-4 text-violet-600" /> View results
                    </Button>
                  ) : (
                    <ElectionStatusBadge status={e.status} />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
