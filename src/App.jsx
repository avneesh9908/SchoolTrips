import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { TopBar } from './components/TopBar'
import { RequireAuth, RequireStudent } from './auth/RequireAuth'
import Login from './pages/Login'
import ChildPicker from './pages/ChildPicker'
import TripPage from './pages/TripPage'

export default function App() {
  const { pathname } = useLocation()
  // The sign-in screen carries its own brand mark and fills the window, so the
  // shared header and footer would only repeat it.
  const bare = pathname === '/login'

  /**
   * The trip page is a fixed-height view: it fills the window exactly and the
   * window never scrolls (the school's instruction, 2026-08-14 — "I don't want
   * scrollbar anywhere"). The footer goes with the scroll, because ~117px of
   * chrome is the difference between fitting and not — and its one line of copy
   * points at the trip page, which is where the reader already is.
   */
  const fixed = pathname.startsWith('/trip/')

  return (
    <div className={fixed ? 'app is-fixed' : 'app'}>
      {!bare && <TopBar />}

      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/children" element={<RequireAuth><Page><ChildPicker /></Page></RequireAuth>} />
        <Route path="/trip/:gradeId" element={<RequireStudent><Page><TripPage /></Page></RequireStudent>} />
        <Route path="*" element={<Navigate to="/children" replace />} />
      </Routes>

      {!bare && !fixed && <SiteFooter />}
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
