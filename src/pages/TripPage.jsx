import { useState, useMemo, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useTrip } from '../data/useTrip'
import { gradeById } from '../lib/grades'
import { fetchDestinationPhoto } from '../lib/destinationPhoto'
import { Section } from '../components/Section'
import { DocCard } from '../components/DocCard'
import { Icon } from '../components/Icon'
import { Loading, ErrorState, EmptyState } from '../components/States'

export default function TripPage() {
  const { gradeId } = useParams()
  const navigate = useNavigate()
  const { canAccessGrade, students, activeStudent, isAdmin } = useAuth()

  const allowed = canAccessGrade(gradeId)
  // The child's section decides which batch's dates and travel apply. Staff
  // have no section and see every batch.
  const { status, trip, error, retry } = useTrip(gradeId, {
    enabled: allowed,
    section: activeStudent?.section || '',
  })
  const grade = gradeById(gradeId)
  const photo = useDestinationPhoto(trip?.title, trip?.coverImage)

  const sections = useMemo(
    () => (trip ? buildSections(trip, activeStudent, photo) : []),
    [trip, activeStudent, photo]
  )

  // The tab a parent picked, held by id rather than index: the list is built
  // from the data, so a different grade can have a different set of tabs and a
  // remembered index would land on the wrong one.
  const [chosen, setChosen] = useState('')
  const active = sections.some((s) => s.id === chosen) ? chosen : sections[0]?.id || ''

  // Someone typed another grade into the address bar.
  if (!allowed) {
    return (
      <EmptyState
        title="Not your child's grade"
        message={`You can only view trip details for ${
          activeStudent ? gradeById(activeStudent.grade).full : 'your own child'
        }. If this looks wrong, please contact the school office.`}
      />
    )
  }

  return (
    <>
      <TripHero
        grade={grade}
        trip={trip}
        photo={photo}
        loading={status === 'loading'}
        onOpenPhotos={
          sections.some((s) => s.id === 'photos') ? () => openTab('photos', setChosen) : null
        }
        back={
          (isAdmin || students.length > 0) && {
            label: isAdmin ? 'All grades' : students.length > 1 ? 'All children' : 'Back',
            onClick: () => navigate('/children'),
          }
        }
      />

      {status === 'ready' && trip && <FactBar trip={trip} student={activeStudent} />}

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

      {status === 'ready' && trip && (
        <TripBody sections={sections} active={active} onSelect={setChosen} />
      )}
    </>
  )
}

/**
 * The tab bar sits below a 520px hero, so a button up in the hero has to bring
 * it into view — otherwise the tab changes 600px below the fold and the button
 * looks broken. Clicking a tab itself never scrolls.
 */
function openTab(id, setChosen) {
  setChosen(id)
  requestAnimationFrame(() => {
    revealTab(id)
    const nav = document.querySelector('.secnav')
    if (!nav) return
    const top = nav.getBoundingClientRect().top + window.scrollY - 66
    window.scrollTo({ top, behavior: 'smooth' })
  })
}

/**
 * Slides the tab strip sideways so the chosen tab is visible. The strip is a
 * scroller with its scrollbar hidden, so on a phone the selected tab can sit
 * off the right edge with nothing on screen looking selected. Only the strip
 * moves — the page must not.
 */
function revealTab(id) {
  const el = document.getElementById(`tab-${id}`)
  const strip = el?.parentElement
  if (!strip || strip.scrollWidth <= strip.clientWidth) return
  const left = el.offsetLeft - (strip.clientWidth - el.offsetWidth) / 2
  strip.scrollTo({ left: Math.max(0, left), behavior: 'smooth' })
}

/**
 * The header, in the order the school asked for it: the trip's name, then the
 * batch dates, then the two things a parent opens first.
 *
 * The photograph behind it is of the destination, not of the trip (see
 * `destinationPhoto.js`), so it is credited and the sheet's own `coverImage`
 * always wins over it.
 */
