import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { GRADES, gradeById } from '../lib/grades'
import { Icon } from '../components/Icon'
import { initials } from '../components/TopBar'

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
      <DashHead
        here={one ? 'Your child' : 'Your children'}
        title="Educational Trips"
        lede={
          one
            ? "Open your child's trip plan — itinerary, safety guidelines, packing list, travel details, photos and orientation documents."
            : `You have ${students.length} children registered. Choose one to see their trip plan.`
        }
        name={session?.parentName}
        role="Parent account"
      />

      <div className="list-head">
        <h3>{one ? 'Your child' : 'Select a child'}</h3>
        <span className="count">{students.length} registered</span>
      </div>

      <div className="card-grid">
        {students.map((s) => {
          const g = gradeById(s.grade)
          return (
            <PickCard
              key={s.id}
              grade={g}
              title={s.name}
              code={g.label}
              status={s.section ? `Section ${s.section}` : ''}
              line={`${g.full} · trip plan`}
              cta="View trip details →"
              onClick={() => open(s)}
            />
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
      <DashHead
        here="All grades"
        title="Educational Trips"
        lede="Explore the trip plan for any grade, exactly as parents of that grade see it."
        name={name}
        role="Staff account"
      />

      <div className="list-head">
        <h3>Select a grade</h3>
        <span className="count">{GRADES.length} grades</span>
      </div>

      <div className="card-grid">
        {GRADES.map((g) => (
          <PickCard
            key={g.id}
            grade={g}
            title={g.full}
            code={g.label}
            line="Trip plan"
            cta="View trip details →"
            onClick={() => navigate(`/trip/${g.id}`)}
          />
        ))}
      </div>
    </>
  )
}

function DashHead({ here, title, lede, name, role }) {
  return (
    <div className="dash-head">
      <div>
        <div className="crumbs">
          <span>School Trips</span><span>/</span><span className="here">{here}</span>
        </div>
        <h2>{title}</h2>
        <p className="lede">{lede}</p>
      </div>
      <div className="account-card">
        <span className="avatar">{initials(name || role)}</span>
        <span>
          <span className="n" style={{ display: 'block' }}>{name || 'Signed in'}</span>
          <span className="r">{role}</span>
        </span>
      </div>
    </div>
  )
}

function PickCard({ grade, title, code, status, line, cta, onClick }) {
  return (
    <button className="pick-card" onClick={onClick}>
      <span className="pick-media" style={{ background: `linear-gradient(150deg, ${grade.color}, #1B2560)` }}>
        <span className="pick-code">{code}</span>
        {status && <span className="pick-status">{status}</span>}
        <span className="glyph"><Icon name={grade.icon} stroke="currentColor" /></span>
      </span>
      <span className="pick-body">
        <span className="pick-name">
          <span className="n">{title}</span>
          <span className="line">{line}</span>
        </span>
        <span className="pick-cta">{cta}</span>
      </span>
    </button>
  )
}
