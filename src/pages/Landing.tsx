import { Link, useNavigate } from 'react-router'
import { Vote, ChevronRight, Clock, Megaphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { InstitutionMark } from '@/components/InstitutionMark'
import { ElectionStatusBadge } from '@/components/StatusBadge'
import { institution, formatDateTime, turnoutPercent } from '@/lib/mock-data'
import { useElections } from '@/components/elections-provider'

export default function Landing() {
  const navigate = useNavigate()
  const { elections, registration } = useElections()
  const open = elections.filter((election) => election.status === 'open')

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <InstitutionMark />
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate('/login')} disabled>
              Sign in
            </Button>
            <Button onClick={() => navigate('/login')} disabled>Vote now</Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-b from-blue-950 via-blue-900 to-blue-800 text-white">
        <div className="mx-auto max-w-6xl px-4 py-20 text-center md:py-28">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-amber-400">
            {institution.name}
          </p>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight md:text-5xl">
            Secure, transparent SRC elections
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-blue-100">
            Cast your ballot in the School of Anaesthesia Ridge SRC Election —
            with the secrecy of a paper ballot and the auditability of a public count.
          </p>
          {registration.announcement && (
            <div className="mx-auto mt-6 flex max-w-2xl items-start gap-3 rounded-lg border border-amber-300/40 bg-amber-300/10 px-4 py-3 text-left text-sm text-amber-100">
              <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <p className="whitespace-pre-wrap">{registration.announcement}</p>
            </div>
          )}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" className="bg-amber-400 text-blue-950 hover:bg-amber-300" onClick={() => navigate('/login')} disabled>
              <Vote className="mr-2 h-5 w-5" /> Cast your ballot
            </Button>
            <Button
              size="lg"
              variant="outline"
              className={registration.studentOpen
                ? 'border-blue-300 bg-transparent text-white hover:bg-blue-800 hover:text-white'
                : 'border-slate-400 bg-slate-300 text-slate-600 hover:bg-slate-300 hover:text-slate-600 disabled:opacity-100'}
              onClick={() => navigate('/students/register')}
              disabled={!registration.studentOpen}
            >
              {registration.studentOpen ? 'Student registration' : 'Student registration closed'}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className={registration.aspirantOpen
                ? 'border-blue-300 bg-transparent text-white hover:bg-blue-800 hover:text-white'
                : 'border-slate-400 bg-slate-300 text-slate-600 hover:bg-slate-300 hover:text-slate-600 disabled:opacity-100'}
              onClick={() => navigate('/aspirants/register')}
              disabled={!registration.aspirantOpen}
            >
              {registration.aspirantOpen ? 'Aspirant registration' : 'Aspirant registration closed'}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-blue-300 bg-transparent text-white hover:bg-blue-800 hover:text-white"
              onClick={() => navigate('/results')} disabled
            >
              View published results
            </Button>
          </div>
          {open.length > 0 && (
            <div className="mx-auto mt-10 flex max-w-md items-center justify-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-5 py-2 text-sm text-emerald-300">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              {open[0].name} — voting closes {formatDateTime(open[0].endAt)}
            </div>
          )}
        </div>
      </section>

      {/* Approved candidates by position */}
      <section className="border-y bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-2xl font-bold">Candidates and positions</h2>
          <p className="mt-1 text-muted-foreground">Approved SRC aspirants and the positions they are contesting.</p>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {elections[0]?.positions.map((position) => (
              <Card key={position.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{position.title}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {position.candidates.length} approved candidate{position.candidates.length === 1 ? '' : 's'}
                  </p>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  {position.candidates.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No approved candidates yet.</p>
                  ) : position.candidates.map((candidate) => (
                    <div key={candidate.id} className="flex items-center gap-3 rounded-lg border bg-white p-3">
                      <Avatar className="h-14 w-14 shrink-0 border">
                        {candidate.photoUrl && <AvatarImage src={candidate.photoUrl} alt={candidate.name} className="object-cover" loading="lazy" />}
                        <AvatarFallback className="bg-green-100 font-bold text-green-800">{candidate.initials}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-snug">{candidate.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{position.title}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Current elections */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-2xl font-bold">Elections</h2>
        <p className="mt-1 text-muted-foreground">Current, upcoming and recently concluded elections.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {elections.map((e) => (
            <Card key={e.id} className="transition-shadow hover:shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">{e.name}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">{e.organization}</p>
                  </div>
                  <ElectionStatusBadge status={e.status} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-4 w-4" /> {formatDateTime(e.startAt)} — {formatDateTime(e.endAt)}
                  </span>
                  <span>{e.eligibleVoters.toLocaleString()} eligible voters</span>
                  {(e.status === 'open' || e.status === 'closed' || e.status === 'published') && (
                    <span>Turnout: {turnoutPercent(e)}%</span>
                  )}
                </div>
                <div className="mt-4">
                  {e.status === 'open' && (
                    <Button onClick={() => navigate('/login')} disabled>
                      Sign in to vote <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  )}
                  {e.status === 'published' && (
                    <Button variant="outline" onClick={() => navigate(`/results/${e.id}`)} disabled>
                      View results <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  )}
                  {e.status === 'scheduled' && (
                    <Button variant="outline" disabled>
                      Opens {formatDateTime(e.startAt)}
                    </Button>
                  )}
                  {e.status === 'closed' && (
                    <Button variant="outline" disabled>
                      Results pending verification
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-blue-950 text-blue-200">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm md:flex-row">
          <p>
            {institution.name} · Office of the Electoral Commission
          </p>
          <p>Students’ Representative Council · 2026</p>
          <Link to="/login" className="text-amber-400 hover:underline">
            Electoral staff sign-in
          </Link>
        </div>
      </footer>
    </div>
  )
}
