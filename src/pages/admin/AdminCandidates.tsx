import { useMemo, useState } from 'react'
import { Check, X, Eye, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CandidateStatusBadge } from '@/components/StatusBadge'
import { elections, formatDate, type Candidate, type CandidateStatus } from '@/lib/mock-data'

interface Row extends Candidate {
  positionTitle: string
  electionName: string
}

export default function AdminCandidates() {
  const [tab, setTab] = useState<'pending' | 'all'>('pending')
  const [query, setQuery] = useState('')
  const [viewing, setViewing] = useState<Row | null>(null)

  const rows: Row[] = useMemo(
    () =>
      elections.flatMap((e) =>
        e.positions.flatMap((p) =>
          p.candidates.map((c) => ({ ...c, positionTitle: p.title, electionName: e.name }))
        )
      ),
    []
  )

  const filtered = rows.filter((r) => {
    const matchesTab = tab === 'all' || r.status === 'submitted' || r.status === 'under_review'
    const q = query.toLowerCase()
    const matchesQuery =
      !q || r.name.toLowerCase().includes(q) || r.positionTitle.toLowerCase().includes(q) || r.electionName.toLowerCase().includes(q)
    return matchesTab && matchesQuery
  })

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Candidate management</h1>
        <p className="mt-1 text-muted-foreground">
          Review nominations, verify eligibility, approve or reject. Every decision is audit-logged.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="pending">Pending review</TabsTrigger>
            <TabsTrigger value="all">All candidates</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="w-64 pl-9" placeholder="Search candidates…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      <Card>
        <CardContent className="divide-y p-0">
          {filtered.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">No candidates match this view.</p>
          )}
          {filtered.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-slate-200 text-xs font-bold text-slate-600">{c.initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  {c.positionTitle} · {c.electionName}
                </p>
              </div>
              <p className="hidden text-xs text-muted-foreground sm:block">Submitted {formatDate(c.submittedAt)}</p>
              <CandidateStatusBadge status={c.status as CandidateStatus} />
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => setViewing(c)}>
                  <Eye className="mr-1 h-4 w-4" /> Review
                </Button>
                {(c.status === 'submitted' || c.status === 'under_review') && (
                  <>
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                      <Check className="mr-1 h-4 w-4" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50">
                      <X className="mr-1 h-4 w-4" /> Reject
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Review dialog */}
      <Dialog open={!!viewing} onOpenChange={() => setViewing(null)}>
        <DialogContent className="max-w-lg">
          {viewing && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary font-bold text-primary-foreground">{viewing.initials}</AvatarFallback>
                  </Avatar>
                  <div>
                    <DialogTitle>{viewing.name}</DialogTitle>
                    <DialogDescription>
                      {viewing.positionTitle} · {viewing.electionName}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="mb-1 font-semibold">Manifesto</p>
                  <p className="text-muted-foreground">{viewing.manifesto}</p>
                </div>
                <div>
                  <p className="mb-1 font-semibold">Biography</p>
                  <p className="text-muted-foreground">{viewing.bio}</p>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3 text-xs text-muted-foreground">
                  <span>{viewing.faculty}</span>
                  <span>Submitted {formatDate(viewing.submittedAt)}</span>
                  <CandidateStatusBadge status={viewing.status as CandidateStatus} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Institutional ID and eligibility checks are visible only to authorized electoral officers.
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
