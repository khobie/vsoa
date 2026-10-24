import { useState } from 'react'
import { Link } from 'react-router'
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Phone, ShieldCheck, UserCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { InstitutionMark } from '@/components/InstitutionMark'

type Step = 'id' | 'confirm' | 'phone' | 'otp' | 'done'
interface StudentDetails { name: string; institutionalId: string; programme: string; yearGroup: string }

export default function StudentRegistration() {
  const [step, setStep] = useState<Step>('id')
  const [institutionalId, setInstitutionalId] = useState('')
  const [student, setStudent] = useState<StudentDetails | null>(null)
  const [phone, setPhone] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [otpRequired, setOtpRequired] = useState(false)
  const [maskedPhone, setMaskedPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function post(body: Record<string, unknown>) {
    const response = await fetch('/api/registration', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ ...body, institutionalId, electionId: 'el-src-2026' }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || 'Unable to complete registration')
    return data
  }

  async function lookup(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true); setError('')
    try {
      const data = await post({ action: 'lookup' })
      setStudent(data.student)
      setOtpRequired(data.otpRequired)
      setStep('confirm')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to check the Student ID') }
    finally { setBusy(false) }
  }

  async function register(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true); setError('')
    try {
      const data = await post({ action: 'register', phone, confirmed })
      if (data.verificationRequired) {
        setMaskedPhone(data.phone)
        setStep('otp')
      } else setStep('done')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to register') }
    finally { setBusy(false) }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true); setError('')
    try {
      await post({ action: 'verify-otp', otp })
      setStep('done')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to verify the code') }
    finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-950 to-green-900 px-4 py-10">
      <div className="mx-auto max-w-lg">
        <div className="mb-8 flex flex-col items-center text-center"><InstitutionMark dark /><p className="mt-3 text-sm text-green-200">Student registration for the SRC election</p></div>
        <Card>
          <CardHeader>
            <CardTitle>{step === 'done' ? 'Registration complete' : 'Student Registration'}</CardTitle>
            <CardDescription>{step === 'id' ? 'Start with your official Student ID.' : step === 'confirm' ? 'Confirm that these registered details belong to you.' : step === 'phone' ? 'Provide the telephone number that should receive your voting token.' : step === 'otp' ? 'Enter the verification code sent to your telephone.' : 'Your secure voting token is ready for SMS distribution.'}</CardDescription>
          </CardHeader>
          <CardContent>
            {error && <Alert variant="destructive" className="mb-5"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}

            {step === 'id' && <form onSubmit={lookup} className="space-y-4">
              <div className="space-y-2"><Label htmlFor="student-id">Student ID</Label><Input id="student-id" value={institutionalId} onChange={(event) => setInstitutionalId(event.target.value)} placeholder="Enter your official Student ID" required /></div>
              <Button className="w-full" disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Check eligibility</Button>
              <p className="text-xs text-muted-foreground">Only students on the administrator-uploaded eligibility register can register. Invalid attempts are rate-limited.</p>
            </form>}

            {step === 'confirm' && student && <div className="space-y-5">
              <dl className="divide-y rounded-lg border px-4">
                {[['Full name', student.name], ['Student ID', student.institutionalId], ['Programme', student.programme], ['Year group', student.yearGroup]].map(([label, value]) => <div key={label} className="flex justify-between gap-4 py-3 text-sm"><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-medium">{value}</dd></div>)}
              </dl>
              <div className="flex items-start gap-3"><Checkbox id="confirm-details" checked={confirmed} onCheckedChange={(value) => setConfirmed(value === true)} /><Label htmlFor="confirm-details" className="leading-relaxed">I confirm that these are my official student details.</Label></div>
              <div className="flex gap-3"><Button variant="outline" onClick={() => { setStep('id'); setConfirmed(false) }}>Not me</Button><Button className="flex-1" disabled={!confirmed} onClick={() => { setStep('phone'); setError('') }}>Continue <UserCheck className="ml-2 h-4 w-4" /></Button></div>
            </div>}

            {step === 'phone' && <form onSubmit={register} className="space-y-4">
              <div className="space-y-2"><Label htmlFor="phone">Active telephone number</Label><Input id="phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="e.g. 0241234567" autoComplete="tel" required /></div>
              <Alert><Phone className="h-4 w-4" /><AlertDescription>{otpRequired ? 'We will send a 6-digit verification code to this number.' : 'SMS OTP is not configured, so registration will complete immediately. The Electoral Commission will distribute your token separately.'}</AlertDescription></Alert>
              <Button className="w-full" disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Complete registration</Button>
              <p className="text-xs text-muted-foreground">If you enter a wrong number, contact the Electoral Commission for the controlled correction process.</p>
            </form>}

            {step === 'otp' && <form onSubmit={verify} className="space-y-4">
              <div className="space-y-2"><Label htmlFor="otp">6-digit verification code</Label><Input id="otp" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))} placeholder="000000" className="text-center font-mono text-2xl tracking-[0.4em]" required /></div>
              <p className="text-sm text-muted-foreground">Code sent to {maskedPhone || 'your telephone'}. It expires in 10 minutes.</p>
              <Button className="w-full" disabled={busy || otp.length !== 6}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Verify and generate token</Button>
            </form>}

            {step === 'done' && <div className="space-y-5 text-center">
              <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-500" />
              <p className="text-sm leading-relaxed text-muted-foreground">Your registration was successful and a unique secure voting token has been generated. The Electoral Commission will send it to your registered telephone by SMS. <strong className="text-foreground">Registering does not count as voting.</strong></p>
              <Alert className="border-emerald-200 bg-emerald-50 text-left"><ShieldCheck className="h-4 w-4 text-emerald-600" /><AlertDescription className="text-emerald-800">Your token is not displayed publicly or included in administrator reports.</AlertDescription></Alert>
              <Link to="/login" className="block"><Button className="w-full">Continue to voting login</Button></Link>
            </div>}
          </CardContent>
        </Card>
        <div className="mt-5 text-center"><Link to="/" className="inline-flex items-center gap-1 text-sm text-green-300 hover:text-white"><ArrowLeft className="h-4 w-4" /> Back to home</Link></div>
      </div>
    </div>
  )
}
