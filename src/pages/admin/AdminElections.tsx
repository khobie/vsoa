import { useNavigate } from 'react-router'
import { Plus, Eye, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ElectionStatusBadge, VerificationBadge } from '@/components/StatusBadge'
import { formatDateTime, turnoutPercent } from '@/lib/mock-data'
import { useElections } from '@/components/elections-provider'

export default function AdminElections() {
  const navigate = useNavigate()
  const { elections } = useElections()

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Elections</h1>
          <p className="mt-1 text-muted-foreground">Create, schedule, monitor and manage all elections.</p>
        </div>
        <Button onClick={() => navigate('/admin/elections/new')}>
          <Plus className="mr-1.5 h-4 w-4" /> New election
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Election</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Window</TableHead>
                <TableHead className="text-right">Eligible</TableHead>
                <TableHead className="text-right">Turnout</TableHead>
                <TableHead>Verification</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {elections.map((e) => (
                <TableRow key={e.id} className="cursor-pointer" onClick={() => navigate(`/admin/elections/${e.id}`)}>
                  <TableCell>
                    <p className="font-medium">{e.name}</p>
                    <p className="text-xs text-muted-foreground">{e.organization}</p>
                  </TableCell>
                  <TableCell>
                    <ElectionStatusBadge status={e.status} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateTime(e.startAt)}
                    <br />
                    {formatDateTime(e.endAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      {e.eligibleVoters.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium">{turnoutPercent(e)}%</TableCell>
                  <TableCell>
                    <VerificationBadge status={e.verificationStatus} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(ev) => {
                        ev.stopPropagation()
                        navigate(`/admin/elections/${e.id}`)
                      }}
                    >
                      <Eye className="mr-1 h-4 w-4" /> Manage
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
