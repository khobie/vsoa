import { Badge } from '@/components/ui/badge'
import type { ElectionStatus, CandidateStatus, VerificationStatus } from '@/lib/mock-data'

const electionStyles: Record<ElectionStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  scheduled: { label: 'Scheduled', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  open: { label: 'Voting Open', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  suspended: { label: 'Suspended', className: 'bg-red-50 text-red-700 border-red-200' },
  closed: { label: 'Closed', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  published: { label: 'Results Published', className: 'bg-violet-50 text-violet-700 border-violet-200' },
}

const candidateStyles: Record<CandidateStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  submitted: { label: 'Submitted', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  under_review: { label: 'Under Review', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved: { label: 'Approved', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { label: 'Rejected', className: 'bg-red-50 text-red-700 border-red-200' },
  withdrawn: { label: 'Withdrawn', className: 'bg-slate-100 text-slate-500 border-slate-200' },
}

const verificationStyles: Record<VerificationStatus, { label: string; className: string }> = {
  not_started: { label: 'Not Started', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  awaiting_verification: { label: 'Awaiting Verification', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  verified: { label: 'Verified', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  published: { label: 'Published', className: 'bg-violet-50 text-violet-700 border-violet-200' },
}

export function ElectionStatusBadge({ status }: { status: ElectionStatus }) {
  const s = electionStyles[status]
  return (
    <Badge variant="outline" className={s.className}>
      {status === 'open' && <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />}
      {s.label}
    </Badge>
  )
}

export function CandidateStatusBadge({ status }: { status: CandidateStatus }) {
  const s = candidateStyles[status]
  return (
    <Badge variant="outline" className={s.className}>
      {s.label}
    </Badge>
  )
}

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const s = verificationStyles[status]
  return (
    <Badge variant="outline" className={s.className}>
      {s.label}
    </Badge>
  )
}
