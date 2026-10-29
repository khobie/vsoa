import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import {
  LayoutDashboard,
  Vote,
  Users,
  UserCheck,
  ScrollText,
  ClipboardCheck,
  Settings,
  LogOut,
  Menu,
} from 'lucide-react'
import { useState } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { InstitutionMark } from '@/components/InstitutionMark'
import { useAuth } from '@/components/auth-provider'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/elections', label: 'Elections', icon: Vote, adminOnly: true },
  { to: '/admin/candidates', label: 'Aspirants & Candidates', icon: UserCheck },
  { to: '/admin/voters', label: 'Voter Register', icon: Users, adminOnly: true },
  { to: '/admin/results', label: 'Results & Publication', icon: ClipboardCheck },
  { to: '/admin/audit', label: 'Audit Trail', icon: ScrollText, adminOnly: true },
  { to: '/admin/settings', label: 'Institution Settings', icon: Settings, adminOnly: true },
]

function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth()
  const isSuperAdmin = user?.roles.includes('super_admin') ?? false
  const visibleItems = navItems.filter((item) => isSuperAdmin || !item.adminOnly)

  return (
    <nav className="flex flex-col gap-1">
      {visibleItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
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

export default function AdminLayout() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  if (!user) return null

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden w-64 flex-col bg-sidebar-background md:flex">
        <div className="p-5">
          <Link to="/">
            <InstitutionMark dark />
          </Link>
          <p className="mt-2 rounded bg-sidebar-accent px-2 py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-amber-300">
            Electoral Commission
          </p>
        </div>
        <div className="flex-1 px-3">
          <AdminNav />
        </div>
        <div className="border-t border-sidebar-border p-4">
          <div className="mb-3 flex items-center gap-3 px-1">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs font-semibold">
                {user.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-medium text-white">{user.name}</p>
              <p className="truncate text-xs text-blue-200">{user.role.replace('_', ' ')}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-blue-200 hover:bg-sidebar-accent hover:text-white"
            onClick={() => void signOut().then(() => navigate('/login'))}
          >
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

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
              <AdminNav onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <InstitutionMark />
        </header>

        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
