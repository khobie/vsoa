import { useNavigate } from 'react-router'
import { BarChart3, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { publishedElections, formatDate, turnoutPercent } from '@/lib/mock-data'

export default function ResultsIndex() {
  const navigate = useNavigate()
  const published = publishedElections()

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <BarChart3 className="h-6 w-6 text-primary" /> Published results
      </h1>
      <p className="mt-1 text-muted-foreground">
        Officially verified and published election outcomes.
      </p>
      <div className="mt-6 space-y-3">
        {published.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No results have been published yet.
            </CardContent>
          </Card>
        )}
        {published.map((e) => (
          <Card key={e.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div>
                <p className="font-medium">{e.name}</p>
                <p className="text-sm text-muted-foreground">
                  Published {e.resultsPublishedAt ? formatDate(e.resultsPublishedAt) : '—'} · Turnout{' '}
                  {turnoutPercent(e)}% ({e.participated.toLocaleString()} of {e.eligibleVoters.toLocaleString()})
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate(`/results/${e.id}`)}>
                View results <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