function TripHero({ grade, trip, photo, loading, back, onOpenPhotos }) {
  const [broken, setBroken] = useState(false)
  const image = trip?.coverImage || (photo && photo.url)
  const dateLines = loading ? [] : heroDateLines(trip)
  const itinerary = (trip?.documents || []).find((d) => d.category === 'Itinerary' && d.url)

  return (
    <section className="trip-hero" style={{ background: grade.color }}>
      {image && !broken && (
        <img className="th-photo" src={image} alt="" onError={() => setBroken(true)} />
      )}

      <div className="th-body">
        {back && (
          <button className="backlink" onClick={back.onClick}>← {back.label}</button>
        )}

        <div className="th-eyebrow">
          <span className="th-grade">{grade.full}</span>
          {trip && (
            <span className={trip.status === 'confirmed' ? 'pill is-confirmed' : 'pill is-soon'}>
              {trip.status === 'confirmed' ? 'Confirmed' : 'Details coming soon'}
            </span>
          )}
        </div>

        <h2 className="th-title">{trip?.title || `${grade.full} Trip`}</h2>

        {dateLines.length > 0 && (
          <div className="th-dates">
            {dateLines.map((d) => <span key={d}>{d}</span>)}
          </div>
        )}

        {(onOpenPhotos || itinerary) && (
          <div className="th-actions">
            {onOpenPhotos && (
              <button className="primary" onClick={onOpenPhotos}>
                View photos
              </button>
            )}
            {itinerary && (
              <a className="secondary" href={itinerary.url} target="_blank" rel="noopener noreferrer">
                View itinerary
              </a>
            )}
          </div>
        )}
      </div>

      {!trip?.coverImage && photo && !broken && (
        <a className="th-credit" href={photo.pageUrl} target="_blank" rel="noopener noreferrer">
          {photo.title} · photo from Wikipedia
        </a>
      )}
    </section>
  )
}

/** A destination photo, or null until (or unless) one is found. */
function useDestinationPhoto(destination, override) {
  const [photo, setPhoto] = useState(null)

  useEffect(() => {
    if (override || !destination) {
      setPhoto(null)
      return
    }
    let live = true
    fetchDestinationPhoto(destination).then((p) => {
      if (live) setPhoto(p)
    })
    return () => { live = false }
  }, [destination, override])

  return photo
}

/**
 * The sheet's "Header Text" column opens with a headline — "A Journey Beyond
 * the Classroom" — and then the paragraphs beneath it. Both belong in the
 * Overview tab (the school's choice), the headline set apart from the body so
 * it reads as the opening line rather than the first sentence of a paragraph.
 *
 * A first line too long to be a headline is not treated as one: the whole cell
 * renders as body text instead.
 */
const LEAD_MAX = 200

export function splitHeader(raw) {
  const text = String(raw || '').trim()
  if (!text) return { lead: '', body: '' }
  const [first, ...others] = text.split('\n')
  const lead = first.trim()
  if (!lead || lead.length > LEAD_MAX) return { lead: '', body: text }
  return { lead, body: others.join('\n').trim() }
}

/** One line per batch the page is showing, dates only. */
function heroDateLines(trip) {
  if (!trip) return []
  const lines = (trip.batches || []).map((b) => b.headline).filter(Boolean)
  if (lines.length) return lines
  return trip.dates ? [trip.dates] : ['Dates to be announced']
}

/**
 * The three facts that decide whether the page in front of a parent is about
 * their own child: which batch, when, and who is travelling.
 */
