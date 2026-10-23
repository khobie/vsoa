import { Link, useNavigate } from 'react-router'
import { ShieldCheck, Lock, Vote, BarChart3, ChevronRight, Clock, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { InstitutionMark } from '@/components/InstitutionMark'
import { ElectionStatusBadge } from '@/components/StatusBadge'
import { elections, institution, openElections, formatDateTime, turnoutPercent } from '@/lib/mock-data'

const features = [
  {
    icon: Lock,
    title: 'Secret Ballot',
    text: 'Your identity and your choices are stored separately. No one — not even administrators — can see how you voted.',
  },
  {
    icon: ShieldCheck,
    title: 'One Person, One Vote',
    text: 'Enforced by the database itself, not by your browser. Duplicate or replayed submissions are rejected automatically.',
  },
  {
    icon: BarChart3,
    title: 'Auditable Results',
    text: 'Totals are computed from accepted ballots, verified by election officials, and published with a full audit trail.',
  },
  {
    icon: Smartphone,
    title: 'Vote Anywhere',
    text: 'Works on phones, tablets, and laptops — designed for slow connections and low data usage.',
  },
]

export default function Landing() {
  const navigate = useNavigate()
  const open = openElections()

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <InstitutionMark />
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate('/login')}>
              Sign in
            </Button>
            <Button onClick={() => navigate('/login')}>Vote now</Button>
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
            Secure, transparent university elections
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-blue-100">
            Cast your ballot online for SRC, faculty, departmental and postgraduate elections —
            with the secrecy of a paper ballot and the auditability of a public count.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" className="bg-amber-400 text-blue-950 hover:bg-amber-300" onClick={() => navigate('/login')}>
              <Vote className="mr-2 h-5 w-5" /> Cast your ballot
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-blue-300 bg-transparent text-white hover:bg-blue-800 hover:text-white"
              onClick={() => navigate('/results')}
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
                    <Button onClick={() => navigate('/login')}>
                      Sign in to vote <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  )}
                  {e.status === 'published' && (
                    <Button variant="outline" onClick={() => navigate(`/results/${e.id}`)}>
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

      {/* Features */}
      <section className="border-t bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-center text-2xl font-bold">Built for trustworthy elections</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div key={f.title} className="rounded-xl border bg-white p-6">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-blue-950 text-blue-200">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm md:flex-row">
          <p>
            {institution.name} · Office of the Electoral Commission
          </p>
          <p>
            {institution.email} · {institution.phone}
          </p>
          <Link to="/login" className="text-amber-400 hover:underline">
            Electoral staff sign-in
          </Link>
        </div>
      </footer>
    </div>
  )
}
