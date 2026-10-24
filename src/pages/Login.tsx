import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { ShieldCheck, ArrowLeft, AlertCircle, Loader2, KeyRound, UserCog } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { InstitutionMark } from '@/components/InstitutionMark'
import { useAuth } from '@/components/auth-provider'
import { institution } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

type LoginMode = 'student' | 'admin'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn, signInVoter } = useAuth()
  const [mode, setMode] = useState<LoginMode>('student')
  const [institutionalId, setInstitutionalId] = useState('')
  const [credential, setCredential] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function changeMode(nextMode: LoginMode) {
    setMode(nextMode)
    setCredential('')
    setError('')
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const sessionUser = mode === 'student'
        ? await signInVoter(institutionalId, credential)
        : await signIn(institutionalId, credential)
      const isStaff = sessionUser.roles.some((role) => ['super_admin', 'commissioner', 'officer'].includes(role))
      const requested = (location.state as { from?: string } | null)?.from
      const allowedRequested = requested && (isStaff ? requested.startsWith('/admin') : !requested.startsWith('/admin'))
      navigate(allowedRequested ? requested : isStaff ? '/admin' : '/dashboard', { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign in')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-green-950 to-green-900 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <InstitutionMark dark />
          <p className="mt-3 text-sm text-green-200">{institution.motto}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{mode === 'student' ? 'Student voting access' : 'Administrator sign in'}</CardTitle>
            <CardDescription>
              {mode === 'student'
                ? 'Use your Student ID and the unique voting token sent to your email.'
                : 'Electoral staff use their staff ID and password.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-5 grid grid-cols-2 rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Sign-in type">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'student'}
                onClick={() => changeMode('student')}
                className={cn('flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium', mode === 'student' ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground')}
              >
                <KeyRound className="h-4 w-4" /> Student
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'admin'}
                onClick={() => changeMode('admin')}
                className={cn('flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium', mode === 'admin' ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground')}
              >
                <UserCog className="h-4 w-4" /> Administrator
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="institutional-id">{mode === 'student' ? 'Student ID' : 'Staff ID'}</Label>
                <Input
                  id="institutional-id"
                  placeholder={mode === 'student' ? 'Enter your Student ID' : 'Enter your staff ID'}
                  value={institutionalId}
                  onChange={(event) => setInstitutionalId(event.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="credential">{mode === 'student' ? 'Unique voting token' : 'Password'}</Label>
                <Input
                  id="credential"
                  type="password"
                  placeholder={mode === 'student' ? 'Paste the token from your email' : 'Enter your password'}
                  value={credential}
                  onChange={(event) => setCredential(event.target.value)}
                  autoComplete={mode === 'student' ? 'one-time-code' : 'current-password'}
                  minLength={mode === 'student' ? 20 : 8}
                  required
                />
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Sign-in failed</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {busy ? 'Verifying…' : mode === 'student' ? 'Access my ballot' : 'Sign in as administrator'}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                {mode === 'student'
                  ? 'Tokens expire, work once for sign-in, and are replaced when reissued.'
                  : 'Student voting tokens cannot be used on the administrator sign-in.'}
              </p>
            </form>
          </CardContent>
        </Card>

        <div className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-green-200">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          Your identity verifies eligibility; your ballot choices are stored separately.
        </div>
        <p className="mt-5 text-center text-sm text-green-200">
          Haven’t registered? <Link to="/students/register" className="font-semibold text-amber-300 hover:underline">Register with your Student ID</Link>
        </p>
        <div className="mt-4 text-center">
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-green-300 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}
