import { useState } from 'react'
import { Settings, Save, Palette, Mail, ShieldCheck, Database } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { institution } from '@/lib/mock-data'

export default function AdminSettings() {
  const [name, setName] = useState(institution.name)
  const [shortName, setShortName] = useState(institution.shortName)
  const [email, setEmail] = useState(institution.email)
  const [phone, setPhone] = useState(institution.phone)
  const [saved, setSaved] = useState(false)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Settings className="h-6 w-6 text-primary" /> Institution settings
        </h1>
        <p className="mt-1 text-muted-foreground">
          System-wide configuration. Changes are audit-logged.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Palette className="h-5 w-5" /> Branding
          </CardTitle>
          <CardDescription>Shown on the landing page, ballots, and official reports.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="inst-name">Institution name</Label>
            <Input id="inst-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="inst-short">Short name / code</Label>
              <Input id="inst-short" value={shortName} onChange={(e) => setShortName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="logo">Logo</Label>
              <Input id="logo" type="file" accept="image/png,image/jpeg,image/svg+xml" />
              <p className="text-xs text-muted-foreground">PNG, JPG or SVG, max 2 MB. Files are scanned before storage.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mail className="h-5 w-5" /> Contact & notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Elections office email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <Separator />
          <div className="space-y-3">
            {[
              { id: 'n1', label: 'Email voters when an election opens', on: true },
              { id: 'n2', label: 'Reminder 1 hour before voting closes', on: true },
              { id: 'n3', label: 'Ballot acceptance confirmation email', on: true },
              { id: 'n4', label: 'SMS notifications (approved provider)', on: false },
            ].map((n) => (
              <div key={n.id} className="flex items-center justify-between">
                <Label htmlFor={n.id} className="font-normal">{n.label}</Label>
                <Switch id={n.id} defaultChecked={n.on} />
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Notifications never contain candidate selections or other ballot content.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="h-5 w-5" /> Security policy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { id: 's1', label: 'Require OTP second factor for all voters', on: true },
            { id: 's2', label: 'Require MFA for administrators and commissioners', on: true },
            { id: 's3', label: 'Lock account after 5 failed sign-in attempts (15 min)', on: true },
            { id: 's4', label: 'Session expires after 30 minutes of inactivity', on: true },
          ].map((s) => (
            <div key={s.id} className="flex items-center justify-between">
              <Label htmlFor={s.id} className="font-normal">{s.label}</Label>
              <Switch id={s.id} defaultChecked={s.on} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Database className="h-5 w-5" /> Data retention
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { id: 'd1', label: 'Delete voter personal data 12 months after graduation', on: true },
            { id: 'd2', label: 'Retain audit records for 7 years', on: true },
            { id: 'd3', label: 'Retain anonymous ballots until appeal window closes', on: true },
          ].map((d) => (
            <div key={d.id} className="flex items-center justify-between">
              <Label htmlFor={d.id} className="font-normal">{d.label}</Label>
              <Switch id={d.id} defaultChecked={d.on} />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-sm text-emerald-600">Settings saved (demo).</span>}
        <Button
          onClick={() => {
            setSaved(true)
            setTimeout(() => setSaved(false), 2500)
          }}
        >
          <Save className="mr-1.5 h-4 w-4" /> Save settings
        </Button>
      </div>
    </div>
  )
}
