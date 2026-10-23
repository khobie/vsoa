import { useState } from 'react'
import { ScrollText, CheckCircle2, AlertTriangle, XCircle, Hash } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { auditEvents, elections, formatDateTime } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

const outcomeIcon = {
  success: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  failure: <XCircle className="h-4 w-4 text-red-500" />,
}

export default function AdminAudit() {
  const [filter, setFilter] = useState('all')

  const filtered = auditEvents.filter(
    (e) => filter === 'all' || e.electionId === filter || (filter === 'system' && !e.electionId)
  )

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <ScrollText className="h-6 w-6 text-primary" /> Audit trail
        </h1>
        <p className="mt-1 text-muted-foreground">
          Tamper-evident, append-only record of significant actions. Ballot choices are never logged.
        </p>
      </div>

      <Alert className="border-slate-200 bg-slate-50">
        <Hash className="h-4 w-4 text-slate-500" />
        <AlertDescription className="text-slate-700">
          Each event includes the hash of the previous event, so altered history is detectable. Note: hash
          chains reveal tampering but cannot by themselves prevent a sufficiently privileged operator from
          rewriting all records — this is documented in the security model.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">Events ({filtered.length})</CardTitle>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All events</SelectItem>
              <SelectItem value="system">System-wide only</SelectItem>
              {elections.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="divide-y p-0">
          {filtered.map((e) => (
            <div key={e.id} className="flex items-start gap-3 px-5 py-4">
              <div className="mt-0.5">{outcomeIcon[e.outcome]}</div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold',
                      e.outcome === 'warning'
                        ? 'bg-amber-100 text-amber-800'
                        : e.outcome === 'failure'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-slate-100 text-slate-700'
                    )}
                  >
                    {e.type}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDateTime(e.timestamp)}</span>
                </div>
                <p className="mt-1 text-sm">{e.detail}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Actor: {e.actor}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
