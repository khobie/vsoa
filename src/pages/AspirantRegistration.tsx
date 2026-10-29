import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, CheckCircle2, ImagePlus, Loader2, UserPlus } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { InstitutionMark } from '@/components/InstitutionMark'
import { useElections } from '@/components/elections-provider'
import { institution } from '@/lib/mock-data'

const initialForm = {
  name: '',
  institutionalId: '',
  email: '',
  yearGroup: '',
  positionId: '',
  photo: '',
  manifesto: '',
  bio: '',
}

export default function AspirantRegistration() {
  const { elections, registration } = useElections()
  const election = elections[0]
  const [form, setForm] = useState(initialForm)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [reference, setReference] = useState('')

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setError('')
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Choose a JPG, PNG, or WebP image')
      event.target.value = ''
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Your photo must be no larger than 2 MB')
      event.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => update('photo', String(reader.result))
    reader.onerror = () => setError('Unable to read that photo. Please choose another file.')
    reader.readAsDataURL(file)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/aspirants/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Unable to submit your registration')
      setReference(data.application.id)
      setForm(initialForm)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to submit your registration')
    } finally {
      setBusy(false)
    }
  }

  if (!registration.aspirantOpen) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-950 to-blue-900 px-4 py-8">
        <div className="mx-auto max-w-lg">
          <div className="mb-6 flex flex-col items-center text-center"><InstitutionMark dark /><p className="mt-3 text-sm text-blue-200">SRC aspirant registration</p></div>
          <Card>
            <CardHeader>
              <CardTitle>Aspirant registration is closed</CardTitle>
              <CardDescription>The Electoral Commission is not accepting aspirant applications at this time.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {registration.announcement && <Alert><AlertTitle>EC announcement</AlertTitle><AlertDescription className="whitespace-pre-wrap">{registration.announcement}</AlertDescription></Alert>}
              <p className="text-sm text-muted-foreground">Please check the homepage announcement or contact the Electoral Commission for assistance.</p>
              <Link to="/" className="block"><Button variant="outline" className="w-full">Return to homepage</Button></Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-950 to-blue-900 px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <InstitutionMark dark />
          <p className="mt-3 text-sm text-blue-200">SRC aspirant registration</p>
        </div>

        {reference ? (
          <Card>
            <CardContent className="flex flex-col items-center py-12 text-center">
              <CheckCircle2 className="h-16 w-16 text-emerald-600" />
              <h1 className="mt-5 text-2xl font-bold">Registration received</h1>
              <p className="mt-3 max-w-md text-muted-foreground">Your aspirant application and photo have been sent to the SRC Electoral Commission for eligibility review.</p>
              <p className="mt-5 rounded-lg bg-secondary px-4 py-2 font-mono text-sm">Reference: {reference.slice(0, 8).toUpperCase()}</p>
              <Button asChild className="mt-7"><Link to="/">Return to home</Link></Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <UserPlus className="h-6 w-6 text-primary" />
                <div>
                  <CardTitle>Register as an aspirant</CardTitle>
                  <CardDescription>{election?.name ?? 'SRC Election'} · {institution.name}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={submit} className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="aspirant-name">Full name</Label>
                    <Input id="aspirant-name" value={form.name} onChange={(e) => update('name', e.target.value)} autoComplete="name" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="aspirant-id">Institutional ID</Label>
                    <Input id="aspirant-id" value={form.institutionalId} onChange={(e) => update('institutionalId', e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="aspirant-email">Email address</Label>
                    <Input id="aspirant-email" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} autoComplete="email" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="aspirant-year">Year group / level</Label>
                    <Input id="aspirant-year" placeholder="e.g. Level 300" value={form.yearGroup} onChange={(e) => update('yearGroup', e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Position</Label>
                  <Select value={form.positionId} onValueChange={(value) => update('positionId', value)} required>
                    <SelectTrigger className="w-full" aria-label="Position"><SelectValue placeholder="Select the position you are contesting" /></SelectTrigger>
                    <SelectContent>
                      {election?.positions.map((position) => <SelectItem key={position.id} value={position.id}>{position.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="aspirant-photo">Your photo</Label>
                  <div className="flex items-center gap-4 rounded-lg border border-dashed p-4">
                    {form.photo ? (
                      <img src={form.photo} alt="Aspirant preview" className="h-20 w-20 rounded-full border object-cover" />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary"><ImagePlus className="h-7 w-7 text-primary" /></div>
                    )}
                    <div className="flex-1">
                      <Input id="aspirant-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={selectPhoto} required={!form.photo} />
                      <p className="mt-2 text-xs text-muted-foreground">JPG, PNG, or WebP. Maximum 2 MB. Use a clear headshot.</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="aspirant-manifesto">Manifesto</Label>
                  <Textarea id="aspirant-manifesto" className="min-h-32" placeholder="Tell voters what you plan to achieve…" value={form.manifesto} onChange={(e) => update('manifesto', e.target.value)} minLength={20} maxLength={5000} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="aspirant-bio">Short biography</Label>
                  <Textarea id="aspirant-bio" className="min-h-24" placeholder="Your programme, experience, and relevant leadership background…" value={form.bio} onChange={(e) => update('bio', e.target.value)} minLength={10} maxLength={2000} required />
                </div>
                {error && <Alert variant="destructive"><AlertTitle>Registration not submitted</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
                <Button type="submit" className="w-full" disabled={busy || !election || !form.photo}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? 'Submitting…' : 'Submit aspirant registration'}
                </Button>
                <p className="text-center text-xs text-muted-foreground">Submission does not guarantee approval. The Electoral Commission will verify your eligibility.</p>
              </form>
            </CardContent>
          </Card>
        )}
        <div className="mt-5 text-center"><Link to="/" className="inline-flex items-center gap-1 text-sm text-blue-300 hover:text-white"><ArrowLeft className="h-4 w-4" /> Back to home</Link></div>
      </div>
    </div>
  )
}
