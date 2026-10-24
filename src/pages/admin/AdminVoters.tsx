import { useCallback, useEffect, useState } from 'react'
import {
  Upload, Search, ShieldCheck, FileSpreadsheet, Users, MailCheck, MailX,
  CheckCircle2, RefreshCw, Download, Loader2, KeyRound,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

interface Voter {
  id: string
  institutionalId: string
  name: string
  email: string
  faculty: string | null
  department: string | null
  yearGroup: string | null
  isActive: boolean
  tokenCreatedAt: string | null
  tokenExpiresAt: string | null
  tokenConsumedAt: string | null
  tokenInvalidatedAt: string | null
  deliveryStatus: 'pending' | 'sent' | 'failed' | null
  deliveryDetail: string | null
  lastSentAt: string | null
  votedAt: string | null
}

interface Summary {
  total: number
  tokensGenerated: number
  sent: number
  failed: number
  voted: number
  turnout: number
}

interface ImportStudent {
  institutionalId: string
  name: string
  email: string
  faculty: string
  department: string
  yearGroup: string
}

const emptySummary: Summary = { total: 0, tokensGenerated: 0, sent: 0, failed: 0, voted: 0, turnout: 0 }

function parseCsvRows(text: string) {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const source = text.replace(/^\uFEFF/, '')
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (character === '"') quoted = false
      else field += character
    } else if (character === '"') quoted = true
    else if (character === ',') {
      row.push(field.trim())
      field = ''
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && source[index + 1] === '\n') index += 1
      row.push(field.trim())
      if (row.some((value) => value)) rows.push(row)
      row = []
      field = ''
    } else field += character
  }
  row.push(field.trim())
  if (row.some((value) => value)) rows.push(row)
  if (quoted) throw new Error('The CSV contains an unclosed quoted field')
  return rows
}

function parseStudentCsv(text: string): ImportStudent[] {
  const rows = parseCsvRows(text)
  if (rows.length < 2) throw new Error('The CSV needs a header and at least one student')
  const headers = rows[0].map((header) => header.trim().toLowerCase().replace(/[\s-]+/g, '_'))
  const find = (...aliases: string[]) => headers.findIndex((header) => aliases.includes(header))
  const columns = {
    id: find('student_id', 'studentid', 'institutional_id', 'institutionalid'),
    name: find('full_name', 'fullname', 'name'),
    email: find('email', 'email_address'),
    faculty: find('faculty', 'school'),
    department: find('department', 'programme', 'program'),
    year: find('year_group', 'yeargroup', 'year', 'level'),
  }
  if (columns.id < 0 || columns.name < 0 || columns.email < 0) {
    throw new Error('Required headers: student_id, full_name, email')
  }
  if (rows.length - 1 > 500) throw new Error('Import no more than 500 students at a time')
  return rows.slice(1).map((row) => ({
    institutionalId: row[columns.id] ?? '',
    name: row[columns.name] ?? '',
    email: row[columns.email] ?? '',
    faculty: columns.faculty >= 0 ? row[columns.faculty] ?? '' : 'School of Anaesthesia Ridge',
    department: columns.department >= 0 ? row[columns.department] ?? '' : '',
    yearGroup: columns.year >= 0 ? row[columns.year] ?? '' : '',
  }))
}

function tokenLabel(voter: Voter) {
  if (!voter.tokenCreatedAt) return 'Not generated'
  if (voter.tokenConsumedAt) return 'Used for sign-in'
  if (voter.tokenInvalidatedAt) return 'Replaced'
  if (voter.tokenExpiresAt && new Date(voter.tokenExpiresAt).getTime() <= Date.now()) return 'Expired'
  if (voter.deliveryStatus === 'failed') return 'Email failed'
  if (voter.deliveryStatus === 'sent') return 'Token sent'
  return 'Pending email'
}

function tokenStyle(voter: Voter) {
  if (voter.deliveryStatus === 'failed') return 'border-red-200 bg-red-50 text-red-700'
  if (voter.tokenConsumedAt) return 'border-blue-200 bg-blue-50 text-blue-700'
  if (voter.tokenInvalidatedAt || (voter.tokenExpiresAt && new Date(voter.tokenExpiresAt).getTime() <= Date.now())) return 'border-slate-200 bg-slate-50 text-slate-600'
  if (voter.deliveryStatus === 'sent') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  return 'border-amber-200 bg-amber-50 text-amber-700'
}

