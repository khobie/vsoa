import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import {
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Lock,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Ban,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { type Candidate } from '@/lib/mock-data'
import { useElections } from '@/components/elections-provider'
import { cn } from '@/lib/utils'

type Step = 'instructions' | 'voting' | 'review' | 'submitting' | 'done'

const ABSTAIN = '__abstain__'

export default function BallotPage() {
  const { electionId } = useParams()
  const navigate = useNavigate()
  const { getElection } = useElections()
  const election = getElection(electionId ?? '')

  const [step, setStep] = useState<Step>('instructions')
  const [positionIndex, setPositionIndex] = useState(0)
  const [selections, setSelections] = useState<Record<string, string>>({})
  const [manifestoCandidate, setManifestoCandidate] = useState<Candidate | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [receiptCode, setReceiptCode] = useState('')

  const positions = useMemo(() => election?.positions ?? [], [election])
  const position = positions[positionIndex]

  if (!election) {
    return (
      <div className="mx-auto max-w-xl py-20 text-center">
        <p className="text-lg font-semibold">Election not found</p>
        <Button className="mt-4" variant="outline" onClick={() => navigate('/dashboard')}>
          Back to dashboard
        </Button>
      </div>
    )
  }

  const approvedCandidates = (posId: string) =>
    positions.find((p) => p.id === posId)?.candidates.filter((c) => c.status === 'approved') ?? []

  const currentSelection = position ? selections[position.id] : undefined
  const answeredCount = positions.filter((p) => selections[p.id]).length
  const allAnswered = answeredCount === positions.length

  function choose(value: string) {
    if (!position) return
    setSelections((s) => ({ ...s, [position.id]: value }))
  }

  function next() {
    if (positionIndex < positions.length - 1) {
      setPositionIndex((i) => i + 1)
      window.scrollTo({ top: 0 })
    } else {
      setStep('review')
      window.scrollTo({ top: 0 })
    }
  }

  function back() {
    if (positionIndex > 0) setPositionIndex((i) => i - 1)
    else setStep('instructions')
  }

  const electionRef = election.id

  function submitBallot() {
    setConfirmOpen(false)
    setStep('submitting')
    // DEMO ONLY — the real system submits once to a transactional API that
    // atomically records participation + anonymous ballot. Retries are idempotent.
    setTimeout(() => {
      setReceiptCode(`UG-${Date.now().toString(36).toUpperCase()}-${electionRef.slice(3, 7).toUpperCase()}`)
      setStep('done')
      window.scrollTo({ top: 0 })
    }, 1800)
  }

  /* ------------------------------ DONE ------------------------------ */
  if (step === 'done') {
    return (
      <div className="mx-auto max-w-xl py-10">
        <Card className="border-emerald-200 text-center">
          <CardContent className="space-y-5 py-10">
            <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-500" />
            <div>
              <h1 className="text-2xl font-bold text-emerald-700">Ballot accepted</h1>
              <p className="mt-2 text-muted-foreground">
                Your ballot in the <span className="font-medium text-foreground">{election.name}</span> has
                been received and recorded.
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Confirmation receipt</p>
              <p className="mt-1 font-mono text-lg font-semibold">{receiptCode}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })} (GMT)
              </p>
            </div>
            <Alert className="border-blue-200 bg-blue-50 text-left">
              <Lock className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                For ballot secrecy, this receipt confirms only <em>that</em> you voted — your candidate
                selections are never displayed, stored with your identity, or included in any email.
              </AlertDescription>
            </Alert>
            <Button className="w-full" onClick={() => navigate('/dashboard')}>
              Return to dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  /* --------------------------- SUBMITTING --------------------------- */
  if (step === 'submitting') {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center py-24 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <h1 className="mt-6 text-xl font-semibold">Submitting your ballot…</h1>
        <p className="mt-2 text-muted-foreground">
          Do not close this page. Success is shown only after the server confirms acceptance.
        </p>
      </div>
    )
  }

  /* -------------------------- INSTRUCTIONS -------------------------- */
  if (step === 'instructions') {
    return (
      <div className="mx-auto max-w-2xl">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to dashboard
        </Button>
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-2xl">{election.name}</CardTitle>
            <p className="text-muted-foreground">{election.organization}</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm leading-relaxed text-muted-foreground">{election.description}</p>
            <div>
              <h3 className="mb-3 font-semibold">Before you vote</h3>
              <ul className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  This ballot has <strong>{positions.length} positions</strong>. Select one candidate per
                  position (or abstain where permitted).
                </li>
                <li className="flex gap-3">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  You can review all selections before submitting.
                </li>
                <li className="flex gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  Once accepted, a ballot <strong>cannot be changed</strong> and you cannot vote again in
                  this election.
                </li>
                <li className="flex gap-3">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  Your vote is secret: the system records <em>that</em> you voted, never <em>how</em>.
                </li>
              </ul>
            </div>
            <Separator />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Positions: {positions.map((p) => p.title).join(' · ')}
              </p>
              <Button size="lg" onClick={() => setStep('voting')}>
                Begin ballot <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  /* ----------------------------- REVIEW ----------------------------- */
  if (step === 'review') {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold">Review your ballot</h1>
        <p className="mt-1 text-muted-foreground">
          Check each selection carefully. After acceptance, the ballot is final.
        </p>
        <Card className="mt-6">
          <CardContent className="divide-y py-2">
            {positions.map((p) => {
              const sel = selections[p.id]
              const cand = p.candidates.find((c) => c.id === sel)
              return (
                <div key={p.id} className="flex items-center justify-between gap-4 py-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{p.title}</p>
                    {sel === ABSTAIN ? (
                      <p className="mt-0.5 flex items-center gap-1.5 font-semibold text-slate-500">
                        <Ban className="h-4 w-4" /> Abstain
                      </p>
                    ) : (
                      <p className="mt-0.5 text-lg font-semibold">{cand?.name ?? '—'}</p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPositionIndex(positions.indexOf(p))
                      setStep('voting')
                    }}
                  >
                    Change
                  </Button>
                </div>
              )
            })}
          </CardContent>
        </Card>
        <div className="mt-6 flex flex-wrap justify-between gap-3">
          <Button variant="outline" onClick={() => { setPositionIndex(positions.length - 1); setStep('voting') }}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
          </Button>
          <Button size="lg" onClick={() => setConfirmOpen(true)} disabled={!allAnswered}>
            Submit ballot <Lock className="ml-1.5 h-4 w-4" />
          </Button>
        </div>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" /> Confirm submission
              </AlertDialogTitle>
              <AlertDialogDescription>
                You are about to submit your ballot for the <strong>{election.name}</strong>. This action is
                final: once accepted, your ballot cannot be changed, withdrawn, or linked back to you. Are
                you sure you want to submit?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Review again</AlertDialogCancel>
              <AlertDialogAction onClick={submitBallot}>Yes, submit my ballot</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    )
  }

  /* ----------------------------- VOTING ----------------------------- */
  const candidates = position ? approvedCandidates(position.id) : []

  return (
    <div className="mx-auto max-w-2xl">
      {/* Progress header */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-muted-foreground">
            Position {positionIndex + 1} of {positions.length}
          </span>
          <span className="text-muted-foreground">{election.name}</span>
        </div>
        <Progress value={((positionIndex + 1) / positions.length) * 100} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{position.title}</CardTitle>
          <p className="text-sm text-muted-foreground">{position.description}</p>
        </CardHeader>
        <CardContent className="space-y-3" role="radiogroup" aria-label={`Candidates for ${position.title}`}>
          {candidates.map((c) => {
            const selected = currentSelection === c.id
            return (
              <div
                key={c.id}
                role="radio"
                aria-checked={selected}
                tabIndex={0}
                onClick={() => choose(c.id)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && choose(c.id)}
                className={cn(
                  'flex cursor-pointer items-start gap-4 rounded-xl border-2 p-4 transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selected ? 'border-primary bg-primary/5' : 'border-transparent bg-slate-50 hover:border-slate-300'
                )}
              >
                <Avatar className="h-14 w-14 shrink-0">
                  <AvatarFallback className={cn('text-base font-bold', selected ? 'bg-primary text-primary-foreground' : 'bg-slate-200 text-slate-600')}>
                    {c.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{c.name}</p>
                    <div
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                        selected ? 'border-primary bg-primary' : 'border-slate-300'
                      )}
                    >
                      {selected && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{c.faculty}</p>
                  <Button
                    variant="link"
                    size="sm"
                    className="mt-1 h-auto p-0 text-xs"
                    onClick={(e) => {
                      e.stopPropagation()
                      setManifestoCandidate(c)
                    }}
                  >
                    <FileText className="mr-1 h-3.5 w-3.5" /> Read manifesto & bio
                  </Button>
                </div>
              </div>
            )
          })}

          {position.allowAbstain && (
            <div
              role="radio"
              aria-checked={currentSelection === ABSTAIN}
              tabIndex={0}
              onClick={() => choose(ABSTAIN)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && choose(ABSTAIN)}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed p-4 transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring',
                currentSelection === ABSTAIN ? 'border-slate-500 bg-slate-100' : 'border-slate-300 text-muted-foreground hover:border-slate-400'
              )}
            >
              <Ban className="h-5 w-5" />
              <div>
                <p className="font-medium">Abstain from this position</p>
                <p className="text-xs">Your abstention is counted as a blank selection for this position only.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 flex items-center justify-between">
        <Button variant="outline" onClick={back}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
        </Button>
        <Button onClick={next} disabled={!currentSelection} size="lg">
          {positionIndex < positions.length - 1 ? (
            <>Next position <ArrowRight className="ml-1.5 h-4 w-4" /></>
          ) : (
            <>Review ballot <FileText className="ml-1.5 h-4 w-4" /></>
          )}
        </Button>
      </div>

      {/* Manifesto dialog */}
      <Dialog open={!!manifestoCandidate} onOpenChange={() => setManifestoCandidate(null)}>
        <DialogContent className="max-w-lg">
          {manifestoCandidate && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                      {manifestoCandidate.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <DialogTitle>{manifestoCandidate.name}</DialogTitle>
                    <DialogDescription>
                      {manifestoCandidate.faculty} · Candidate for {position.title}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <h4 className="mb-1 text-sm font-semibold">Manifesto</h4>
                  <p className="text-sm leading-relaxed text-muted-foreground">{manifestoCandidate.manifesto}</p>
                </div>
                <Separator />
                <div>
                  <h4 className="mb-1 text-sm font-semibold">Biography</h4>
                  <p className="text-sm leading-relaxed text-muted-foreground">{manifestoCandidate.bio}</p>
                </div>
                <Button
                  className="w-full"
                  onClick={() => {
                    choose(manifestoCandidate.id)
                    setManifestoCandidate(null)
                  }}
                >
                  Select {manifestoCandidate.name.split(' ')[0]} for {position.title}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
