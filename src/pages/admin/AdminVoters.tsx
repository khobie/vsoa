import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Upload, Search, ShieldCheck, FileSpreadsheet, Users, CheckCircle2, RefreshCw,
  Download, Loader2, KeyRound, MessageSquareText, Phone, Send, Pencil, Filter, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

interface Voter {
  id: string; institutionalId: string; name: string; email: string
  department: string | null; yearGroup: string | null
  phone: string | null; phoneVerified: boolean | null; registeredAt: string | null
  tokenId: string | null; tokenCreatedAt: string | null; tokenExpiresAt: string | null
  tokenConsumedAt: string | null; tokenInvalidatedAt: string | null
  smsStatus: 'pending' | 'sent' | 'delivered' | 'failed' | null
  smsDetail: string | null; smsSentAt: string | null; votedAt: string | null
}
interface Summary { total: number; registered: number; tokensGenerated: number; sent: number; delivered: number; failed: number; pending: number; voted: number; turnout: number }
interface ImportStudent { institutionalId: string; name: string; email: string; faculty: string; department: string; yearGroup: string }

const emptySummary: Summary = { total: 0, registered: 0, tokensGenerated: 0, sent: 0, delivered: 0, failed: 0, pending: 0, voted: 0, turnout: 0 }

function parseCsvRows(text: string) {
  const rows: string[][] = []; let row: string[] = []; let field = ''; let quoted = false
  const source = text.replace(/^\uFEFF/, '')
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') { field += '"'; index += 1 }
      else if (character === '"') quoted = false
      else field += character
    } else if (character === '"') quoted = true
    else if (character === ',') { row.push(field.trim()); field = '' }
    else if (character === '\n' || character === '\r') {
      if (character === '\r' && source[index + 1] === '\n') index += 1
      row.push(field.trim()); if (row.some((value) => value)) rows.push(row); row = []; field = ''
    } else field += character
  }
  row.push(field.trim()); if (row.some((value) => value)) rows.push(row)
  if (quoted) throw new Error('The CSV contains an unclosed quoted field')
  return rows
}

function parseStudentCsv(text: string): ImportStudent[] {
  const rows = parseCsvRows(text)
  if (rows.length < 2) throw new Error('The CSV needs a header and at least one student')
  const headers = rows[0].map((header) => header.trim().toLowerCase().replace(/[\s-]+/g, '_'))
  const find = (...aliases: string[]) => headers.findIndex((header) => aliases.includes(header))
  const columns = {
    id: find('student_id', 'studentid', 'institutional_id', 'institutionalid'), name: find('full_name', 'fullname', 'name'),
    email: find('email', 'email_address'), faculty: find('faculty', 'school'), department: find('department', 'programme', 'program'),
    year: find('year_group', 'yeargroup', 'year', 'level'),
  }
  if (columns.id < 0 || columns.name < 0) throw new Error('Required headers: student_id, full_name. Email is optional.')
  if (rows.length - 1 > 500) throw new Error('Import no more than 500 students at a time')
  return rows.slice(1).map((row) => ({
    institutionalId: row[columns.id] ?? '', name: row[columns.name] ?? '', email: columns.email >= 0 ? row[columns.email] ?? '' : '',
    faculty: columns.faculty >= 0 ? row[columns.faculty] ?? '' : 'School of Anaesthesia Ridge',
    department: columns.department >= 0 ? row[columns.department] ?? '' : '', yearGroup: columns.year >= 0 ? row[columns.year] ?? '' : '',
  }))
}

function isTokenExpired(voter: Voter) {
  return Boolean(voter.tokenExpiresAt && new Date(voter.tokenExpiresAt).getTime() <= Date.now())
}

function hasExportableToken(voter: Voter) {
  return Boolean(
    voter.registeredAt && voter.tokenId && !voter.tokenConsumedAt && !voter.tokenInvalidatedAt &&
    !voter.votedAt && !isTokenExpired(voter),
  )
}

