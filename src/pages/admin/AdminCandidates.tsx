import { useCallback, useEffect, useState } from 'react'
import { Check, X, Eye, Search, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CandidateStatusBadge } from '@/components/StatusBadge'
import { formatDate, type CandidateStatus } from '@/lib/mock-data'
import { useElections } from '@/components/elections-provider'

interface Application {
  id: string
  institutionalId: string
  email: string
  name: string
  yearGroup: string | null
  manifesto: string
  bio: string
  photoUrl: string | null
  status: CandidateStatus
  positionId: string
  positionTitle: string
  electionName: string
  submittedAt: string
}

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
}

export default function AdminCandidates() {
  const { refresh: refreshElections } = useElections()
  const [rows, setRows] = useState<Application[]>([])
  const [tab, setTab] = useState<'pending' | 'all'>('pending')
  const [query, setQuery] = useState('')
  const [viewing, setViewing] = useState<Application | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/aspirants/applications', { headers: { Accept: 'application/json' } })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Unable to load aspirant applications')
      setRows((data.applications as Application[]).map((row) => ({ ...row, status: row.status.toLowerCase() as CandidateStatus })))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load aspirant applications')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function review(application: Application, action: 'approve' | 'reject') {
    setActionId(application.id)
    setError('')
    try {
      const response = await fetch('/api/aspirants/applications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ id: application.id, action }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Unable to review this application')
      setViewing(null)
      await load()
      if (action === 'approve') await refreshElections()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to review this application')
    } finally {
      setActionId('')
    }
  }

  const filtered = rows.filter((row) => {
    const matchesTab = tab === 'all' || row.status === 'submitted' || row.status === 'under_review'
    const q = query.toLowerCase()
    return matchesTab && (!q || `${row.name} ${row.institutionalId} ${row.positionTitle}`.toLowerCase().includes(q))
  })

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Aspirant management</h1>
        <p className="mt-1 text-muted-foreground">Review SRC aspirant registrations, verify eligibility, and approve or reject candidates.</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
          <TabsList>
            <TabsTrigger value="pending">Pending review</TabsTrigger>
            <TabsTrigger value="all">All applications</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="w-64 pl-9" placeholder="Search aspirants…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <Button variant="outline" size="icon" aria-label="Refresh applications" onClick={() => void load()}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <Card>
        <CardContent className="divide-y p-0">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No aspirant applications match this view.</p>
          ) : filtered.map((application) => (
            <div key={application.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
              <Avatar className="h-10 w-10">
                {application.photoUrl && <AvatarImage src={application.photoUrl} alt={application.name} className="object-cover" loading="lazy" />}
                <AvatarFallback className="bg-secondary text-xs font-bold text-secondary-foreground">{initials(application.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{application.name}</p>
                <p className="text-xs text-muted-foreground">{application.positionTitle} · {application.institutionalId}</p>
              </div>
              <p className="hidden text-xs text-muted-foreground sm:block">Submitted {formatDate(application.submittedAt)}</p>
              <CandidateStatusBadge status={application.status} />
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => setViewing(application)}><Eye className="mr-1 h-4 w-4" /> Review</Button>
                {(application.status === 'submitted' || application.status === 'under_review') && (
                  <>
                    <Button size="sm" disabled={!!actionId} onClick={() => void review(application, 'approve')}><Check className="mr-1 h-4 w-4" /> Approve</Button>
                    <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" disabled={!!actionId} onClick={() => void review(application, 'reject')}><X className="mr-1 h-4 w-4" /> Reject</Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!viewing} onOpenChange={() => setViewing(null)}>
        <DialogContent className="max-w-lg">
          {viewing && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  {viewing.photoUrl ? (
                    <img src={viewing.photoUrl} alt={viewing.name} className="h-16 w-16 rounded-full border object-cover" />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary font-bold">{initials(viewing.name)}</div>
                  )}
                  <div>
                    <DialogTitle>{viewing.name}</DialogTitle>
                    <DialogDescription>{viewing.positionTitle} · {viewing.electionName}</DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3 rounded-lg bg-secondary p-3 text-xs">
                  <span>ID: {viewing.institutionalId}</span>
                  <span>{viewing.yearGroup || 'Year group not provided'}</span>
                  <span className="col-span-2 break-all">{viewing.email}</span>
                </div>
                <div><p className="mb-1 font-semibold">Manifesto</p><p className="whitespace-pre-wrap text-muted-foreground">{viewing.manifesto}</p></div>
                <div><p className="mb-1 font-semibold">Biography</p><p className="whitespace-pre-wrap text-muted-foreground">{viewing.bio}</p></div>
                {(viewing.status === 'submitted' || viewing.status === 'under_review') && (
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" disabled={!!actionId} onClick={() => void review(viewing, 'reject')}>Reject</Button>
                    <Button disabled={!!actionId} onClick={() => void review(viewing, 'approve')}>
                      {actionId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />} Approve aspirant
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
