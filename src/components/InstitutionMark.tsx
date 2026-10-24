import { institution } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

export function InstitutionMark({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <img
        src="/school-logo.png"
        alt="School of Anaesthesia and Critical Care logo"
        className="h-11 w-11 shrink-0 rounded-full bg-white object-contain ring-1 ring-black/10"
      />
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
