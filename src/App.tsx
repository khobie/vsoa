import { Routes, Route, Navigate } from 'react-router'
import Landing from './pages/Landing'
import Login from './pages/Login'
import VoterLayout from './components/layout/VoterLayout'
import AdminLayout from './components/layout/AdminLayout'
import VoterDashboard from './pages/voter/VoterDashboard'
import BallotPage from './pages/voter/BallotPage'
import ResultsIndex from './pages/voter/ResultsIndex'
import ResultsPage from './pages/voter/ResultsPage'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminElections from './pages/admin/AdminElections'
import AdminElectionNew from './pages/admin/AdminElectionNew'
import AdminElectionDetail from './pages/admin/AdminElectionDetail'
import AdminCandidates from './pages/admin/AdminCandidates'
import AdminVoters from './pages/admin/AdminVoters'
import AdminResults from './pages/admin/AdminResults'
import AdminAudit from './pages/admin/AdminAudit'
import AdminSettings from './pages/admin/AdminSettings'
import AspirantRegistration from './pages/AspirantRegistration'
import StudentRegistration from './pages/StudentRegistration'
import RequireRole from './components/require-role'

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/aspirants/register" element={<AspirantRegistration />} />
      <Route path="/students/register" element={<StudentRegistration />} />

      {/* Shared voter shell; published results remain public. */}
      <Route element={<VoterLayout />}>
        <Route path="/results" element={<ResultsIndex />} />
        <Route path="/results/:electionId" element={<ResultsPage />} />
        <Route element={<RequireRole roles={['voter']} />}>
          <Route path="/dashboard" element={<VoterDashboard />} />
          <Route path="/vote/:electionId" element={<BallotPage />} />
        </Route>
      </Route>

      {/* Electoral commission area: EC reviews aspirants; only super admins manage the election. */}
      <Route element={<RequireRole roles={['super_admin', 'commissioner', 'officer']} />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="candidates" element={<AdminCandidates />} />
          <Route path="results" element={<AdminResults />} />
          <Route element={<RequireRole roles={['super_admin']} />}>
            <Route path="elections" element={<AdminElections />} />
            <Route path="elections/new" element={<AdminElectionNew />} />
            <Route path="elections/:electionId" element={<AdminElectionDetail />} />
            <Route path="voters" element={<AdminVoters />} />
            <Route path="audit" element={<AdminAudit />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
