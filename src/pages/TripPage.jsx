import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useTrip } from '../data/useTrip'
import { gradeById } from '../lib/grades'
import { Section } from '../components/Section'
import { DocCard } from '../components/DocCard'
import { Loading, ErrorState, EmptyState } from '../components/States'

export default function TripPage() {
  const { gradeId } = useParams()
  const navigate = useNavigate()
  const { canAccessGrade, students, activeStudent, isAdmin } = useAuth()

  const allowed = canAccessGrade(gradeId)
  const { status, trip, error, retry } = useTrip(gradeId, { enabled: allowed })
  const grade = gradeById(gradeId)

  // Someone typed another grade into the address bar.
  if (!allowed) {
    return (
      <EmptyState
        title="Not your child's grade"
        message={`You can only view trip details for ${
          activeStudent ? activeStudent.grade.toUpperCase() : 'your own child'
        }. If this looks wrong, please contact the school office.`}
      />
    )
  }

  return (
    <>
      {(isAdmin || students.length > 1) && (
        <button className="backbtn" onClick={() => navigate('/children')}>
          ← {isAdmin ? 'All grades' : 'All children'}
        </button>
      )}

      <div className="detail-hero" style={{ background: grade.color }}>
        <div className="banner">
          <span className="pill">{grade.full}</span>
          {activeStudent && <span className="pill">{activeStudent.name}</span>}
          {status === 'ready' && trip && (
            <span className="pill">{trip.status === 'confirmed' ? 'Confirmed' : 'Details coming soon'}</span>
          )}
          <h2 className="display">{trip?.title || `${grade.full} Trip`}</h2>
          <p className="dates">{trip?.dates || 'Dates to be announced'}</p>
        </div>
        {trip?.coverImage && (
          <img className="cover" src={trip.coverImage} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }} />
        )}
      </div>

      {status === 'loading' && <Loading message="Loading your child's trip details…" />}

      {status === 'error' && (
        <ErrorState title="Could not load the trip" message={error} onRetry={retry} />
      )}

      {status === 'ready' && !trip && (
        <EmptyState
          title="Nothing published yet"
          message={`No trip has been announced for ${grade.full} yet. Please check back later.`}
        />
      )}

      {status === 'ready' && trip && <TripSections trip={trip} />}
    </>
  )
}

function TripSections({ trip }) {
  const hasTicket = trip.travel.length > 0
  const hasComm = trip.coordinator || trip.coordinatorPhone || trip.coordinatorEmail || trip.emergency

  return (
    <div className="sections">
      {trip.overview && (
        <Section icon="overview" title="Orientation overview">
          <p className="overview-text">{trip.overview}</p>
        </Section>
      )}

      {trip.documents.length > 0 && (
        <Section icon="resources" title="Orientation decks & documents">
          <div className="doc-grid">
            {trip.documents.map((d, i) => (
              <DocCard key={`${d.url}-${i}`} label={d.label} url={d.url} category={d.category} />
            ))}
          </div>
        </Section>
      )}

      {trip.itinerary.length > 0 && (
        <Section icon="itinerary" title="Itinerary">
          <table className="itin-table">
            <thead>
              <tr><th>Day</th><th>Time</th><th>Activity</th><th>Location</th></tr>
            </thead>
            <tbody>
              {trip.itinerary.map((r, i) => (
                <tr key={i}>
                  <td className="day">{r.day}</td>
                  <td>{r.time}</td>
                  <td>{r.activity}</td>
                  <td>{r.location}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {trip.safety.length > 0 && (
        <Section icon="safety" title="Safety guidelines">
          <ul className="plain">
            {trip.safety.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </Section>
      )}

      {(trip.dos.length > 0 || trip.donts.length > 0) && (
        <Section icon="dodont" title="Do's and don'ts">
          <div className="two-col">
            <div>
              <h4 className="col-title do">Do</h4>
              {trip.dos.length ? (
                <ul className="plain">{trip.dos.map((t, i) => <li key={i}>{t}</li>)}</ul>
              ) : <p className="empty-note">—</p>}
            </div>
            <div>
              <h4 className="col-title dont">Don't</h4>
              {trip.donts.length ? (
                <ul className="plain">{trip.donts.map((t, i) => <li key={i}>{t}</li>)}</ul>
              ) : <p className="empty-note">—</p>}
            </div>
          </div>
        </Section>
      )}

      {hasTicket && (
        <Section icon="ticket" title="Travel details">
          {trip.travel.map((leg, i) => (
            <div key={i}>
              <h4 className="leg-title">{leg.leg}</h4>
              <div className="kv-grid">
                <div><span className="k">Train</span>{leg.trainNo || '—'}</div>
                <div><span className="k">Departure</span>{leg.departure || '—'}</div>
                {leg.platform && <div><span className="k">Platform</span>{leg.platform}</div>}
                {leg.coachSeat && <div><span className="k">Coach / seat</span>{leg.coachSeat}</div>}
              </div>
              {leg.notes && <p className="ticket-notes">{leg.notes}</p>}
            </div>
          ))}
        </Section>
      )}

      {trip.reminders.length > 0 && (
        <Section icon="reminder" title="Reminders">
          {trip.reminders.map((r, i) => (
            <div className="reminder-item" key={i}>
              <div className="rdate">{r.date}</div>
              {r.text}
            </div>
          ))}
        </Section>
      )}

      {trip.media.length > 0 && (
        <Section icon="photo" title="Photos and videos">
          <div className="photo-grid">
            {trip.media.map((m, i) => (
              <a className="photo-item" key={i} href={m.url} target="_blank" rel="noopener noreferrer">
                {m.type === 'video'
                  ? <div className="thumb">▶ Video</div>
                  : <img src={m.url} alt="" loading="lazy" />}
                <div className="cap">{m.caption || (m.type === 'video' ? 'Watch' : 'Photo')}</div>
              </a>
            ))}
          </div>
        </Section>
      )}

      <Section icon="comm" title="Communication">
        {hasComm ? (
          <div className="kv-grid">
            <div><span className="k">Trip coordinator</span>{trip.coordinator || '—'}</div>
            <div><span className="k">Phone</span>{trip.coordinatorPhone || '—'}</div>
            <div><span className="k">Email</span>{trip.coordinatorEmail || '—'}</div>
            <div><span className="k">Emergency contact</span>{trip.emergency || '—'}</div>
          </div>
        ) : (
          <p className="empty-note">Coordinator contact details will be shared shortly.</p>
        )}
      </Section>

      {trip.carry.length > 0 && (
        <Section icon="carry" title="Things to carry">
          <ul className="plain check-list">
            {trip.carry.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </Section>
      )}
    </div>
  )
}
