import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { GRADES, gradeById } from '../lib/grades'
import { Icon } from '../components/Icon'

export default function ChildPicker() {
  const { students, selectStudent, session, isAdmin } = useAuth()
  const navigate = useNavigate()

  if (isAdmin) return <GradePicker name={session?.parentName} navigate={navigate} />

  const open = (student) => {
    selectStudent(student.id)
    navigate(`/trip/${student.grade}`)
  }

  // Shown even for a single child: the card is the parent's confirmation that
  // this is the one student they are entitled to, before any grade content
  // opens. Trip content is common to the whole grade — the child's name is the
  // only personal thing on either screen.
  const one = students.length === 1

  return (
    <>
      <div className="hero">
        <div className="hero-blob b1" />
        <div className="hero-blob b2" />
        <h2 className="display">Welcome{session?.parentName ? `, ${session.parentName}` : ''}</h2>
        <p>
          {one
            ? 'Tap your child below to see their trip plan — itinerary, safety guidelines, packing list, travel details, photos and orientation documents.'
            : `You have ${students.length} children registered. Choose one to see their trip plan —
               itinerary, safety guidelines, packing list, travel details, photos and orientation documents.`}
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

/** Staff view: every grade in the school. */
function GradePicker({ name, navigate }) {
  return (
    <>
      <div className="hero">
        <div className="hero-blob b1" />
        <div className="hero-blob b2" />
        <span className="staff-chip">Staff access</span>
        <h2 className="display">Welcome{name ? `, ${name}` : ''}</h2>
        <p>
          You can view every grade. Pick one to see its trip plan exactly as parents of that
          grade see it.
        </p>
      </div>

      <div className="child-grid">
        {GRADES.map((g) => (
          <button key={g.id} className="child-card" onClick={() => navigate(`/trip/${g.id}`)}>
            <div className="cc-bg" style={{ background: g.color }} />
            <div className="cc-status">{g.label}</div>
            <div className="cc-icon">
              <Icon name={g.icon} stroke="#fff" />
            </div>
            <div className="cc-txt">
              <div className="cc-name">{g.full}</div>
            </div>
          </button>
        ))}
      </div>
    </>
  )
}