function smsLabel(voter: Voter) {
  if (!voter.registeredAt) return 'Not registered'
  if (!voter.tokenCreatedAt) return 'No token'
  if (voter.tokenConsumedAt) return 'Token used'
  if (voter.tokenInvalidatedAt) return 'Token replaced'
  if (isTokenExpired(voter)) return 'Token expired'
  if (voter.smsStatus === 'delivered') return 'SMS delivered'
  if (voter.smsStatus === 'sent') return 'SMS sent'
  if (voter.smsStatus === 'failed') return 'SMS failed'
  return 'Pending SMS / export'
}
function smsStyle(voter: Voter) {
  if (voter.smsStatus === 'failed') return 'border-red-200 bg-red-50 text-red-700'
  if (voter.smsStatus === 'delivered' || voter.smsStatus === 'sent') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (voter.tokenConsumedAt) return 'border-blue-200 bg-blue-50 text-blue-700'
  return 'border-amber-200 bg-amber-50 text-amber-700'
}

export default function AdminVoters() {
  const [voters, setVoters] = useState<Voter[]>([]); const [summary, setSummary] = useState<Summary>(emptySummary)
  const [smsConfigured, setSmsConfigured] = useState(false); const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState(''); const [importOpen, setImportOpen] = useState(false)
  const [yearFilter, setYearFilter] = useState('all'); const [departmentFilter, setDepartmentFilter] = useState('all')
  const [registrationFilter, setRegistrationFilter] = useState('all'); const [tokenFilter, setTokenFilter] = useState('all')
  const [voteFilter, setVoteFilter] = useState('all'); const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [importStudents, setImportStudents] = useState<ImportStudent[]>([]); const [fileName, setFileName] = useState('')
  const [importErrors, setImportErrors] = useState<string[]>([]); const [importing, setImporting] = useState(false)
  const [busyId, setBusyId] = useState(''); const [notice, setNotice] = useState('')
  const [correctionId, setCorrectionId] = useState(''); const [correctionPhone, setCorrectionPhone] = useState('')

  const loadVoters = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/voters', { headers: { Accept: 'application/json' } })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Unable to load the voter register')
      setVoters(data.voters); setSummary(data.summary); setSmsConfigured(data.smsConfigured); setImportErrors([])
      setSelectedIds((current) => new Set([...current].filter((id) => data.voters.some((voter: Voter) => voter.id === id))))
    } catch (cause) { setImportErrors([cause instanceof Error ? cause.message : 'Unable to load the voter register']) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void loadVoters() }, [loadVoters])

  const yearGroups = useMemo(() => [...new Set(voters.map((voter) => voter.yearGroup).filter(Boolean) as string[])].sort(), [voters])
  const departments = useMemo(() => [...new Set(voters.map((voter) => voter.department).filter(Boolean) as string[])].sort(), [voters])

  const filtered = voters.filter((voter) => {
    const search = query.trim().toLowerCase()
    if (search && !voter.name.toLowerCase().includes(search) && !voter.institutionalId.toLowerCase().includes(search) && !(voter.phone ?? '').includes(search)) return false
    if (yearFilter !== 'all' && voter.yearGroup !== yearFilter) return false
    if (departmentFilter !== 'all' && voter.department !== departmentFilter) return false
    if (registrationFilter === 'registered' && !voter.registeredAt) return false
    if (registrationFilter === 'not_registered' && voter.registeredAt) return false
    if (voteFilter === 'voted' && !voter.votedAt) return false
    if (voteFilter === 'not_voted' && voter.votedAt) return false
    if (tokenFilter === 'available' && !hasExportableToken(voter)) return false
    if (tokenFilter === 'no_token' && voter.tokenCreatedAt) return false
    if (tokenFilter === 'used' && !voter.tokenConsumedAt) return false
    if (tokenFilter === 'pending' && (!voter.tokenCreatedAt || voter.smsStatus || voter.tokenConsumedAt || voter.tokenInvalidatedAt)) return false
    if (tokenFilter === 'sent' && !['sent', 'delivered'].includes(voter.smsStatus ?? '')) return false
    if (tokenFilter === 'failed' && voter.smsStatus !== 'failed') return false
    return true
  })

  const filteredExportableIds = filtered.filter(hasExportableToken).map((voter) => voter.id)
  const allFilteredSelected = filteredExportableIds.length > 0 && filteredExportableIds.every((id) => selectedIds.has(id))
  const filtersActive = Boolean(query || yearFilter !== 'all' || departmentFilter !== 'all' || registrationFilter !== 'all' || tokenFilter !== 'all' || voteFilter !== 'all')

  function clearFilters() {
    setQuery(''); setYearFilter('all'); setDepartmentFilter('all'); setRegistrationFilter('all'); setTokenFilter('all'); setVoteFilter('all')
  }

  function toggleVoter(id: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (checked) next.add(id); else next.delete(id)
      return next
    })
  }

  function toggleFiltered(checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current)
      for (const id of filteredExportableIds) {
        if (checked) next.add(id); else next.delete(id)
      }
      return next
    })
  }

  async function chooseFile(file?: File) {
    setImportErrors([]); setImportStudents([]); setFileName(file?.name ?? '')
    if (!file) return
    if (file.size > 2_000_000) return setImportErrors(['The CSV must be no larger than 2 MB'])
    try { setImportStudents(parseStudentCsv(await file.text())) }
    catch (cause) { setImportErrors([cause instanceof Error ? cause.message : 'Unable to read this CSV']) }
  }

  async function importRegister() {
    if (!importStudents.length) return
    setImporting(true); setImportErrors([])
    try {
      const response = await fetch('/api/voters', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ electionId: 'el-src-2026', students: importStudents }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error([data.error, ...(data.details ?? [])].filter(Boolean).join('\n'))
      setNotice(`${data.imported} eligible student(s) imported. Students can now self-register with their Student IDs.`)
      setImportOpen(false); setImportStudents([]); setFileName(''); await loadVoters()
    } catch (cause) { setImportErrors(String(cause instanceof Error ? cause.message : cause).split('\n')) }
    finally { setImporting(false) }
  }

  async function tokenAction(body: Record<string, unknown>, busyKey: string) {
    setBusyId(busyKey); setNotice('')
    try {
      const response = await fetch('/api/voters/tokens', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, electionId: 'el-src-2026' }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Token-management request failed')
      if (body.action === 'correct-phone') setNotice(`Telephone corrected for ${body.institutionalId}. Telephone verification has been reset.`)
      else if (body.action === 'reissue') setNotice(data.status === 'sent' ? `Replacement token sent to ${body.institutionalId}; older tokens are invalid.` : `Replacement token generated for ${body.institutionalId}. It is ready for SMS dispatch/export.`)
      else setNotice(`${data.sent} SMS message(s) accepted by the gateway; ${data.failed} failed. Delivery awaits provider confirmation.`)
      setCorrectionId(''); setCorrectionPhone(''); await loadVoters()
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : 'Token-management request failed') }
    finally { setBusyId('') }
  }

  async function exportDispatch() {
    setBusyId('export'); setNotice('')
    try {
      const response = await fetch('/api/voters?export=sms')
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || 'Unable to export the dispatch list') }
      const url = URL.createObjectURL(await response.blob()); const link = document.createElement('a')
      link.href = url; link.download = 'src-sms-dispatch.csv'; link.click(); URL.revokeObjectURL(url)
      setNotice('Secure SMS dispatch list downloaded. It contains raw voting tokens: upload only to an approved provider, then delete the local file securely.')
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : 'Unable to export the dispatch list') }
    finally { setBusyId('') }
  }

  async function exportSelectedTokens() {
    if (!selectedIds.size) return
    setBusyId('export-selected'); setNotice('')
    try {
      const response = await fetch('/api/voters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ action: 'export-selected-tokens', electionId: 'el-src-2026', voterIds: [...selectedIds] }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Unable to export selected voting tokens')
      const url = URL.createObjectURL(new Blob([data.csv], { type: 'text/csv;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = url; link.download = 'src-selected-voting-tokens.csv'; link.click(); URL.revokeObjectURL(url)
      setNotice(`${data.exported} selected voting token(s) downloaded.${data.skipped ? ` ${data.skipped} selected student(s) were skipped because no valid, unused token was available.` : ''} Keep the CSV secure and delete it after approved use.`)
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : 'Unable to export selected voting tokens') }
    finally { setBusyId('') }
  }

  function downloadTemplate() {
    const csv = 'student_id,full_name,email,programme,year_group\nSAR-0001,Example Student,,Anaesthesia,Level 300\n'
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); const link = document.createElement('a')
    link.href = url; link.download = 'src-student-eligibility-template.csv'; link.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Registration & Voting Token Management</h1><p className="mt-1 text-muted-foreground">Import eligible students, track self-registration, and distribute secure tokens by SMS or encrypted-token export.</p></div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void exportDispatch()} disabled={busyId !== '' || !summary.tokensGenerated}>{busyId === 'export' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Export SMS dispatch</Button>
          <Button variant="outline" onClick={() => void tokenAction({ action: 'send-sms' }, 'bulk')} disabled={busyId !== '' || !smsConfigured || !summary.tokensGenerated}><Send className="mr-2 h-4 w-4" />Send pending SMS</Button>
          <Dialog open={importOpen} onOpenChange={setImportOpen}><DialogTrigger asChild><Button><Upload className="mr-2 h-4 w-4" />Import students</Button></DialogTrigger>
            <DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Import eligible student database</DialogTitle><DialogDescription>Imported students become eligible to self-register. No token is generated until the student confirms their details and telephone number.</DialogDescription></DialogHeader>
              <div className="space-y-4"><div className="rounded-lg border-2 border-dashed p-6 text-center"><FileSpreadsheet className="mx-auto mb-3 h-10 w-10 text-muted-foreground" /><p className="text-sm font-medium">Choose the official student CSV</p><p className="mt-1 text-xs text-muted-foreground">Required: student_id, full_name. Optional: email, programme, year_group, faculty.</p><Input className="mx-auto mt-4 max-w-xs cursor-pointer" type="file" accept=".csv,text/csv" onChange={(event) => void chooseFile(event.target.files?.[0])} /><Button variant="link" size="sm" onClick={downloadTemplate}><Download className="mr-1 h-3.5 w-3.5" />Download CSV template</Button></div>
                {fileName && <p className="text-sm"><strong>{fileName}</strong>{importStudents.length ? ` — ${importStudents.length} student(s) ready` : ''}</p>}
                {importErrors.length > 0 && <Alert variant="destructive"><AlertTitle>Import needs attention</AlertTitle><AlertDescription><ul className="list-inside list-disc">{importErrors.slice(0, 12).map((error) => <li key={error}>{error}</li>)}</ul></AlertDescription></Alert>}
                <Button className="w-full" disabled={!importStudents.length || importing} onClick={() => void importRegister()}>{importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{importing ? 'Importing…' : `Import ${importStudents.length || ''} eligible student(s)`}</Button>
              </div></DialogContent></Dialog>
        </div>
      </div>

      <Alert className={smsConfigured ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}><MessageSquareText className="h-4 w-4" /><AlertTitle>{smsConfigured ? 'SMS gateway configured' : 'SMS gateway not configured'}</AlertTitle><AlertDescription>{smsConfigured ? '“Sent” means accepted by the gateway; “Delivered” requires a provider delivery report.' : 'Students can still register. Use “Export SMS dispatch” for an approved bulk-SMS provider. The system will not claim pending messages were sent.'}</AlertDescription></Alert>
      {notice && <Alert className="border-blue-200 bg-blue-50"><ShieldCheck className="h-4 w-4 text-blue-600" /><AlertDescription className="text-blue-900">{notice}</AlertDescription></Alert>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {[['Eligible', summary.total, Users], ['Registered', summary.registered, Phone], ['Tokens', summary.tokensGenerated, KeyRound], ['SMS sent', summary.sent, Send], ['Voted', summary.voted, CheckCircle2], ['Turnout', `${summary.turnout}%`, Users]].map(([label, value, Icon]) => { const StatIcon = Icon as typeof Users; return <Card key={String(label)}><CardContent className="py-4"><div className="flex items-center gap-2"><StatIcon className="h-5 w-5 text-primary" /><p className="text-xl font-bold">{String(value)}</p></div><p className="mt-1 text-xs text-muted-foreground">{String(label)}</p></CardContent></Card> })}
      </div>
      <p className="text-xs text-muted-foreground">SMS pending: {summary.pending} · Failed: {summary.failed} · Confirmed delivered: {summary.delivered}</p>

      <Card className="border-emerald-100 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-lg"><Filter className="h-5 w-5 text-emerald-700" /> Filter voters and select OTPs</CardTitle>
            {filtersActive && <Button variant="ghost" size="sm" onClick={clearFilters}><X className="mr-1 h-4 w-4" />Clear filters</Button>}
          </div>
          <p className="text-xs text-muted-foreground">Showing {filtered.length} of {voters.length} eligible students. Only valid, unused tokens for students who have not voted can be exported.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="w-full pl-9" placeholder="Search name, Student ID or telephone…" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-2"><Label htmlFor="year-filter">Year group</Label><select id="year-filter" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}><option value="all">All year groups</option>{yearGroups.map((year) => <option key={year} value={year}>{year}</option>)}</select></div>
            <div className="space-y-2"><Label htmlFor="department-filter">Programme</Label><select id="department-filter" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}><option value="all">All programmes</option>{departments.map((department) => <option key={department} value={department}>{department}</option>)}</select></div>
            <div className="space-y-2"><Label htmlFor="registration-filter">Registration</Label><select id="registration-filter" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={registrationFilter} onChange={(event) => setRegistrationFilter(event.target.value)}><option value="all">All registrations</option><option value="registered">Registered</option><option value="not_registered">Not registered</option></select></div>
            <div className="space-y-2"><Label htmlFor="token-filter">Token / SMS</Label><select id="token-filter" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={tokenFilter} onChange={(event) => setTokenFilter(event.target.value)}><option value="all">All token states</option><option value="available">Valid & exportable</option><option value="pending">Pending SMS / export</option><option value="sent">SMS sent / delivered</option><option value="failed">SMS failed</option><option value="used">Token used</option><option value="no_token">No token</option></select></div>
            <div className="space-y-2"><Label htmlFor="vote-filter">Voting status</Label><select id="vote-filter" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={voteFilter} onChange={(event) => setVoteFilter(event.target.value)}><option value="all">All voting states</option><option value="not_voted">Not voted</option><option value="voted">Voted</option></select></div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50/70 p-3">
            <p className="text-sm text-emerald-950"><strong>{selectedIds.size}</strong> student{selectedIds.size === 1 ? '' : 's'} selected <span className="text-xs text-emerald-800">· {filteredExportableIds.length} exportable in this view</span></p>
            <div className="flex flex-wrap gap-2">
              {selectedIds.size > 0 && <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>Clear selection</Button>}
              <Button size="sm" className="bg-emerald-700 hover:bg-emerald-800" disabled={!selectedIds.size || busyId !== ''} onClick={() => void exportSelectedTokens()}>
                {busyId === 'export-selected' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Export selected OTPs
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card><CardHeader><CardTitle className="text-lg">Student registration and SMS status</CardTitle><p className="mt-1 text-xs text-muted-foreground">Raw voting tokens never appear in this table. Participation never reveals ballot choices.</p></CardHeader>
        <CardContent className="overflow-x-auto p-0"><Table><TableHeader><TableRow><TableHead className="w-12"><Checkbox aria-label="Select all exportable students in this filtered view" checked={allFilteredSelected} disabled={!filteredExportableIds.length} onCheckedChange={(checked) => toggleFiltered(checked === true)} /></TableHead><TableHead>Student</TableHead><TableHead>Programme</TableHead><TableHead>Registration / phone</TableHead><TableHead>Token / SMS</TableHead><TableHead>Vote</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>{loading ? <TableRow><TableCell colSpan={7} className="py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></TableCell></TableRow> : filtered.length === 0 ? <TableRow><TableCell colSpan={7} className="py-12 text-center text-muted-foreground">{voters.length ? 'No students match these filters.' : 'No eligible students imported yet.'}</TableCell></TableRow> : filtered.map((voter) => <TableRow key={voter.id} className={selectedIds.has(voter.id) ? 'bg-emerald-50/50' : ''}>
            <TableCell><Checkbox aria-label={`Select ${voter.name} for OTP export`} checked={selectedIds.has(voter.id)} disabled={!hasExportableToken(voter)} onCheckedChange={(checked) => toggleVoter(voter.id, checked === true)} /></TableCell>
            <TableCell><p className="font-medium">{voter.name}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{voter.institutionalId}</p></TableCell>
            <TableCell><p className="text-xs">{voter.department || '—'}</p><p className="mt-1 text-xs text-muted-foreground">{voter.yearGroup || '—'}</p></TableCell>
            <TableCell>{voter.registeredAt ? <><p className="text-xs font-medium">{voter.phone}</p><p className="mt-1 text-xs text-muted-foreground">{voter.phoneVerified ? 'Phone verified' : 'Registered'} · {new Date(voter.registeredAt).toLocaleDateString('en-GB')}</p></> : <Badge variant="outline">Not registered</Badge>}</TableCell>
            <TableCell><Badge variant="outline" className={smsStyle(voter)}>{smsLabel(voter)}</Badge>{voter.smsDetail && <p className="mt-1 max-w-48 text-xs text-red-600">{voter.smsDetail}</p>}</TableCell>
            <TableCell>{voter.votedAt ? <Badge className="bg-emerald-600">Voted</Badge> : <Badge variant="outline">Not voted</Badge>}</TableCell>
            <TableCell><div className="flex justify-end gap-1">{voter.registeredAt && <><Button variant="ghost" size="sm" title="Correct telephone number" disabled={busyId !== '' || Boolean(voter.votedAt)} onClick={() => { setCorrectionId(voter.institutionalId); setCorrectionPhone(voter.phone ?? '') }}><Pencil className="h-3.5 w-3.5" /></Button><Button variant="outline" size="sm" disabled={busyId !== '' || Boolean(voter.votedAt)} onClick={() => void tokenAction({ action: 'reissue', institutionalId: voter.institutionalId }, voter.institutionalId)}>{busyId === voter.institutionalId ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}Reissue</Button></>}</div></TableCell>
          </TableRow>)}</TableBody></Table></CardContent></Card>

      <Dialog open={Boolean(correctionId)} onOpenChange={(open) => { if (!open) setCorrectionId('') }}><DialogContent><DialogHeader><DialogTitle>Correct registered telephone</DialogTitle><DialogDescription>Update the telephone for {correctionId}. Verification will be reset; the voting token remains protected.</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label htmlFor="correction-phone">Telephone number</Label><Input id="correction-phone" value={correctionPhone} onChange={(event) => setCorrectionPhone(event.target.value)} /></div><Button className="w-full" disabled={!correctionPhone || busyId !== ''} onClick={() => void tokenAction({ action: 'correct-phone', institutionalId: correctionId, phone: correctionPhone }, correctionId)}>{busyId === correctionId && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save corrected telephone</Button></div></DialogContent></Dialog>
    </div>
  )
}
