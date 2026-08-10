import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { gradeById } from '../lib/grades'
import { Icon } from '../components/Icon'

export default function ChildPicker() {
  const { students, selectStudent, session } = useAuth()
  const navigate = useNavigate()

  const only = students.length === 1 ? students[0] : null

  // A parent with a single child never needs to make a choice.
  useEffect(() => {
    if (only) {
      selectStudent(only.id)
      navigate(`/trip/${only.grade}`, { replace: true })
    }
  }, [only, selectStudent, navigate])

  if (only) return null

  const open = (student) => {
    selectStudent(student.id)
    navigate(`/trip/${student.grade}`)
  }

  return (
    <>
      <div className="hero">
        <div className="hero-blob b1" />
        <div className="hero-blob b2" />
        <h2 className="display">Welcome{session?.parentName ? `, ${session.parentName}` : ''}</h2>
        <p>
          You have {students.length} children registered. Choose one to see their trip plan —
          itinerary, safety guidelines, packing list, travel details and orientation documents.
        </p>
      </div>

      <div className="child-grid">
        {students.map((s) => {
          const g = gradeById(s.grade)
          return (
            <button key={s.id} className="child-card" onClick={() => open(s)}>
              <div className="cc-bg" style={{ background: g.color }} />
              <div className="cc-status">{g.label}</div>
              <div className="cc-icon">
                <Icon name={g.icon} stroke="#fff" />
              </div>
              <div className="cc-txt">
                <div className="cc-name">{s.name}</div>
                <div className="cc-sub">
                  {g.full}
                  {s.section ? ` · Section ${s.section}` : ''}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </>
  )
}
