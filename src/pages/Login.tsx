import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ShieldCheck, ArrowLeft, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { InstitutionMark } from '@/components/InstitutionMark'
import { institution } from '@/lib/mock-data'

type Step = 'credentials' | 'otp'

export default function Login() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('credentials')
  const [institutionalId, setInstitutionalId] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [busy, setBusy] = useState(false)

  function handleCredentials(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    // DEMO ONLY — real authentication (Argon2id verify + email OTP) arrives with the backend phase.
    setTimeout(() => {
      setBusy(false)
      setStep('otp')
    }, 700)
  }

  function handleOtp(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setTimeout(() => {
      navigate('/dashboard')
    }, 700)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-950 to-blue-900 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <InstitutionMark dark />
          <p className="mt-3 text-sm text-blue-200">{institution.motto}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{step === 'credentials' ? 'Sign in to vote' : 'Verify your identity'}</CardTitle>
            <CardDescription>
              {step === 'credentials'
                ? 'Use your institutional ID and password.'
                : `Enter the 6-digit code sent to your university email.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === 'credentials' ? (
              <form onSubmit={handleCredentials} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="institutional-id">Student / Staff ID</Label>
                  <Input
                    id="institutional-id"
                    placeholder="e.g. 10987654"
                    value={institutionalId}
                    onChange={(e) => setInstitutionalId(e.target.value)}
                    autoComplete="username"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <button type="button" className="text-xs text-primary hover:underline">
                      Forgot password?
                    </button>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? 'Checking…' : 'Continue'}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  First time? Your account is activated with the link sent to your university email.
                </p>
              </form>
            ) : (
              <form onSubmit={handleOtp} className="space-y-5">
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <Button type="submit" className="w-full" disabled={busy || otp.length !== 6}>
                  {busy ? 'Verifying…' : 'Verify and sign in'}
                </Button>
                <div className="flex items-center justify-between text-xs">
                  <button type="button" onClick={() => setStep('credentials')} className="text-muted-foreground hover:underline">
                    ← Back
                  </button>
                  <button type="button" className="text-primary hover:underline">
                    Resend code
                  </button>
                </div>
              </form>
            )}

            <Alert className="mt-6 border-amber-200 bg-amber-50">
              <Info className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800">Demo mode</AlertTitle>
              <AlertDescription className="text-amber-700">
                The backend is not wired up yet. Use the shortcuts below to explore the interface.
              </AlertDescription>
            </Alert>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
                Enter as Voter
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/admin')}>
                Enter as Commissioner
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-blue-200">
          <ShieldCheck className="h-4 w-4" />
          Protected by rate limiting, OTP verification and encrypted sessions.
        </div>
        <div className="mt-4 text-center">
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-blue-300 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}
