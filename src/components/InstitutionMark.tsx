import { GraduationCap } from 'lucide-react'
import { institution } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

export function InstitutionMark({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-lg',
          dark ? 'bg-amber-400 text-blue-950' : 'bg-primary text-primary-foreground'
        )}
      >
        <GraduationCap className="h-5 w-5" />
      </div>
      <div className="leading-tight">
        <p className={cn('text-sm font-semibold', dark ? 'text-white' : 'text-foreground')}>
          {institution.shortName} E-Voting
        </p>
        <p className={cn('text-xs', dark ? 'text-blue-200' : 'text-muted-foreground')}>
          {institution.name}
        </p>
      </div>
    </div>
  )
}
