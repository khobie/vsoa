import { useState } from 'react'
import { Upload, Search, ShieldAlert, FileSpreadsheet, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { voterRegister } from '@/lib/mock-data'

const statusStyles: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending_verification: 'bg-amber-50 text-amber-700 border-amber-200',
  deactivated: 'bg-slate-100 text-slate-500 border-slate-200',
}

export default function AdminVoters() {
  const [query, setQuery] = useState('')
  const filtered = voterRegister.filter(
    (v) =>
      !query ||
      v.name.toLowerCase().includes(query.toLowerCase()) ||
      v.institutionalId.includes(query) ||
      v.email.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Voter register</h1>
          <p className="mt-1 text-muted-foreground">
            Eligibility is verified against the institutional register. Showing a sample of the register.
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Upload className="mr-1.5 h-4 w-4" /> Import CSV
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Import voter register</DialogTitle>
              <DialogDescription>
                Upload the official register export. Imports are validated, deduplicated, and audit-logged.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center">
                <FileSpreadsheet className="mb-3 h-10 w-10 text-muted-foreground" />
                <p className="text-sm font-medium">Drop your CSV here or click to browse</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Required columns: institutional_id, name, email, faculty, department
                </p>
                <Button variant="outline" size="sm" className="mt-4">
                  Choose file
                </Button>
              </div>
              <Alert className="border-blue-200 bg-blue-50">
                <ShieldAlert className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  Duplicate institutional IDs are rejected by a database constraint. Flagged records cannot
                  vote until manually verified by an authorized officer.
                </AlertDescription>
              </Alert>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <p className="text-xl font-bold">12,480</p>
              <p className="text-xs text-muted-foreground">Total registered</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Users className="h-8 w-8 text-emerald-600" />
            <div>
              <p className="text-xl font-bold">12,477</p>
              <p className="text-xs text-muted-foreground">Active & eligible</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <ShieldAlert className="h-8 w-8 text-amber-500" />
            <div>
              <p className="text-xl font-bold">3</p>
              <p className="text-xs text-muted-foreground">Pending verification</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">Register records</CardTitle>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="w-64 pl-9" placeholder="Search name, ID or email…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Institutional ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Faculty</TableHead>
                <TableHead className="text-right">Eligible elections</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-mono text-xs">{v.institutionalId}</TableCell>
                  <TableCell className="font-medium">{v.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{v.email}</TableCell>
                  <TableCell className="text-xs">{v.faculty}</TableCell>
                  <TableCell className="text-right">{v.eligibleElections}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusStyles[v.status]}>
                      {v.status === 'pending_verification' ? 'Pending verification' : v.status === 'active' ? 'Active' : 'Deactivated'}
                    </Badge>
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
