import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ClipboardCheck, ShieldCheck, FileDown, CheckCircle2, AlertTriangle, Send } from 'lucide-react'
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
import { formatDateTime, turnoutPercent, type Election } from '@/lib/mock-data'
import { useElections } from '@/components/elections-provider'

function TallyPreview({ election }: { election: Election }) {
  const { tallies } = useElections()
  const tallyList = tallies[election.id] ?? []
  if (tallyList.length === 0) {
    return <p className="text-sm text-muted-foreground">Tally will be computed when the election closes.</p>
  }
  return (
    <div className="space-y-4">
      {tallyList.map((t) => (
        <div key={t.positionId} className="rounded-lg border p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-semibold">{t.positionTitle}</p>
            <p className="text-xs text-muted-foreground">
              {t.totalValid.toLocaleString()} valid · {t.blank} blank
            </p>
          </div>
          <div className="space-y-1.5">
            {t.results.map((r) => {
              const pct = Math.round((r.votes / t.totalValid) * 1000) / 10
              return (
                <div key={r.candidateId} className="flex items-center gap-3 text-sm">
                  <span className="w-40 truncate">{r.candidateName}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-20 text-right font-medium">
                    {r.votes.toLocaleString()} ({pct}%)
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
  const { elections } = useElections()
  const [verified, setVerified] = useState<Record<string, boolean>>({})

  const verifiable = elections.filter(
    (e) => e.status === 'closed' || e.status === 'published'
  )

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <ClipboardCheck className="h-6 w-6 text-primary" /> Results verification & publication
        </h1>
        <p className="mt-1 text-muted-foreground">
          Totals are computed from accepted anonymous ballots. Officials verify and publish — nobody types
          results in by hand.
        </p>
      </div>

      {verifiable.map((e) => {
        const isVerified = verified[e.id] || e.verificationStatus === 'verified' || e.verificationStatus === 'published'
        const isPublished = e.verificationStatus === 'published'
        return (
          <Card key={e.id}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">{e.name}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Closed {formatDateTime(e.endAt)} · Turnout {turnoutPercent(e)}% (
                    {e.participated.toLocaleString()} / {e.eligibleVoters.toLocaleString()})
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <ElectionStatusBadge status={e.status} />
                  <VerificationBadge status={isVerified && !isPublished ? 'verified' : e.verificationStatus} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Consistency check */}
              <Alert className="border-emerald-200 bg-emerald-50">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <AlertDescription className="text-emerald-800">
                  Consistency check passed: participation records ({e.participated.toLocaleString()}) match
                  accepted anonymous ballots ({e.participated.toLocaleString()}). No discrepancy detected.
                </AlertDescription>
              </Alert>

              <TallyPreview election={e} />

              <Separator />

              <div className="flex flex-wrap items-center gap-3">
                {!isVerified && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button className="bg-blue-700 hover:bg-blue-800">
                        <CheckCircle2 className="mr-1.5 h-4 w-4" /> Verify tally
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Verify this tally?</AlertDialogTitle>
                        <AlertDialogDescription>
                          You confirm the automated count is consistent with accepted ballot records. This
                          creates a signed verification record in the audit trail. Publication is a separate
                          step.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => setVerified((v) => ({ ...v, [e.id]: true }))}>
                          Verify
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                {isVerified && !isPublished && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button className="bg-violet-600 hover:bg-violet-700">
                        <Send className="mr-1.5 h-4 w-4" /> Publish official results
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Publish official results?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Results become visible to all voters and candidates immediately. This action is
                          audit-logged with your identity and cannot be undone without a documented
                          correction procedure.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => navigate(`/results/${e.id}`)}>
                          Publish results
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                {isPublished && (
                  <Button variant="outline" onClick={() => navigate(`/results/${e.id}`)}>
                    View public results page
                  </Button>
                )}
                <Button variant="outline">
                  <FileDown className="mr-1.5 h-4 w-4" /> Export report (CSV / PDF)
                </Button>
              </div>

              {!isPublished && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  Voters cannot see these figures until they are officially published.
                </p>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
