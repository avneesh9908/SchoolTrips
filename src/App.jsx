import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { TopBar } from './components/TopBar'
import { RequireAuth, RequireStudent } from './auth/RequireAuth'
import Login from './pages/Login'
import ChildPicker from './pages/ChildPicker'
import TripPage from './pages/TripPage'

export default function App() {
  // The sign-in screen carries its own brand mark and fills the window, so the
  // shared header and footer would only repeat it.
  const bare = useLocation().pathname === '/login'

  return (
    <div className="app">
      {!bare && <TopBar />}

      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/children" element={<RequireAuth><Page><ChildPicker /></Page></RequireAuth>} />
        <Route path="/trip/:gradeId" element={<RequireStudent><Page><TripPage /></Page></RequireStudent>} />
        <Route path="*" element={<Navigate to="/children" replace />} />
      </Routes>

      {!bare && <SiteFooter />}
    </div>
  )
}

function Page({ children }) {
  return (
    <main className="page">
      <div className="shell">{children}</div>
    </main>
  )
}

function SiteFooter() {
  return (
    <footer className="sitefoot">
      <div className="sitefoot-inner">
        <div className="brand">
          <span className="mark">ST</span>
          <span className="name">School Educational Trips</span>
        </div>
        <p className="note">
          Questions about a trip? Contact your child's grade coordinator listed on the trip page.
        </p>
        <span className="copy">© {new Date().getFullYear()} Fountainhead School Trips</span>
      </div>
    </footer>
  )
}
