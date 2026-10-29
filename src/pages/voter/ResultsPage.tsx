import { useNavigate, useParams } from 'react-router'
import { ArrowLeft, ShieldCheck, Users, Vote, BarChart3, FileCheck, AlertTriangle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { VerificationBadge } from '@/components/StatusBadge'
import { turnoutPercent, formatDateTime } from '@/lib/mock-data'
import { useElections } from '@/components/elections-provider'

const CHART_COLORS = ['#1d4ed8', '#f59e0b', '#0ea5e9', '#8b5cf6', '#10b981']

export default function ResultsPage() {
  const { electionId } = useParams()
  const navigate = useNavigate()
  const { getElection, tallies } = useElections()
  const election = getElection(electionId ?? '')

  if (!election || election.status !== 'published') {
    return (
      <div className="mx-auto max-w-xl py-20 text-center">
        <p className="text-lg font-semibold">Results are not available</p>
        <p className="mt-2 text-muted-foreground">
          Results become visible only after official verification and publication.
        </p>
        <Button className="mt-4" variant="outline" onClick={() => navigate('/results')}>
          Back to published results
        </Button>
      </div>
    )
  }

  const electionTallies = tallies[election.id] ?? []
  const turnout = turnoutPercent(election)

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/results')}>
        <ArrowLeft className="mr-1.5 h-4 w-4" /> All published results
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{election.name}</h1>
          <p className="mt-1 text-muted-foreground">{election.organization}</p>
        </div>
        <VerificationBadge status={election.verificationStatus} />
      </div>

      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Eligible voters</p>
              <p className="text-xl font-bold">{election.eligibleVoters.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Vote className="h-8 w-8 text-emerald-600" />
            <div>
              <p className="text-xs text-muted-foreground">Ballots accepted</p>
              <p className="text-xl font-bold">{election.participated.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <BarChart3 className="h-8 w-8 text-amber-500" />
            <div>
              <p className="text-xs text-muted-foreground">Turnout</p>
              <p className="text-xl font-bold">{turnout}%</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <FileCheck className="h-8 w-8 text-violet-600" />
            <div>
              <p className="text-xs text-muted-foreground">Published</p>
              <p className="text-sm font-bold">
                {election.resultsPublishedAt ? formatDateTime(election.resultsPublishedAt) : '—'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Alert className="border-emerald-200 bg-emerald-50">
        <ShieldCheck className="h-4 w-4 text-emerald-600" />
        <AlertTitle className="text-emerald-800">Verified results</AlertTitle>
        <AlertDescription className="text-emerald-700">
          These totals were computed automatically from accepted anonymous ballots and approved for
          publication through the authorized verification workflow.
        </AlertDescription>
      </Alert>

      {/* Per-position results */}
      {electionTallies.map((tally) => {
        const maxVotes = tally.results.length ? Math.max(...tally.results.map((r) => r.votes)) : 0
        const tied = tally.results.filter((r) => r.votes === maxVotes)
        const isTie = tally.totalValid > 0 && tied.length > 1
        return (
          <Card key={tally.positionId}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle>{tally.positionTitle}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {tally.totalValid.toLocaleString()} valid votes · {tally.blank} blank
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {isTie && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Tie detected</AlertTitle>
                  <AlertDescription>
                    Two or more candidates are tied on {maxVotes} votes. A tie is never resolved silently —
                    it will be handled under the tie-breaking procedure approved before this election.
                  </AlertDescription>
                </Alert>
              )}
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tally.results} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="candidateName" tick={{ fontSize: 12 }} interval={0} />
                    <YAxis allowDecimals={false} />
                    <Tooltip formatter={(value: number) => [`${value.toLocaleString()} votes`, 'Total']} />
                    <Bar dataKey="votes" radius={[6, 6, 0, 0]}>
                      {tally.results.map((r, i) => (
                        <Cell
                          key={r.candidateId}
                          fill={r.votes === maxVotes ? '#f59e0b' : CHART_COLORS[i % CHART_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="divide-y rounded-lg border">
                {[...tally.results]
                  .sort((a, b) => b.votes - a.votes)
                  .map((r, rank) => {
                    const pct = tally.totalValid > 0 ? Math.round((r.votes / tally.totalValid) * 1000) / 10 : 0
                    const winner = tally.totalValid > 0 && r.votes === maxVotes && !isTie
                    const candidate = election.positions
                      .flatMap((p) => p.candidates)
                      .find((c) => c.id === r.candidateId)
                    return (
                      <div key={r.candidateId} className="flex items-center gap-4 px-4 py-3">
                        <span className="w-6 text-center text-sm font-bold text-muted-foreground">
                          {rank + 1}
                        </span>
                        <Avatar className="h-10 w-10">
                          <AvatarFallback
                            className={
                              winner ? 'bg-amber-400 text-blue-950 font-bold' : 'bg-slate-200 text-slate-600'
                            }
                          >
                            {candidate?.initials ?? '??'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">
                            {r.candidateName}{' '}
                            {winner && (
                              <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800">
                                Elected
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{r.votes.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">{pct}%</p>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
