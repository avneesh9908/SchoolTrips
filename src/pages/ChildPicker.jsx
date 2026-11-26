import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { GRADES, gradeById, isComingSoon, tripGradeFor } from '../lib/grades'
import { tripCardPhotoFor } from '../lib/tripPhoto'
import { useTripTitles } from '../data/useTripTitles'
import { Icon } from '../components/Icon'
import { useDestinationPhoto } from '../data/useDestinationPhoto'
import { initials } from '../components/TopBar'
import { vehicleFor } from '../lib/journey'

export default function ChildPicker() {
  const { students, selectStudent, session, isAdmin } = useAuth()
  const navigate = useNavigate()
  const titles = useTripTitles()

  if (isAdmin) return <GradePicker name={session?.parentName} navigate={navigate} titles={titles} />

  const open = (student) => {
    selectStudent(student.id)
    navigate(`/trip/${tripGradeFor(student)}`)
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
          // The trip's grade drives the picture, the destination and the link; the
          // pill keeps the child's own grade. They differ only for an MLC
          // (Mavericks) child — a Grade 6 one travels with Grade 5, a Grade 9 one
          // on the MLC trip.
          const g = gradeById(tripGradeFor(s))
          // Whether the grade is announced is read from the sheet's own trip names
          // (2026-08-26), so a grade the school publishes opens with no code change.
          const soon = isComingSoon(g.id, titles)
          return (
            <PickCard
              key={s.id}
              grade={g}
              title={s.name}
              code={gradeById(s.grade).label}
              status={s.section ? `Section ${s.section}` : ''}
              line={tripLine(g, titles, soon)}
              cta="View trip details →"
              comingSoon={soon}
              vehicle={vehicleFor(g.id, titles?.[g.id] || '')}
              onClick={() => open(s)}
            />
          )
        })}
      </div>
    </>
  )
}

/** Staff view: every grade in the school. */
function GradePicker({ name, navigate, titles }) {
  const live = GRADES.filter((g) => !isComingSoon(g.id, titles)).length

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
        <span className="count">{live} of {GRADES.length} open</span>
      </div>

      <div className="card-grid">
        {GRADES.map((g) => {
          const soon = isComingSoon(g.id, titles)
          return (
            <PickCard
              key={g.id}
              grade={g}
              title={g.full}
              code={g.label}
              line={tripLine(g, titles, soon)}
              cta="View trip details →"
              comingSoon={soon}
              vehicle={vehicleFor(g.id, titles?.[g.id] || '')}
              onClick={() => navigate(`/trip/${g.id}`)}
            />
          )
        })}
      </div>
    </>
  )
}

/**
 * The card's second line: the trip's own name, which is what the school asked
 * for in place of the words "Trip plan".
 *
 * `titles` is null until the sheet lands. An em space rather than "Loading…"
 * keeps the card the same height, so the grid does not jump when the names
 * arrive a moment later.
 */
function tripLine(grade, titles, soon) {
  if (soon) return 'Trip not announced yet'
  if (!titles) return ' '
  return titles[grade.id] || 'Not published yet'
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

/**
 * The badge's picture and word. Kept as plain characters rather than added to
 * `Icon.jsx`: that component is the app's real icon set, and these four are
 * decoration on a hover state.
 */
const RIDE_GLYPH = { train: '🚆', bus: '🚌', plane: '✈️', boat: '⛵' }
const RIDE_WORD = { train: 'Ride along', bus: 'Hop on', plane: 'Take off', boat: 'Set sail' }

/**
 * A grade whose trip is not published yet renders as a plain `div`, never a
 * disabled button: there is nothing behind it, so it must not take focus or
 * invite a click that does nothing.
 */
function PickCard({ grade, title, code, status, line, cta, comingSoon = false, vehicle, onClick }) {
  const Tag = comingSoon ? 'div' : 'button'
  // A grade with no trip gets no photograph either — the picture is of the trip,
  // and there is nothing to picture until one is announced.
  const photo = comingSoon ? '' : tripCardPhotoFor(grade.id)
  const [broken, setBroken] = useState(false)
  const showPhoto = photo && !broken

  /**
   * A credited stand-in where the school has supplied no photograph for this
   * grade. `line` is the destination — the trip's own name, already on the card
   * — so a grade travelling to several places passes all of them and the first
   * that Wikipedia can match wins.
   *
   * Not fetched for a coming-soon grade: there is no trip to illustrate yet.
   */
  const found = useDestinationPhoto(comingSoon ? '' : line, !photo)
  const [standInBroken, setStandInBroken] = useState(false)
  const showStandIn = !showPhoto && found && !standInBroken

  return (
    <Tag
      className={comingSoon ? 'pick-card is-soon' : 'pick-card'}
      onClick={comingSoon ? undefined : onClick}
    >
      <span
        className={showPhoto || showStandIn ? 'pick-media has-photo' : 'pick-media'}
        style={{ background: `linear-gradient(150deg, ${grade.color}, #1B2560)` }}
      >
        {showPhoto && (
          <img className="pick-photo" src={photo} alt="" loading="lazy" onError={() => setBroken(true)} />
        )}
        {showStandIn && (
          <img
            className="pick-photo"
            src={found.url}
            alt=""
            loading="lazy"
            onError={() => setStandInBroken(true)}
          />
        )}
        <span className="pick-code">{code}</span>
        {status && <span className="pick-status">{status}</span>}
        {/* The gradient's icon is the placeholder for a missing photograph, not a
            decoration on top of one. */}
        {!showPhoto && !showStandIn && <span className="glyph"><Icon name={grade.icon} stroke="currentColor" /></span>}
        {/* The destination, or "Coming soon" — named on the picture itself, which
            is what the school asked for (2026-08-17): the card's head used to be a
            block of colour that said nothing. */}
        <span className="pick-label">{comingSoon ? 'Coming soon' : line}</span>
        {/* Plain text, not a link: the card is a <button> and an anchor may not
            be nested inside one. The trip page carries the linked credit. It is
            still said here, because a photograph on a card is read as the trip's
            photograph just as readily as one on the banner. */}
        {showStandIn && <span className="pick-credit">area photo · Wikipedia</span>}
        {/* The ride waiting on the card, revealed on hover. `aria-hidden` because it
            is a promise of an animation, not information: the sheet's Travel cell is
            the only thing entitled to tell a parent how their child travels. */}
        {!comingSoon && vehicle && (
          <span className="pick-ride" aria-hidden="true">
            <span className="glyph">{RIDE_GLYPH[vehicle]}</span>
            {RIDE_WORD[vehicle]}
          </span>
        )}
      </span>
      <span className="pick-body">
        {/* The trip's name moved onto the picture above, so it is not repeated
            here — the body is the grade (or the child) and the way in. */}
        <span className="pick-name">
          <span className="n">{title}</span>
        </span>
        <span className="pick-cta">{comingSoon ? 'Coming soon' : cta}</span>
      </span>
    </Tag>
  )
}
