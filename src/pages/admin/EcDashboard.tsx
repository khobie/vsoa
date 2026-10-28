import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { AlertCircle, ArrowRight, CheckCircle2, Clock3, Loader2, RefreshCw, UserCheck, Users } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useElections } from '@/components/elections-provider'

interface Summary {
  registeredStudents: number
  aspirants: number
  pending: number
}

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
}

export default function EcDashboard() {
  const navigate = useNavigate()
  const { elections } = useElections()
  const [summary, setSummary] = useState<Summary>({ registeredStudents: 0, aspirants: 0, pending: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/aspirants/applications?summary=1', { headers: { Accept: 'application/json' } })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Unable to load EC registration totals')
      setSummary(data.summary)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load EC registration totals')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const stats = [
    { label: 'Students registered', value: summary.registeredStudents, icon: Users, tone: 'text-primary' },
    { label: 'Aspirants registered', value: summary.aspirants, icon: UserCheck, tone: 'text-emerald-600' },
    { label: 'Awaiting approval', value: summary.pending, icon: Clock3, tone: 'text-amber-600' },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">EC Dashboard</h1>
          <p className="mt-1 text-muted-foreground">Registration totals and candidate review. Voting choices and token management are not available here.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh totals
        </Button>
      </div>

      {error && (
        <p className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" /> {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 py-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100">
                <stat.icon className={`h-5 w-5 ${stat.tone}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{loading ? '—' : stat.value.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Candidate review</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Review aspirant details, then approve or reject their applications.</p>
          </div>
          <Button size="sm" onClick={() => navigate('/admin/candidates')}>
            Review aspirants <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardHeader>
      </Card>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <h2 className="text-lg font-semibold">Approved candidate arrangement</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {elections[0]?.positions.map((position) => (
            <Card key={position.id}>
              <CardHeader>
                <CardTitle className="text-base">{position.title}</CardTitle>
                <p className="text-xs text-muted-foreground">{position.candidates.length} approved candidate{position.candidates.length === 1 ? '' : 's'}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {position.candidates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No approved candidates yet.</p>
                ) : position.candidates.map((candidate, index) => (
                  <div key={candidate.id} className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
                    <span className="w-5 text-center text-xs font-semibold text-muted-foreground">{index + 1}</span>
                    <Avatar className="h-10 w-10">
                      {candidate.photoUrl && <AvatarImage src={candidate.photoUrl} alt={candidate.name} />}
                      <AvatarFallback>{initials(candidate.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{candidate.name}</p>
                      <p className="text-xs text-muted-foreground">Approved</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {loading && !summary.aspirants && (
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Updating registration totals…</p>
      )}
    </div>
  )
}
