import { useParams, useNavigate } from 'react-router'
import { ArrowLeft, Play, Square, PauseCircle, Users, UserCheck, Clock, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
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
import { ElectionStatusBadge, CandidateStatusBadge, VerificationBadge } from '@/components/StatusBadge'
import { getElection, formatDateTime, turnoutPercent } from '@/lib/mock-data'

export default function AdminElectionDetail() {
  const { electionId } = useParams()
  const navigate = useNavigate()
  const election = getElection(electionId ?? '')

  if (!election) {
    return (
      <div className="mx-auto max-w-xl py-20 text-center">
        <p className="text-lg font-semibold">Election not found</p>
        <Button className="mt-4" variant="outline" onClick={() => navigate('/admin/elections')}>
          Back to elections
        </Button>
      </div>
    )
  }

  const turnout = turnoutPercent(election)
  const isOpen = election.status === 'open'
  const isScheduled = election.status === 'scheduled' || election.status === 'draft'

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/admin/elections')}>
        <ArrowLeft className="mr-1.5 h-4 w-4" /> All elections
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{election.name}</h1>
          <p className="mt-1 text-muted-foreground">{election.organization}</p>
        </div>
        <div className="flex items-center gap-2">
          <ElectionStatusBadge status={election.status} />
          <VerificationBadge status={election.verificationStatus} />
        </div>
      </div>

      {/* Lifecycle controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Election controls</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          {isScheduled && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button>
                  <Play className="mr-1.5 h-4 w-4" /> Open voting now
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Open voting early?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Voting is scheduled to open {formatDateTime(election.startAt)}. Opening now is recorded in
                    the audit trail and notifies all eligible voters. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction>Open voting</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {isOpen && (
            <>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Square className="mr-1.5 h-4 w-4" /> Close voting early
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Close voting now?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Voting is scheduled to close {formatDateTime(election.endAt)}. Early closure is a
                      documented emergency action and is permanently recorded in the audit trail.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction>Close voting</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50">
                    <PauseCircle className="mr-1.5 h-4 w-4" /> Suspend (emergency)
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Suspend this election?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Suspension immediately pauses ballot acceptance. Resuming requires the authorized
                      re-activation procedure. Both actions are audit-logged with reasons.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction>Suspend election</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
          <p className="text-sm text-muted-foreground">
            All lifecycle actions require authorization and are audit-logged.
          </p>
        </CardContent>
      </Card>

      {isOpen && (
        <Alert className="border-blue-200 bg-blue-50">
          <ShieldAlert className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            Voting is in progress — election rules, positions, and candidates are locked. A material change
            requires suspension, review, and re-authorization.
          </AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="py-5">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{election.eligibleVoters.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Eligible voters</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5">
            <div className="flex items-center gap-3">
              <UserCheck className="h-8 w-8 text-emerald-600" />
              <div>
                <p className="text-2xl font-bold">{election.participated.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Ballots accepted</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Turnout</p>
              <p className="text-lg font-bold">{turnout}%</p>
            </div>
            <Progress value={turnout} />
            <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" /> Closes {formatDateTime(election.endAt)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Positions & candidates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Positions & candidates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {election.positions.map((p) => (
            <div key={p.id}>
              <div className="mb-2 flex items-center justify-between">
                <p className="font-semibold">{p.title}</p>
                <p className="text-xs text-muted-foreground">
                  Max {p.maxSelections} selection(s) · {p.allowAbstain ? 'Abstention allowed' : 'No abstention'}
                </p>
              </div>
              <div className="divide-y rounded-lg border">
                {p.candidates.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-slate-200 text-xs font-semibold text-slate-600">
                        {c.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.faculty}</p>
                    </div>
                    <CandidateStatusBadge status={c.status} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
