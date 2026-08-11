import { Routes, Route, Navigate } from 'react-router-dom'
import { TopBar } from './components/TopBar'
import { RequireAuth, RequireStudent } from './auth/RequireAuth'
import Login from './pages/Login'
import ChildPicker from './pages/ChildPicker'
import TripPage from './pages/TripPage'

export default function App() {
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
        Questions about a trip? Contact your child's grade coordinator listed on the trip page.
      </footer>
    </div>
  )
}
