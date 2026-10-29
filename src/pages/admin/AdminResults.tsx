import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { AlertTriangle, Calculator, CheckCircle2, ClipboardCheck, Loader2, RefreshCw, Send, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ElectionStatusBadge, VerificationBadge } from '@/components/StatusBadge'
import { formatDateTime, type ElectionStatus, type VerificationStatus } from '@/lib/mock-data'
import { useElections } from '@/components/elections-provider'

interface StaffTally {
  position: string
  totalValid: number
  blank: number
  results: { name: string; votes: number }[]
}

interface StaffElection {
  id: string
  slug: string
  name: string
  organization: string
  status: ElectionStatus
  timezone: string
  startAt: string
  endAt: string
  eligibleVoters: number
  participated: number
  ballotCount: number
  tallyId: string | null
  results: StaffTally[] | null
  computedAt: string | null
  verifiedAt: string | null
  publishedAt: string | null
}

type ResultsAction = 'compute-tally' | 'verify' | 'publish'

function TallyPreview({ tallies }: { tallies: StaffTally[] }) {
  if (!tallies.length) {
    return <p className="text-sm text-muted-foreground">No tally has been computed yet.</p>
  }
  return (
    <div className="space-y-4">
      {tallies.map((tally) => (
        <div key={tally.position} className="rounded-lg border p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">{tally.position}</p>
            <p className="text-xs text-muted-foreground">
              {tally.totalValid.toLocaleString()} valid · {tally.blank.toLocaleString()} blank
            </p>
          </div>
          <div className="space-y-2">
            {tally.results.map((result) => {
              const pct = tally.totalValid > 0 ? Math.round((result.votes / tally.totalValid) * 1000) / 10 : 0
              return (
                <div key={result.name} className="flex flex-wrap items-center gap-3 text-sm sm:flex-nowrap">
                  <span className="w-full truncate sm:w-48">{result.name}</span>
                  <div className="h-2 min-w-20 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-24 text-right font-medium">
                    {result.votes.toLocaleString()} ({pct}%)
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function AdminResults() {
  const navigate = useNavigate()
  const { refresh: refreshElections } = useElections()
  const [elections, setElections] = useState<StaffElection[]>([])
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/elections?staffResults=1', { headers: { Accept: 'application/json' } })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Unable to load staff results')
      setElections(Array.isArray(data.elections) ? data.elections : [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load staff results')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function runAction(election: StaffElection, resultsAction: ResultsAction) {
    setAction(`${election.id}:${resultsAction}`)
    setError('')
    try {
      const response = await fetch('/api/elections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ electionId: election.id, action: resultsAction }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Unable to update election results')
      await load()
      if (resultsAction !== 'verify') await refreshElections()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update election results')
    } finally {
      setAction('')
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <ClipboardCheck className="h-6 w-6 text-primary" /> Results verification & publication
          </h1>
          <p className="mt-1 text-muted-foreground">
            Compute totals from accepted anonymous ballots, verify the tally, then publish official results.
          </p>
        </div>
        <Button variant="outline" size="icon" aria-label="Refresh results" disabled={loading} onClick={() => void load()}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && !elections.length ? (
        <Card><CardContent className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></CardContent></Card>
      ) : elections.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">No election has closed or reached its scheduled end time.</CardContent></Card>
      ) : elections.map((election) => {
        const isPublished = !!election.publishedAt
        const isVerified = !!election.verifiedAt || isPublished
        const countsMatch = election.ballotCount === election.participated
        const turnout = election.eligibleVoters > 0
          ? Math.round((election.participated / election.eligibleVoters) * 1000) / 10
          : 0
        const verificationStatus: VerificationStatus = isPublished
          ? 'published'
          : isVerified ? 'verified' : election.tallyId ? 'awaiting_verification' : 'not_started'
        const busy = action.startsWith(`${election.id}:`)

        return (
          <Card key={election.id}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">{election.name}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Voting ended {formatDateTime(election.endAt)} · Turnout {turnout}% (
                    {election.participated.toLocaleString()} / {election.eligibleVoters.toLocaleString()})
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <ElectionStatusBadge status={election.status} />
                  <VerificationBadge status={verificationStatus} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {election.tallyId && countsMatch ? (
                <Alert className="border-emerald-200 bg-emerald-50">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <AlertDescription className="text-emerald-800">
                    Consistency check passed: {election.participated.toLocaleString()} participation records match
                    {' '}{election.ballotCount.toLocaleString()} accepted anonymous ballots.
                    {election.computedAt && ` Computed ${formatDateTime(election.computedAt)}.`}
                  </AlertDescription>
                </Alert>
              ) : election.tallyId ? (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>Ballot and participation totals do not match. Do not verify or publish this tally.</AlertDescription>
                </Alert>
              ) : (
                <Alert className="border-amber-200 bg-amber-50">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-900">
                    Voting has ended. Compute the anonymous tally before verification and publication.
                  </AlertDescription>
                </Alert>
              )}

              <TallyPreview tallies={election.results ?? []} />

              {(election.verifiedAt || election.publishedAt) && (
                <p className="text-xs text-muted-foreground">
                  {election.verifiedAt && `Verified ${formatDateTime(election.verifiedAt)}.`}
                  {election.publishedAt && ` Published ${formatDateTime(election.publishedAt)}.`}
                </p>
              )}

              <Separator />

              <div className="flex flex-wrap items-center gap-3">
                {!isPublished && (
                  <Button variant="outline" disabled={busy} onClick={() => void runAction(election, 'compute-tally')}>
                    {action === `${election.id}:compute-tally`
                      ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      : <Calculator className="mr-1.5 h-4 w-4" />}
                    {election.tallyId ? 'Recompute tally' : 'Compute anonymous tally'}
                  </Button>
                )}

                {!isVerified && election.tallyId && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button className="bg-blue-700 hover:bg-blue-800" disabled={busy || !countsMatch}>
                        <CheckCircle2 className="mr-1.5 h-4 w-4" /> Verify tally
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Verify this tally?</AlertDialogTitle>
                        <AlertDialogDescription>
                          You confirm that the automated count is consistent with accepted anonymous ballot records.
                          This records your staff identity and the verification time. Publication remains a separate step.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void runAction(election, 'verify')}>Verify tally</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}

                {isVerified && !isPublished && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button className="bg-violet-600 hover:bg-violet-700" disabled={busy || !countsMatch}>
                        <Send className="mr-1.5 h-4 w-4" /> Publish official results
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Publish official results?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Results become visible to all voters and candidates immediately. Your staff identity and the
                          publication time are recorded. This action cannot be undone through this dashboard.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void runAction(election, 'publish')}>Publish results</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}

                {isPublished && (
                  <Button variant="outline" onClick={() => navigate(`/results/${election.slug}`)}>
                    View public results page
                  </Button>
                )}
              </div>

              {!isPublished && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  These figures remain private until the EC officially publishes them.
                </p>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
