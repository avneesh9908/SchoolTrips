import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { TopBar } from './components/TopBar'
import { RequireAuth, RequireStudent } from './auth/RequireAuth'
import Login from './pages/Login'
import ChildPicker from './pages/ChildPicker'
import TripPage from './pages/TripPage'
import { TRIP_LAYOUT } from './lib/layout'

/**
 * Route class per trip layout. `is-stage` carries the design and the second class says
 * how it meets the window: `is-scroll` lets the page grow, `is-fit` locks it to one
 * screen. `'flow'` is absent on purpose — it is an ordinary scrolling page and takes
 * no class at all.
 */
const APP_CLASS = {
  stage: 'app is-stage is-scroll',
  'stage-tabs': 'app is-stage is-scroll',
  'stage-fit': 'app is-stage is-fit',
  fixed: 'app is-fixed',
}

/**
 * The layouts that drop the site footer, which is every one that fits a tab to the
 * window or close to it: ~117px of chrome was the difference between fitting and not,
 * and even where the page may scroll, the footer alone would put a scrollbar on a tab
 * that otherwise ends exactly at the fold. The one-page layouts keep it — there the
 * page is long already and the footer is how it ends.
 */
const NO_FOOTER = new Set(['stage-tabs', 'stage-fit', 'fixed'])

export default function App() {
  const { pathname } = useLocation()
  // The sign-in screen carries its own brand mark and fills the window, so the
  // shared header and footer would only repeat it.
  const bare = pathname === '/login'

  // Which trip layout is in force — see `lib/layout.js` for the five of them, and the
  // two tables above for the class each one wears and whether it keeps the footer.
  const mode = pathname.startsWith('/trip/') ? TRIP_LAYOUT : ''
  const appClass = APP_CLASS[mode] || 'app'
  const footer = !bare && !NO_FOOTER.has(mode)

  return (
    <div className={appClass}>
      {!bare && <TopBar />}

      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/children" element={<RequireAuth><Page><ChildPicker /></Page></RequireAuth>} />
        {/* Two routes, one component. `/trip/:gradeId` lands on the trip when the
            grade has one, and on the trip picker when it has several — the extra
            step the school asked for (2026-08-21: "show extra page after the grade
            to selected the trip when more then one trip"). `/t/:tripIndex` is the
            chosen trip, a real URL so Back leaves a trip for the picker and a
            parent can bookmark the one their child is on. */}
        <Route path="/trip/:gradeId" element={<RequireStudent><Page><TripPage /></Page></RequireStudent>} />
        <Route path="/trip/:gradeId/t/:tripIndex" element={<RequireStudent><Page><TripPage /></Page></RequireStudent>} />
        <Route path="*" element={<Navigate to="/children" replace />} />
      </Routes>

      {footer && <SiteFooter />}
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
