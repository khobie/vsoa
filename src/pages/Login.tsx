import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { ShieldCheck, ArrowLeft, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { InstitutionMark } from '@/components/InstitutionMark'
import { useAuth } from '@/components/auth-provider'
import { institution } from '@/lib/mock-data'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn } = useAuth()
  const [institutionalId, setInstitutionalId] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const sessionUser = await signIn(institutionalId, password)
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-950 to-blue-900 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <InstitutionMark dark />
          <p className="mt-3 text-sm text-blue-200">{institution.motto}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign in to your account</CardTitle>
            <CardDescription>Use your institutional ID and password.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="institutional-id">Student / Staff ID</Label>
                <Input
                  id="institutional-id"
                  placeholder="e.g. 10987654"
                  value={institutionalId}
                  onChange={(event) => setInstitutionalId(event.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  minLength={8}
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
                {busy ? 'Signing in…' : 'Sign in'}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Access is limited to activated university accounts.
              </p>
            </form>
          </CardContent>
        </Card>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-blue-200">
          <ShieldCheck className="h-4 w-4" />
          Secure password verification and revocable sign-in sessions.
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
