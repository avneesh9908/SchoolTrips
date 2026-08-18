import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { gradeById } from '../lib/grades'

/** "Aadhyan Khunt" → "AK", for the monogram the design puts beside the name. */
export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'ST'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

export function TopBar() {
  const { isAuthenticated, isAdmin, isStudent, session, students, activeStudent, selectStudent, logout } = useAuth()
  const navigate = useNavigate()

  const signOut = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const switchChild = () => {
    selectStudent(null)
    navigate('/children')
  }

  const who = session?.parentName || (isAdmin ? 'Staff' : isStudent ? 'Student' : 'Parent')

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand">
          <span className="mark">ST</span>
          <h1>Educational Trips</h1>
        </div>

        {isAuthenticated && (
          <div className="topbar-right">
            {isAdmin && <span className="staff-chip">Staff</span>}
            {isAdmin && (
              <button className="ghostbtn" onClick={() => navigate('/children')}>
                All grades
              </button>
            )}
            {/* Shown for a single child too, not just several. The trip page's own
                back link was removed on 2026-08-14, so for a one-child parent this
                is the ONLY way back to the card — without it they were stranded on
                the trip page. */}
            {!isAdmin && activeStudent && (
              <button className="ghostbtn" onClick={switchChild}>
                {/* A student signing in with their own address has exactly one row, and
                    "My child" would be addressing the wrong person. */}
                {isStudent ? 'My trip' : students.length > 1 ? 'Switch child' : 'My child'}
              </button>
            )}
            <button className="ghostbtn" onClick={signOut}>Sign out</button>

            <div className="account">
              <span className="who">
                <span className="n">{who}</span>
                <span className="r">
                  {activeStudent
                    ? `${activeStudent.name} · ${gradeById(activeStudent.grade).full}`
                    : isAdmin ? 'Staff account' : isStudent ? 'Student account' : 'Parent account'}
                </span>
              </span>
              <span className="avatar">{initials(who)}</span>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
