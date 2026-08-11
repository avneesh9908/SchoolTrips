import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function TopBar() {
  const { isAuthenticated, isAdmin, session, students, activeStudent, selectStudent, logout } = useAuth()
  const navigate = useNavigate()

  const signOut = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const switchChild = () => {
    selectStudent(null)
    navigate('/children')
  }

  return (
    <header className="topbar">
      <div className="brand">
        <span className="dot" />
        <h1 className="display">Trip Explorer</h1>
      </div>

      {isAuthenticated && (
        <div className="topbar-right">
          {isAdmin && <span className="staff-chip">Staff</span>}
          <span className="who">
            {activeStudent ? (
              <>
                <strong>{activeStudent.name}</strong> · {activeStudent.grade.toUpperCase()}
              </>
            ) : (
              <>Signed in as <strong>{session.parentName || 'Parent'}</strong></>
            )}
          </span>
          {isAdmin && (
            <button className="linkbtn" onClick={() => navigate('/children')}>All grades</button>
          )}
          {!isAdmin && students.length > 1 && activeStudent && (
            <button className="linkbtn" onClick={switchChild}>Switch child</button>
          )}
          <button className="linkbtn" onClick={signOut}>Sign out</button>
        </div>
      )}
    </header>
  )
}
