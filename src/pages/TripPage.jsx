import { useState, useMemo, useRef, useEffect } from 'react'
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
      {(isAdmin || students.length > 0) && (
        <button className="backbtn" onClick={() => navigate('/children')}>
          ← {isAdmin ? 'All grades' : students.length > 1 ? 'All children' : 'Back'}
        </button>
      )}

      <TripHero grade={grade} trip={trip} student={activeStudent} loading={status === 'loading'} />

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

      {status === 'ready' && trip && <TripTabs trip={trip} accent={grade.color} />}
    </>
  )
}

/**
 * The header, in the order the school asked for it: the trip's name, then the
 * batch, then the dates, then whose child is travelling. Everything below the
 * name is a labelled fact rather than a row of anonymous pills — "Batch 2" on
 * its own does not tell a parent it is their child's batch.
 *
 * The photograph behind it is of the destination, not of the trip (see
 * `destinationPhoto.js`), so it is credited and the sheet's own `coverImage`
 * always wins over it.
 */
function TripHero({ grade, trip, student, loading }) {
  const photo = useDestinationPhoto(trip?.title, trip?.coverImage)
  const [broken, setBroken] = useState(false)
  const image = trip?.coverImage || (photo && photo.url)

  const batch = heroBatch(trip)
  const dates = heroDates(trip) || (loading ? '' : 'Dates to be announced')

  const facts = [
    batch && { k: 'Batch', v: batch },
    dates && { k: 'Dates', v: dates },
    student && {
      k: 'Travelling',
      v: student.section ? `${student.name} · ${student.section}` : student.name,
    },
  ].filter(Boolean)

  return (
    <section className={image && !broken ? 'trip-hero has-photo' : 'trip-hero'} style={{ background: grade.color }}>
      {image && !broken && (
        <img className="th-photo" src={image} alt="" onError={() => setBroken(true)} />
      )}

      <div className="th-body">
        <div className="th-eyebrow">
          <span className="pill">{grade.full}</span>
          {trip && trip.status !== 'confirmed' && <span className="pill">Details coming soon</span>}
        </div>

        <h2 className="th-title display">{trip?.title || `${grade.full} Trip`}</h2>

        {facts.length > 0 && (
          <dl className="th-facts">
            {facts.map((f) => (
              <div className="th-fact" key={f.k}>
                <dt>{f.k}</dt>
                <dd>{f.v}</dd>
              </div>
            ))}
          </dl>
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
 * Which batch to name in the header. A matched section means this is the child's
 * own batch and can be stated plainly; otherwise the page is showing all of
 * them, and saying "Batch 1" would be wrong.
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
 * Tabs are built from the trip, not declared up front: a tab with nothing in it
 * is never rendered, so a half-filled sheet still reads as a finished page
 * rather than a row of empty shelves.
 *
 * Two kinds of content, kept apart on purpose (the school's instruction):
 *   - Parent/Student orientation, photos and the itinerary are FILES → cards
 *     that open the real thing.
 *   - Header text, travel, safety, do's/don'ts and packing are TEXT → printed
 *     on the page, so a parent never has to open a document to read them.
 */
function buildTabs(trip) {
  const hasComm = trip.coordinator || trip.coordinatorPhone || trip.coordinatorEmail || trip.emergency
  const docs = trip.documents || []
  const byCategory = (...names) => docs.filter((d) => names.includes(d.category))
  const tabs = []

  if (trip.overview || trip.batches?.length || trip.reminders.length || hasComm) {
    tabs.push({
      id: 'overview',
      label: 'Overview',
      icon: 'overview',
      render: () => <OverviewPanel trip={trip} hasComm={hasComm} />,
    })
  }

  // Photos are a tab of their own, named for what a parent is looking for.
  const albums = byCategory('Photos', 'Photos from last year')
  const media = trip.media || []
  if (albums.length || media.length) {
    tabs.push({
      id: 'photos',
      label: 'Photos',
      icon: 'photo',
      count: media.length || albums.length,
      render: () => <PhotosPanel albums={albums} media={media} />,
    })
  }

  const orientation = byCategory('Parent orientation', 'Student orientation')
  if (orientation.length) {
    tabs.push({
      id: 'orientation',
      label: 'Orientation',
      icon: 'resources',
      count: orientation.length,
      render: () => <CardsPanel groups={[
        { title: 'Parent orientation', icon: 'resources', docs: byCategory('Parent orientation') },
        { title: 'Student orientation', icon: 'slides', docs: byCategory('Student orientation') },
      ]} />,
    })
  }

  const itineraryDocs = byCategory('Itinerary')
  if (trip.itinerary.length || itineraryDocs.length) {
    tabs.push({
      id: 'itinerary',
      label: 'Itinerary',
      icon: 'itinerary',
      count: trip.itinerary.length || itineraryDocs.length,
      render: () => (
        <>
          {itineraryDocs.length > 0 && (
            <CardsPanel groups={[{ title: 'Day-wise itinerary', icon: 'itinerary', docs: itineraryDocs }]} />
          )}
          {trip.itinerary.length > 0 && <ItineraryPanel rows={trip.itinerary} />}
        </>
      ),
    })
  }

  if (trip.travel.length) {
    tabs.push({
      id: 'travel',
      label: 'Travel',
      icon: 'ticket',
      count: trip.travel.length,
      render: () => <TravelPanel legs={trip.travel} />,
    })
  }

  const guidelineCount =
    trip.safety.length + (trip.doDonts?.length || 0) + trip.dos.length + trip.donts.length + trip.carry.length
  const guidelineDocs = byCategory('Safety', "Do's and don'ts", 'Things to carry')
  if (guidelineCount || guidelineDocs.length) {
    tabs.push({
      id: 'guidelines',
      label: 'Guidelines',
      icon: 'safety',
      count: guidelineCount || guidelineDocs.length,
      render: () => <GuidelinesPanel trip={trip} docs={guidelineDocs} />,
    })
  }

  return tabs
}

/**
 * The Photos tab. Individual pictures when the sheet holds image URLs, and the
 * album links either way — a folder link is often all the school has, and it is
 * still the fastest route to the pictures.
 */
function PhotosPanel({ albums, media }) {
  return (
    <div className="sections">
      {media.length > 0 && (
        <Section icon="photo" title="Trip photos">
          <div className="photo-grid">
            {media.map((m, i) => (
              <PhotoTile key={`m${i}`} item={m} />
            ))}
          </div>
        </Section>
      )}

      {albums.length > 0 && (
        <Section icon="photo" title={media.length ? 'Full albums' : 'Photo albums'}>
          <DocGrid docs={albums} />
        </Section>
      )}
      <PendingNote docs={albums} />
    </div>
  )
}

/**
 * A photo that a parent's browser may not be able to load — a Drive image that
 * is not link-shared 403s. Falling back to a typed tile keeps the grid looking
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
      <span className="cap">{item.caption || (isVideo ? 'Video' : 'Photo')}</span>
    </a>
  )
}

/** A grid of document cards. */
function DocGrid({ docs }) {
  return (
    <div className="doc-grid">
      {docs.map((d, i) => (
        <DocCard key={`${d.url}-${d.label}-${i}`} label={d.label} url={d.url} category={d.category} pending={d.pending} />
      ))}
    </div>
  )
}

/**
 * One explanation per panel for cards the sheet named but did not link — not one
 * per section and certainly not one per card. Repeated, it reads as a broken
 * page; said once, it reads as "the school is still filling this in".
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

/** A titled block of document cards. */
function CardsPanel({ groups }) {
  const filled = groups.filter((g) => g.docs.length > 0)
  return (
    <div className="sections">
      {filled.map((g) => (
        <Section key={g.title} icon={g.icon} title={g.title}>
          <DocGrid docs={g.docs} />
        </Section>
      ))}
      <PendingNote docs={filled.flatMap((g) => g.docs)} />
    </div>
  )
}

function TripTabs({ trip, accent }) {
  const tabs = useMemo(() => buildTabs(trip), [trip])
  const [active, setActive] = useState(0)
  const btns = useRef([])

  if (tabs.length === 0) {
    return <EmptyState title="Nothing to show yet" message="The school has not added any details for this trip." />
  }

  // Left/right walk the tabs and move focus with the selection, which is what a
  // tablist is expected to do.
  const onKeyDown = (e) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const next = (active + step + tabs.length) % tabs.length
    setActive(next)
    btns.current[next]?.focus()
  }

  const current = tabs[active]

  return (
    <div className="trip-tabs">
      <div className="tabbar" role="tablist" aria-label="Trip details" onKeyDown={onKeyDown}>
        {tabs.map((t, i) => {
          const selected = i === active
          return (
            <button
              key={t.id}
              ref={(el) => { btns.current[i] = el }}
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              className={selected ? 'tab is-active' : 'tab'}
              style={selected ? { background: accent, borderColor: accent } : undefined}
              onClick={() => setActive(i)}
            >
              <Icon name={t.icon} stroke={selected ? '#fff' : 'currentColor'} />
              <span>{t.label}</span>
              {t.count > 0 && <span className="tab-count">{t.count}</span>}
            </button>
          )
        })}
      </div>

      <div
        className="tab-panel"
        role="tabpanel"
        id={`panel-${current.id}`}
        aria-labelledby={`tab-${current.id}`}
        tabIndex={-1}
        key={current.id}
      >
        {current.render()}
      </div>
    </div>
  )
}

function OverviewPanel({ trip, hasComm }) {
  return (
    <div className="sections">
      {trip.overview && (
        <Section icon="overview" title="Orientation overview">
          <p className="overview-text">{trip.overview}</p>
        </Section>
      )}

      {trip.batches?.length > 0 && (
        <Section
          icon="itinerary"
          title={trip.batchMatched ? 'Your batch' : 'Batches and sections'}
        >
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

      {hasComm && (
        <Section icon="comm" title="Communication">
          <div className="kv-grid">
            <div><span className="k">Trip coordinator</span>{trip.coordinator || '—'}</div>
            <div><span className="k">Phone</span>{trip.coordinatorPhone || '—'}</div>
            <div><span className="k">Email</span>{trip.coordinatorEmail || '—'}</div>
            <div><span className="k">Emergency contact</span>{trip.emergency || '—'}</div>
          </div>
        </Section>
      )}
    </div>
  )
}

function ItineraryPanel({ rows }) {
  return (
    <div className="sections">
      <Section icon="itinerary" title="Itinerary">
        <table className="itin-table">
          <thead>
            <tr><th>Day</th><th>Time</th><th>Activity</th><th>Location</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
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
    </div>
  )
}

/**
 * Guidelines are three things the school may write either way: as text in the
 * cell, or as a poster it links (or names) there. Each keeps its own section so
 * "Things to carry" is still findable under that name, whichever form it took.
 */
function GuidelinesPanel({ trip, docs = [] }) {
  const postersFor = (category) => docs.filter((d) => d.category === category)
  const blocks = [
    { icon: 'safety', title: 'Safety guidelines', lines: trip.safety, docs: postersFor('Safety') },
    { icon: 'dodont', title: "Do's and don'ts", lines: trip.doDonts || [], docs: postersFor("Do's and don'ts") },
    { icon: 'carry', title: 'Things to carry', lines: trip.carry, docs: postersFor('Things to carry'), check: true },
  ].filter((b) => b.lines.length || b.docs.length)

  return (
    <div className="sections">
      {blocks.map((b) => (
        <Section key={b.title} icon={b.icon} title={b.title}>
          {b.lines.length > 0 && (
            <ul className={b.check ? 'plain check-list' : 'plain'}>
              {b.lines.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          )}
          {b.docs.length > 0 && <DocGrid docs={b.docs} />}
        </Section>
      ))}

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
      <PendingNote docs={docs} />
    </div>
  )
}

function TravelPanel({ legs }) {
  return (
    <div className="sections">
      <Section icon="ticket" title="Travel details">
        {legs.map((leg, i) => {
          // The school writes travel as prose in one cell. Showing the empty
          // Train/Departure grid above it just adds a row of em dashes.
          const structured = leg.trainNo || leg.departure || leg.platform || leg.coachSeat

          return (
            <div key={i}>
              <h4 className="leg-title">{leg.leg}</h4>
              {structured && (
                <div className="kv-grid">
                  <div><span className="k">Train</span>{leg.trainNo || '—'}</div>
                  <div><span className="k">Departure</span>{leg.departure || '—'}</div>
                  {leg.platform && <div><span className="k">Platform</span>{leg.platform}</div>}
                  {leg.coachSeat && <div><span className="k">Coach / seat</span>{leg.coachSeat}</div>}
                </div>
              )}
              {leg.notes && <p className="ticket-notes">{leg.notes}</p>}
            </div>
          )
        })}
      </Section>
    </div>
  )
}

function DocumentsPanel({ docs }) {
  return (
    <div className="sections">
      <Section icon="resources" title="Documents">
        <div className="doc-grid">
          {docs.map((d, i) => (
            <DocCard key={`${d.url}-${i}`} label={d.label} url={d.url} category={d.category} pending={d.pending} />
          ))}
        </div>
      </Section>
    </div>
  )
}

