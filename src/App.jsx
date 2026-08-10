import { Routes, Route, Navigate } from 'react-router-dom'
import { TopBar } from './components/TopBar'
import { RequireAuth, RequireStudent } from './auth/RequireAuth'
import { isMock } from './data'
import Login from './pages/Login'
import ChildPicker from './pages/ChildPicker'
import TripPage from './pages/TripPage'

export default function App() {
  const sampleData = isMock()

  return (
    <div className="shell">
      <TopBar />

      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/children" element={<RequireAuth><ChildPicker /></RequireAuth>} />
        <Route path="/trip/:gradeId" element={<RequireStudent><TripPage /></RequireStudent>} />
        <Route path="*" element={<Navigate to="/children" replace />} />
      </Routes>

      <footer className="note">
        {sampleData && <><span className="source-tag">Sample data</span><br /><br /></>}
        Questions about a trip? Contact your child's grade coordinator listed on the trip page.
      </footer>
    </div>
  )
}