function FactBar({ trip, student }) {
  const facts = [
    heroBatch(trip) && { k: 'Batch', v: heroBatch(trip) },
    heroDates(trip) && { k: 'Dates', v: heroDates(trip) },
    student && {
      k: 'Travelling',
      v: student.section ? `${student.name} · ${student.section}` : student.name,
    },
  ].filter(Boolean)

  if (!facts.length) return null

  return (
    <dl className="factbar">
      {facts.map((f) => (
        <div className="fact" key={f.k}>
          <dt>{f.k}</dt>
          <dd>{f.v}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * Which batch to name. A matched section means this is the child's own batch
 * and can be stated plainly; otherwise the page is showing all of them, and
 * saying "Batch 1" would be wrong.
 */
function heroBatch(trip) {
  if (!trip?.batches?.length) return ''
  if (trip.batchMatched) return trip.batches[0].label || 'Your batch'
  return trip.batches.length > 1 ? `All ${trip.batches.length} batches` : trip.batches[0].label || ''
}

/** The batch headline without the "Batch 1:" prefix already shown beside it. */
function heroDates(trip) {
  if (!trip) return ''
  if (trip.batchMatched && trip.batches?.length) {
    return trip.batches[0].headline.replace(/^batch\s*\d+\s*[:–-]\s*/i, '')
  }
  return trip.dates || ''
}

/**
 * Sections are built from the trip, not declared up front: a section with
 * nothing in it is never rendered, so a half-filled sheet still reads as a
 * finished page rather than a row of empty shelves.
 *
 * Two kinds of content, kept apart on purpose (the school's instruction):
 *   - Parent/Student orientation, photos and the itinerary are FILES → cards
 *     that open the real thing.
 *   - Header text, travel, safety, do's/don'ts and packing are TEXT → printed
 *     on the page, so a parent never has to open a document to read them.
 */
function buildSections(trip, student, photo) {
  const docs = trip.documents || []
  const byCategory = (...names) => docs.filter((d) => names.includes(d.category))
  const hasComm = trip.coordinator || trip.coordinatorPhone || trip.coordinatorEmail || trip.emergency
  const out = []

  // Overview leads, because the sheet's Header Text is the school's opening
  // word to parents and this is the tab that opens by default.
  if (trip.overview || trip.batches?.length) {
    out.push({
      id: 'overview',
      label: 'Overview',
      node: <OverviewSection key="overview" trip={trip} photo={photo} />,
    })
  }

  const studentFacts = studentDetails(trip, student)
  if (studentFacts.length) {
    out.push({
      id: 'student',
      label: 'Student',
      node: (
        <Section
          id="student"
          eyebrow="Your child's trip information, all in one place"
          title="Student details"
          key="student"
        >
          <div className="panel">
            <dl className="kv-list">
              {studentFacts.map((f) => (
                <div className="kv-row" key={f.k}>
                  <dt>{f.k}</dt>
                  <dd>{f.v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Section>
      ),
    })
  }

  const fileDocs = byCategory('Parent orientation', 'Student orientation', 'Itinerary')
  if (fileDocs.length) {
    out.push({
      id: 'documents',
      label: 'Documents',
      node: (
        <Section
          id="documents"
          eyebrow="Important documents"
          title="Everything you need before the trip"
          key="documents"
        >
          <div className="doc-grid">
            {fileDocs.map((d, i) => (
              <DocCard key={`${d.category}-${d.label}-${i}`} {...d} />
            ))}
          </div>
          <PendingNote docs={fileDocs} />
        </Section>
      ),
    })
  }

  if (trip.itinerary.length) {
    out.push({
      id: 'itinerary',
      label: 'Itinerary',
      node: (
        <Section
          id="itinerary"
          eyebrow="Your trip timeline"
          title="Day-wise itinerary"
          key="itinerary"
        >
          <div className="panel">
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
          </div>
        </Section>
      ),
    })
  }

  const guidelineDocs = byCategory('Safety', "Do's and don'ts")
  const hasRules = trip.safety.length || trip.doDonts?.length || trip.dos.length || trip.donts.length
  if (hasRules || guidelineDocs.length) {
    out.push({
      id: 'safety',
      label: 'Safety',
      node: <SafetySection key="safety" trip={trip} docs={guidelineDocs} />,
    })
  }

  if (trip.travel.length) {
    out.push({
      id: 'travel',
      label: 'Travel',
      node: <TravelSection key="travel" legs={trip.travel} />,
    })
  }

  if (trip.reminders.length || hasComm) {
    out.push({
      id: 'reminders',
      label: 'Reminders',
      node: <RemindersSection key="reminders" trip={trip} hasComm={hasComm} />,
    })
  }

  const carryDocs = byCategory('Things to carry')
  if (trip.carry.length || carryDocs.length) {
    out.push({
      id: 'carry',
      label: 'Things to carry',
      node: <CarrySection key="carry" items={trip.carry} docs={carryDocs} />,
    })
  }

  const albums = byCategory('Photos', 'Photos from last year')
  const media = trip.media || []
  if (albums.length || media.length) {
    out.push({
      id: 'photos',
      label: 'Photos',
      node: <PhotosSection key="photos" albums={albums} media={media} title={trip.title} />,
    })
  }

  return out
}

/** Only the facts the sheet and the roster actually carry. */
function studentDetails(trip, student) {
  if (!student) return []
  return [
    { k: 'Student name', v: student.name },
    student.grade && { k: 'Grade', v: gradeById(student.grade).full },
    student.section && { k: 'Section', v: student.section },
    heroBatch(trip) && { k: 'Batch', v: heroBatch(trip) },
    trip.title && { k: 'Trip', v: trip.title },
    heroDates(trip) && { k: 'Dates', v: heroDates(trip) },
  ].filter(Boolean)
}

/**
 * The sections are tabs, not one long page: picking a tab swaps the panel and
 * the page does not move, so each part of the trip plan reads as its own screen.
 * (It scrolled through a single page until 2026-08-13; the school asked for the
 * tab behaviour back.)
 */
function TripBody({ sections, active, onSelect }) {
  if (!sections.length) {
    return (
      <EmptyState
        title="Nothing to show yet"
        message="The school has not added any details for this trip."
      />
    )
  }

  const current = sections.find((s) => s.id === active) || sections[0]

  // Arrow keys move between tabs, which is what a tablist is expected to do.
  // Focus must not scroll the page — but the strip itself has to follow, or the
  // selected tab can end up off the right edge of a phone with nothing on
  // screen looking selected.
  const onKeyDown = (e) => {
    const last = sections.length - 1
    const i = sections.indexOf(current)
    let next = null
    if (e.key === 'ArrowRight') next = i === last ? 0 : i + 1
    if (e.key === 'ArrowLeft') next = i === 0 ? last : i - 1
    if (e.key === 'Home') next = 0
    if (e.key === 'End') next = last
    if (next === null) return
    e.preventDefault()
    onSelect(sections[next].id)
    document.getElementById(`tab-${sections[next].id}`)?.focus({ preventScroll: true })
    revealTab(sections[next].id)
  }

  return (
    <>
      <nav className="secnav">
        <div className="secnav-inner" role="tablist" aria-label="Trip sections" onKeyDown={onKeyDown}>
          {sections.map((s) => (
            <button
              key={s.id}
              id={`tab-${s.id}`}
              role="tab"
              aria-selected={s.id === current.id}
              aria-controls={`panel-${s.id}`}
              tabIndex={s.id === current.id ? 0 : -1}
              className={s.id === current.id ? 'is-active' : undefined}
              onClick={() => onSelect(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </nav>

      <div
        className="sections"
        key={current.id}
        id={`panel-${current.id}`}
        role="tabpanel"
        aria-labelledby={`tab-${current.id}`}
        tabIndex={-1}
      >
        {current.node}
      </div>
    </>
  )
}

function OverviewSection({ trip, photo }) {
  const image = trip.coverImage || (photo && photo.url)
  const { lead, body } = splitHeader(trip.overview)

  return (
    <Section id="overview" eyebrow="Know before you go" title="Orientation overview">
      <div className="overview">
        {image && (
          <div className="overview-photo">
            <img src={image} alt="" />
          </div>
        )}
        <div className="overview-copy">
          <h4>{trip.title}</h4>
          {lead && <p className="overview-lead">{lead}</p>}
          {body && <p className="overview-text">{body}</p>}
        </div>
      </div>

      {trip.batches?.length > 0 && (
        <div className="panel" style={{ marginTop: 28 }}>
          {trip.batchMatched && trip.batchCount > 1 && (
            <p className="batch-note">
              Showing the batch for section <strong>{trip.section}</strong>. Other batches travel on
              different dates.
            </p>
          )}
          {trip.batches.map((b, i) => (
            <div className="batch-row" key={i}>
              {b.label && <span className="batch-tag">{b.label}</span>}
              <div>
                <div className="batch-headline">{b.headline}</div>
                {b.detail && <div className="batch-detail">{b.detail}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

/**
 * Safety points are one line each in the sheet. A line that names its measure
 * before the detail ("Adult supervision: a ratio of 1:12…") opens; a line that
 * is just a sentence has nothing to hide, so it does not pretend to expand.
 */
function splitGuideline(line) {
  const m = line.match(/^([A-Za-z][A-Za-z '&/]{2,47}?)\s*[:–—-]\s+(.+)$/)
  return m ? { title: m[1], body: m[2] } : { title: line, body: '' }
}

function SafetySection({ trip, docs }) {
  const points = trip.safety.map(splitGuideline)
  const [open, setOpen] = useState(0)
  const hasPair = trip.dos.length > 0 || trip.donts.length > 0

  return (
    <Section
      id="safety"
      eyebrow="Safety comes first"
      tone="safety"
      title="Safety guidelines"
      subtitle={points.length ? `${points.length} measures we follow on every school trip.` : undefined}
    >
      {points.length > 0 && (
        <div className="acc">
          {points.map((p, i) => {
            const isOpen = p.body && open === i
            const Head = p.body ? 'button' : 'div'
            return (
              <div className={isOpen ? 'acc-item is-open' : 'acc-item'} key={i}>
                <Head
                  className="acc-head"
                  type={p.body ? 'button' : undefined}
                  aria-expanded={p.body ? isOpen : undefined}
                  onClick={p.body ? () => setOpen(open === i ? -1 : i) : undefined}
                >
                  <span className="acc-title">
                    <span className="acc-n">{i + 1}</span>
                    <span className="acc-label">{p.title}</span>
                  </span>
                  {p.body && <span className="acc-sign">+</span>}
                </Head>
                {isOpen && <p className="acc-body">{p.body}</p>}
              </div>
            )
          })}
        </div>
      )}

      {trip.doDonts?.length > 0 && (
        <ul className="plain" style={{ marginTop: points.length ? 24 : 0 }}>
          {trip.doDonts.map((t, i) => <li key={i}>{t}</li>)}
        </ul>
      )}

      {hasPair && (
        <div className="two-col">
          <RulePanel kind="do" title="Do" lines={trip.dos} />
          <RulePanel kind="dont" title="Don't" lines={trip.donts} />
        </div>
      )}

      {docs.length > 0 && (
        <div className="doc-grid" style={{ marginTop: 24 }}>
          {docs.map((d, i) => <DocCard key={`${d.label}-${i}`} {...d} />)}
        </div>
      )}
      <PendingNote docs={docs} />
    </Section>
  )
}

function RulePanel({ kind, title, lines }) {
  return (
    <div className={`rule-panel ${kind}`}>
      <div className="rule-head">
        <span className="mark">
          <Icon name={kind === 'do' ? 'dodont' : 'close'} stroke="#fff" />
        </span>
        <h4>{title}</h4>
      </div>
      {lines.length ? (
        <ul className="plain">{lines.map((t, i) => <li key={i}>{t}</li>)}</ul>
      ) : (
        <p className="empty-note">Nothing listed.</p>
      )}
    </div>
  )
}

function TravelSection({ legs }) {
  return (
    <Section id="travel" eyebrow="Getting there and back" title="Travel details">
      <div className="travel-grid">
        {legs.map((leg, i) => {
          // The school writes travel as prose in one cell. Showing the empty
          // train/departure row above it just adds a line of em dashes.
          const structured = leg.trainNo || leg.departure || leg.platform || leg.coachSeat

          return (
            <div className="travel-card" key={i}>
              <div className="travel-top">
                <span className="label">{leg.leg}</span>
                {leg.trainNo && <span className="train">Train {leg.trainNo}</span>}
              </div>

              {structured && (
                <div className="travel-route">
                  <div>
                    <div className="k">Departs</div>
                    <div className="v">{leg.departure || '—'}</div>
                  </div>
                  <div className="track">
                    <span><Icon name="train" stroke="currentColor" /></span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="k">{leg.platform ? 'Platform' : 'Coach / seat'}</div>
                    <div className="v">{leg.platform || leg.coachSeat || '—'}</div>
                  </div>
                </div>
              )}

              {leg.notes && (
                <p className={structured ? 'travel-notes has-route' : 'travel-notes'}>{leg.notes}</p>
              )}
            </div>
          )
        })}
      </div>
    </Section>
  )
}

function RemindersSection({ trip, hasComm }) {
  return (
    <Section id="reminders" eyebrow="Your trip timeline" title="Important reminders">
      <div className="reminders-split">
        {trip.reminders.length > 0 && (
          <div className="reminder-list">
            {trip.reminders.map((r, i) => {
              const when = splitDate(r.date)
              return (
                <div className="reminder-row" key={i}>
                  <div className="reminder-rail">
                    <div className="reminder-date">
                      <div>
                        <div className="d">{when.day || '·'}</div>
                        {when.month && <div className="m">{when.month}</div>}
                      </div>
                    </div>
                    {i < trip.reminders.length - 1 && <div className="reminder-line" />}
                  </div>
                  <div className="reminder-text">
                    <div className="task">{r.text}</div>
                    {when.rest && <div className="note">{when.rest}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {hasComm && (
          <div id="communication" className="comm">
            <h4>Communication</h4>
            <p>For trip-related questions, please contact the trip coordinator.</p>
            {trip.coordinator && <p>{trip.coordinator}</p>}
            {trip.emergency && <p>Emergency contact: {trip.emergency}</p>}
            <div className="contacts">
              {trip.coordinatorPhone ? (
                <a href={`tel:${trip.coordinatorPhone}`}>{trip.coordinatorPhone}</a>
              ) : (
                <span>Phone to be added</span>
              )}
              {trip.coordinatorEmail ? (
                <a href={`mailto:${trip.coordinatorEmail}`}>{trip.coordinatorEmail}</a>
              ) : (
                <span>Email to be added</span>
              )}
            </div>
          </div>
        )}
      </div>
    </Section>
  )
}

/**
 * "12 December 2026" becomes the design's day/month tile plus the full date
 * underneath; anything the pattern does not fit stays one line, so a school
 * that writes "Before departure" is still rendered correctly.
 */
function splitDate(raw) {
  const s = String(raw || '').trim()
  const m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,})(.*)$/)
  if (!m) return { day: '', month: '', rest: s }
  return { day: m[1], month: m[2].slice(0, 3), rest: s }
}

function CarrySection({ items, docs }) {
  const [packed, setPacked] = useState({})
  const count = Object.values(packed).filter(Boolean).length

  return (
    <Section
      id="carry"
      eyebrow="What to carry"
      tone="carry"
      title="Things to carry"
      aside={items.length ? `${count} of ${items.length} packed` : undefined}
    >
      {items.length > 0 && (
        <div className="check-grid">
          {items.map((item, i) => (
            <button
              key={i}
              className={packed[i] ? 'check-item is-on' : 'check-item'}
              aria-pressed={!!packed[i]}
              onClick={() => setPacked((p) => ({ ...p, [i]: !p[i] }))}
            >
              <span className="box"><Icon name="dodont" stroke="#fff" strokeWidth="3.4" /></span>
              <span className="txt">{item}</span>
            </button>
          ))}
        </div>
      )}

      {docs.length > 0 && (
        <div className="doc-grid" style={{ marginTop: items.length ? 24 : 0 }}>
          {docs.map((d, i) => <DocCard key={`${d.label}-${i}`} {...d} />)}
        </div>
      )}
      <PendingNote docs={docs} />
    </Section>
  )
}

function PhotosSection({ albums, media, title }) {
  return (
    <Section
      id="photos"
      eyebrow="Memories from the journey"
      title="Trip photos"
      aside={title}
    >
      {media.length > 0 && (
        <div className="photo-masonry">
          {media.map((m, i) => <PhotoTile key={i} item={m} />)}
        </div>
      )}

      {albums.length > 0 && (
        <div className="doc-grid" style={{ marginTop: media.length ? 24 : 0 }}>
          {albums.map((d, i) => <DocCard key={`${d.label}-${i}`} {...d} />)}
        </div>
      )}
      <PendingNote docs={albums} />
    </Section>
  )
}

/**
 * A photo a parent's browser may not be able to load — a Drive image that is
 * not link-shared 403s. Falling back to a typed tile keeps the grid looking
 * deliberate instead of leaving a white gap, and the link still works.
 */
function PhotoTile({ item }) {
  const [broken, setBroken] = useState(false)
  const isVideo = item.type === 'video'

  return (
    <a
      className="photo-item"
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      title={item.caption || ''}
    >
      {isVideo || broken ? (
        <div className="thumb">
          {isVideo ? <span className="play">▶</span> : <Icon name="photo" stroke="currentColor" />}
        </div>
      ) : (
        <img src={item.url} alt={item.caption || ''} loading="lazy" onError={() => setBroken(true)} />
      )}
      {item.caption && <span className="cap">{item.caption}</span>}
    </a>
  )
}

/**
 * One explanation per section for cards the sheet named but did not link — not
 * one per card. Repeated, it reads as a broken page; said once, it reads as
 * "the school is still filling this in".
 */
function PendingNote({ docs }) {
  const pending = docs.filter((d) => d.pending).length
  if (!pending) return null
  return (
    <p className="pending-note">
      {pending === docs.length
        ? 'The school has listed these files but has not added their links yet. Ask your grade coordinator for a copy.'
        : `${pending} of these files has no link yet — ask your grade coordinator for a copy.`}
    </p>
  )
}
