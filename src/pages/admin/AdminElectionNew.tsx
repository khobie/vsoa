import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft, ArrowRight, Plus, Trash2, Eye, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { institution } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

interface DraftPosition {
  title: string
  maxSelections: number
  allowAbstain: boolean
}

const steps = ['Election details', 'Positions & rules', 'Schedule', 'Preview & create']

export default function AdminElectionNew() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)

  const [name, setName] = useState('')
  const [organization, setOrganization] = useState('')
  const [description, setDescription] = useState('')
  const [voterGroup, setVoterGroup] = useState('all')

  const [positions, setPositions] = useState<DraftPosition[]>([
    { title: '', maxSelections: 1, allowAbstain: true },
  ])

  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')

  const canNext =
    step === 0
      ? name.trim() && organization.trim()
      : step === 1
        ? positions.every((p) => p.title.trim()) && positions.length > 0
        : step === 2
          ? startAt && endAt && new Date(endAt) > new Date(startAt)
          : true

  function addPosition() {
    setPositions((p) => [...p, { title: '', maxSelections: 1, allowAbstain: true }])
  }

  function updatePosition(i: number, patch: Partial<DraftPosition>) {
    setPositions((ps) => ps.map((p, idx) => (idx === i ? { ...p, ...patch } : p)))
  }

  function removePosition(i: number) {
    setPositions((ps) => ps.filter((_, idx) => idx !== i))
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/admin/elections')}>
        <ArrowLeft className="mr-1.5 h-4 w-4" /> Cancel
      </Button>

      <div>
        <h1 className="text-2xl font-bold">Create election</h1>
        <p className="mt-1 text-muted-foreground">
          Elections open for voting only after full configuration and authorization.
        </p>
      </div>

      {/* Stepper */}
      <ol className="flex flex-wrap items-center gap-2">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold',
                i < step
                  ? 'bg-emerald-500 text-white'
                  : i === step
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-slate-200 text-slate-500'
              )}
            >
              {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </span>
            <span className={cn('text-sm', i === step ? 'font-semibold' : 'text-muted-foreground')}>{s}</span>
            {i < steps.length - 1 && <span className="mx-1 h-px w-6 bg-slate-300" />}
          </li>
        ))}
      </ol>

      {/* Step 1: details */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Election details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Election name *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. SRC General Election 2026" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org">Organization *</Label>
              <Input id="org" value={organization} onChange={(e) => setOrganization(e.target.value)} placeholder="e.g. Students' Representative Council" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Description</Label>
              <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Purpose and scope of this election" rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Eligible voter group</Label>
              <Select value={voterGroup} onValueChange={setVoterGroup}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All registered students</SelectItem>
                  <SelectItem value="undergrad">Undergraduate students only</SelectItem>
                  <SelectItem value="postgrad">Postgraduate students only</SelectItem>
                  <SelectItem value="faculty">Specific faculty (select after creation)</SelectItem>
                  <SelectItem value="department">Specific department (select after creation)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: positions */}
      {step === 1 && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Positions & voting rules</CardTitle>
            <Button variant="outline" size="sm" onClick={addPosition}>
              <Plus className="mr-1 h-4 w-4" /> Add position
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {positions.map((p, i) => (
              <div key={i} className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-3">
                    <div className="space-y-1">
                      <Label>Position title *</Label>
                      <Input
                        value={p.title}
                        onChange={(e) => updatePosition(i, { title: e.target.value })}
                        placeholder="e.g. SRC President"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-6">
                      <div className="space-y-1">
                        <Label>Max selections</Label>
                        <Select
                          value={String(p.maxSelections)}
                          onValueChange={(v) => updatePosition(i, { maxSelections: Number(v) })}
                        >
                          <SelectTrigger className="w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 (plurality)</SelectItem>
                            <SelectItem value="2">2</SelectItem>
                            <SelectItem value="3">3</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2 pt-5">
                        <Switch
                          id={`abstain-${i}`}
                          checked={p.allowAbstain}
                          onCheckedChange={(v) => updatePosition(i, { allowAbstain: v })}
                        />
                        <Label htmlFor={`abstain-${i}`}>Allow abstention</Label>
                      </div>
                    </div>
                  </div>
                  {positions.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => removePosition(i)} aria-label="Remove position">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Default rule: single-choice plurality — the candidate with the most valid votes wins. Ties are
              reported, never resolved silently. Candidates are added after the election is created.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Step 3: schedule */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="start">Voting opens *</Label>
                <Input id="start" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end">Voting closes *</Label>
                <Input id="end" type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Time zone: Africa/Accra (GMT) — {institution.name}. Voting closes automatically at the end
              time; no ballots are accepted afterwards.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Step 4: preview */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" /> Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-lg font-semibold">{name || '—'}</p>
              <p className="text-sm text-muted-foreground">{organization || '—'}</p>
              {description && <p className="mt-2 text-sm">{description}</p>}
            </div>
            <Separator />
            <div>
              <p className="mb-2 text-sm font-semibold">Positions ({positions.length})</p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {positions.map((p, i) => (
                  <li key={i}>
                    • {p.title} — max {p.maxSelections} selection(s), {p.allowAbstain ? 'abstention allowed' : 'no abstention'}
                  </li>
                ))}
              </ul>
            </div>
            <Separator />
            <p className="text-sm">
              <span className="font-semibold">Window:</span>{' '}
              {startAt ? new Date(startAt).toLocaleString('en-GB') : '—'} →{' '}
              {endAt ? new Date(endAt).toLocaleString('en-GB') : '—'} (GMT)
            </p>
            <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              The election is created as a <strong>draft</strong>. Add candidates, import eligible voters,
              then schedule and open voting through the authorized workflow.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
        </Button>
        {step < steps.length - 1 ? (
          <Button disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
            Continue <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        ) : (
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => navigate('/admin/elections')}>
            <CheckCircle2 className="mr-1.5 h-4 w-4" /> Create draft election
          </Button>
        )}
      </div>
    </div>
  )
}
