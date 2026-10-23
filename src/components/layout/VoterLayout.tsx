import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { LayoutGrid, BarChart3, LogOut, ShieldCheck, Menu } from 'lucide-react'
import { useState } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { InstitutionMark } from '@/components/InstitutionMark'
import { useAuth } from '@/components/auth-provider'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/dashboard', label: 'My Elections', icon: LayoutGrid },
  { to: '/results', label: 'Published Results', icon: BarChart3 },
]

function VoterNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            )
          }
        >
          <item.icon className="h-4 w-4" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

export default function VoterLayout() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 flex-col bg-sidebar-background md:flex">
        <div className="p-5">
          <Link to="/">
            <InstitutionMark dark />
          </Link>
        </div>
        <div className="flex-1 px-3">
          <VoterNav />
        </div>
        <div className="border-t border-sidebar-border p-4">
          <div className="mb-3 flex items-center gap-3 px-1">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs font-semibold">
                {user ? user.name.split(' ').map((part) => part[0]).join('').slice(0, 2) : 'GU'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-medium text-white">{user?.name ?? 'Guest'}</p>
              <p className="truncate text-xs text-blue-200">{user ? `ID: ${user.institutionalId}` : 'Sign in to vote'}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-blue-200 hover:bg-sidebar-accent hover:text-white"
            onClick={() => user ? void signOut().then(() => navigate('/login')) : navigate('/login')}
          >
            <LogOut className="h-4 w-4" /> {user ? 'Sign out' : 'Sign in'}
          </Button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-white px-4 md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 bg-sidebar-background p-4">
              <div className="mb-6">
                <InstitutionMark dark />
              </div>
              <VoterNav onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <InstitutionMark />
        </header>

        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>

        <footer className="border-t bg-white px-4 py-3 text-center text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            Your ballot is secret. The system records that you voted — never what you voted.
          </span>
        </footer>
      </div>
    </div>
  )
}