export default function AdminVoters() {
  const [voters, setVoters] = useState<Voter[]>([])
  const [summary, setSummary] = useState<Summary>(emptySummary)
  const [emailConfigured, setEmailConfigured] = useState(true)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [importStudents, setImportStudents] = useState<ImportStudent[]>([])
  const [fileName, setFileName] = useState('')
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [notice, setNotice] = useState('')

  const loadVoters = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/voters', { headers: { Accept: 'application/json' } })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Unable to load the voter register')
      setVoters(data.voters)
      setSummary(data.summary)
      setEmailConfigured(data.emailConfigured)
    } catch (cause) {
      setImportErrors([cause instanceof Error ? cause.message : 'Unable to load the voter register'])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadVoters() }, [loadVoters])

  const filtered = voters.filter((voter) => {
    const search = query.toLowerCase()
    return !search || voter.name.toLowerCase().includes(search) || voter.institutionalId.toLowerCase().includes(search) || voter.email.toLowerCase().includes(search)
  })

  async function chooseFile(file?: File) {
    setImportErrors([])
    setImportStudents([])
    setFileName(file?.name ?? '')
    if (!file) return
    if (file.size > 2_000_000) return setImportErrors(['The CSV must be no larger than 2 MB'])
    try {
      setImportStudents(parseStudentCsv(await file.text()))
    } catch (cause) {
      setImportErrors([cause instanceof Error ? cause.message : 'Unable to read this CSV'])
    }
  }

  async function importRegister() {
    if (!importStudents.length) return
    setImporting(true)
    setImportErrors([])
    try {
      const response = await fetch('/api/voters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ electionId: 'el-src-2026', students: importStudents }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error([data.error, ...(data.details ?? [])].filter(Boolean).join('\n'))
      setNotice(`${data.imported} student(s) imported. ${data.sent} token email(s) sent; ${data.failed} need attention.`)
      setImportOpen(false)
      setImportStudents([])
      setFileName('')
      await loadVoters()
    } catch (cause) {
      setImportErrors(String(cause instanceof Error ? cause.message : cause).split('\n'))
    } finally {
      setImporting(false)
    }
  }

  async function issueReplacement(institutionalId: string) {
    setBusyId(institutionalId)
    setNotice('')
    try {
      const response = await fetch('/api/voters/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ institutionalId, electionId: 'el-src-2026' }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Unable to issue a replacement token')
      setNotice(data.sent ? `A new token was sent to ${institutionalId}. All older tokens are invalid.` : `A new token was generated for ${institutionalId}, but email delivery failed.`)
      await loadVoters()
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Unable to issue a replacement token')
    } finally {
      setBusyId('')
    }
  }

  async function retryFailed() {
    setBusyId('bulk')
    setNotice('')
    try {
      const response = await fetch('/api/voters/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ action: 'retry-failed', electionId: 'el-src-2026' }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Unable to retry token delivery')
      setNotice(`${data.sent} token email(s) sent; ${data.failed} still need attention. Previous tokens were invalidated.`)
      await loadVoters()
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Unable to retry token delivery')
    } finally {
      setBusyId('')
    }
  }

  function downloadTemplate() {
    const csv = 'student_id,full_name,email,department,year_group\nSAR-0001,Example Student,student@example.com,Anaesthesia,Level 300\n'
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'src-voter-register-template.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Voter register & secure tokens</h1>
          <p className="mt-1 text-muted-foreground">Import eligible students, monitor token delivery, and track participation without seeing ballot choices.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void retryFailed()} disabled={busyId !== '' || (!summary.failed && summary.tokensGenerated === summary.total)}>
            {busyId === 'bulk' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Retry missing / failed
          </Button>
          <Dialog open={importOpen} onOpenChange={setImportOpen}>
            <DialogTrigger asChild><Button><Upload className="mr-2 h-4 w-4" /> Import students</Button></DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Import students and issue tokens</DialogTitle>
                <DialogDescription>Each valid student is added to the SRC election and automatically emailed a new, unique voting token.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="rounded-lg border-2 border-dashed p-6 text-center">
                  <FileSpreadsheet className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                  <p className="text-sm font-medium">Choose the official student CSV</p>
                  <p className="mt-1 text-xs text-muted-foreground">Required: student_id, full_name, email. Optional: faculty, department, year_group.</p>
                  <Input className="mx-auto mt-4 max-w-xs cursor-pointer" type="file" accept=".csv,text/csv" onChange={(event) => void chooseFile(event.target.files?.[0])} />
                  <Button variant="link" size="sm" onClick={downloadTemplate}><Download className="mr-1 h-3.5 w-3.5" /> Download CSV template</Button>
                </div>
                {fileName && <p className="text-sm"><strong>{fileName}</strong>{importStudents.length ? ` — ${importStudents.length} student(s) ready` : ''}</p>}
                {importErrors.length > 0 && (
                  <Alert variant="destructive"><AlertTitle>Import needs attention</AlertTitle><AlertDescription><ul className="list-inside list-disc">{importErrors.slice(0, 12).map((error) => <li key={error}>{error}</li>)}</ul></AlertDescription></Alert>
                )}
                <Alert className="border-amber-200 bg-amber-50"><KeyRound className="h-4 w-4 text-amber-600" /><AlertDescription className="text-amber-800">Importing an existing student issues a replacement token and invalidates their old one. Tokens are never displayed to administrators.</AlertDescription></Alert>
                <Button className="w-full" disabled={!importStudents.length || importing} onClick={() => void importRegister()}>
                  {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {importing ? 'Importing and sending tokens…' : `Import ${importStudents.length || ''} student(s) and send tokens`}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {!emailConfigured && (
        <Alert variant="destructive"><MailX className="h-4 w-4" /><AlertTitle>Email delivery is not configured</AlertTitle><AlertDescription>Connect Resend with RESEND_API_KEY and a verified EMAIL_FROM address, then use “Retry missing / failed”.</AlertDescription></Alert>
      )}
      {notice && <Alert className="border-blue-200 bg-blue-50"><ShieldCheck className="h-4 w-4 text-blue-600" /><AlertDescription className="text-blue-900">{notice}</AlertDescription></Alert>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="flex items-center gap-3 py-4"><Users className="h-8 w-8 text-primary" /><div><p className="text-xl font-bold">{summary.total.toLocaleString()}</p><p className="text-xs text-muted-foreground">Eligible students</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 py-4"><MailCheck className="h-8 w-8 text-emerald-600" /><div><p className="text-xl font-bold">{summary.sent.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">/ {summary.tokensGenerated}</span></p><p className="text-xs text-muted-foreground">Emails sent / tokens generated</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 py-4"><CheckCircle2 className="h-8 w-8 text-blue-600" /><div><p className="text-xl font-bold">{summary.voted.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">({summary.turnout}%)</span></p><p className="text-xs text-muted-foreground">Students voted / turnout</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 py-4"><MailX className="h-8 w-8 text-red-500" /><div><p className="text-xl font-bold">{summary.failed.toLocaleString()}</p><p className="text-xs text-muted-foreground">Email deliveries needing attention</p></div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex-col gap-4 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <div><CardTitle className="text-lg">Student access and participation</CardTitle><p className="mt-1 text-xs text-muted-foreground">“Voted” confirms participation only. No candidate selections are available here.</p></div>
          <div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="w-full pl-9 sm:w-72" placeholder="Search name, ID or email…" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Contact & details</TableHead><TableHead>Token / email</TableHead><TableHead>Participation</TableHead><TableHead className="text-right">Secure resend</TableHead></TableRow></TableHeader>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={5} className="py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></TableCell></TableRow>
                : filtered.length === 0 ? <TableRow><TableCell colSpan={5} className="py-12 text-center text-muted-foreground">{voters.length ? 'No students match this search.' : 'No students imported yet. Use “Import students” to begin.'}</TableCell></TableRow>
                  : filtered.map((voter) => (
                    <TableRow key={voter.id}>
                      <TableCell><p className="font-medium">{voter.name}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{voter.institutionalId}</p></TableCell>
                      <TableCell><p className="text-xs">{voter.email}</p><p className="mt-1 text-xs text-muted-foreground">{[voter.department, voter.yearGroup].filter(Boolean).join(' · ') || '—'}</p></TableCell>
                      <TableCell><Badge variant="outline" className={tokenStyle(voter)} title={voter.deliveryDetail ?? ''}>{tokenLabel(voter)}</Badge>{voter.deliveryDetail && <p className="mt-1 max-w-48 text-xs text-red-600">{voter.deliveryDetail}</p>}<p className="mt-1 text-xs text-muted-foreground">{voter.lastSentAt ? `Sent ${new Date(voter.lastSentAt).toLocaleString('en-GB')}` : 'No email sent'}</p></TableCell>
                      <TableCell>{voter.votedAt ? <><Badge className="bg-emerald-600">Voted</Badge><p className="mt-1 text-xs text-muted-foreground">{new Date(voter.votedAt).toLocaleString('en-GB')}</p></> : <Badge variant="outline">Not voted</Badge>}</TableCell>
                      <TableCell className="text-right"><Button variant="outline" size="sm" disabled={busyId !== '' || Boolean(voter.votedAt)} title="Issue a new token and invalidate every older token" onClick={() => void issueReplacement(voter.institutionalId)}>{busyId === voter.institutionalId ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}New token</Button></TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
