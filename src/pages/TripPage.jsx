import { useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useTrip } from '../data/useTrip'
import { gradeById, isComingSoon } from '../lib/grades'
import { tripPhotoFor } from '../lib/tripPhoto'
import { slidePreviewFor } from '../lib/slidePreviews'
import { Section } from '../components/Section'
import { DocCard } from '../components/DocCard'
import { GoogleSlidesPreview } from '../components/GoogleSlidesPreview'
import { Icon } from '../components/Icon'
import { Loading, ErrorState, EmptyState } from '../components/States'

export default function TripPage() {
  const { gradeId } = useParams()
  // No back link on this page: the top bar already carries "All grades" for
  // staff and "Switch child" / "My child" for a parent, and it names the grade
  // beside the account. The row that used to sit here was crossed out for
  // repeating both (2026-08-14).
  const { canAccessGrade, activeStudent } = useAuth()

  const allowed = canAccessGrade(gradeId)
  // Junior and middle school have no published trip, so there is nothing to
  // fetch — same rule as an unauthorised grade: don't ask for what cannot be
  // shown.
  const soon = isComingSoon(gradeId)
  // The child's section decides which batch's dates and travel apply. Staff
  // have no section and see every batch.
  const { status, trip, error, retry } = useTrip(gradeId, {
    enabled: allowed && !soon,
    section: activeStudent?.section || '',
  })
  const grade = gradeById(gradeId)
  const photo = tripPhotoFor(gradeId)

  const sections = useMemo(
    () => (trip ? buildSections(trip, photo, grade) : []),
    [trip, photo, grade]
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

  if (soon) {
    return (
      <EmptyState
        title="Coming soon"
        message={`The trip for ${grade.full} has not been announced yet. It will appear here as soon as the school publishes it.`}
      />
    )
  }

  return (
    <>
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
 * The sheet's "Header Text" column opens with a headline — "A Journey Beyond
 * the Classroom" — and then the paragraphs beneath it.
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

/**
 * Dates only — the "Batch 1:" prefix is stripped because the batch is already
 * named beside it in the same line.
 *
 * Stripped in the all-batches case too, not just the matched one: the sheet's
 * own headlines carry the prefix verbatim, and Grade 7 has it wrong on both rows
 * (see `batchLabels`), so staff were reading
 * "Batch 1: 12-19 December · Batch 1: 13-20 December". `batchLabels` corrects the
 * label but cannot rewrite the school's headline text.
 */
function heroDates(trip) {
  if (!trip) return ''
  const strip = (s) => String(s || '').replace(/^batch\s*\d+\s*[:–-]\s*/i, '').trim()
  if (trip.batchMatched && trip.batches?.length) return strip(trip.batches[0].headline)
  if (trip.batches?.length) {
    return trip.batches.map((b) => strip(b.headline)).filter(Boolean).join(' · ')
  }
  return trip.dates || ''
}

/**
 * Four tabs, in the order the school set out (2026-08-14), down from nine —
 * fewer tabs and shorter panels, because the ask was less page to scroll:
 *
 *   Home        the photograph, carrying the sheet's Header Text
 *   Itinerary   the day-by-day detail, and with it travel, do's and don'ts and
 *               things to carry — "all three things show on the one tab"
 *   Orientation the parent and student decks, each batch beside the other
 *   Safety      the safety guidelines
 *
 * Photos stays as a fifth tab when the sheet holds any, and Reminders as a
 * sixth when it holds coordinator details; neither is reachable from today's
 * sheet, and a tab with nothing behind it is never rendered — that rule is what
 * keeps a half-filled sheet reading as a finished page.
 *
 * Two kinds of content, kept apart on purpose (the school's instruction):
 *   - Orientation decks, photos and the itinerary link are FILES → cards that
 *     open the real thing.
 *   - Header text, travel, safety, do's/don'ts and packing are TEXT → printed
 *     on the page, so a parent never has to open a document to read them.
 */
function buildSections(trip, photo, grade) {
  const docs = trip.documents || []
  const byCategory = (...names) => docs.filter((d) => names.includes(d.category))
  const hasComm = trip.coordinator || trip.coordinatorPhone || trip.coordinatorEmail || trip.emergency
  const out = []

  if (trip.overview || photo) {
    out.push({
      id: 'home',
      label: 'Overview',
      node: <HomeSection key="home" trip={trip} photo={photo} grade={grade} />,
    })
  }

  /**
   * The three guideline columns, shown beside each other under the itinerary.
   *
   * Each column prefers the sheet's own **chip** — a preview card that opens the
   * school's poster — and only prints text when that column has no chip at all.
   * That order is the school's instruction (2026-08-14): "in sheet have links and
   * links have chips, show the chips … don't write according to you". The text
   * path stays as the fallback so a school that pastes real guidance into a cell
   * still gets it printed, per cell, with no code change.
   */
  const guidelineColumns = [
    {
      key: 'safety',
      title: 'Safety',
      tone: 'safety',
      icon: 'safety',
      docs: byCategory('Safety'),
      lines: trip.safety,
      slides: slidePreviewFor(grade.id, 'safety'),
    },
    {
      key: 'dodont',
      title: "Do's and don'ts",
      tone: 'rules',
      icon: 'dodont',
      docs: byCategory("Do's and don'ts"),
      lines: [...(trip.doDonts || []), ...trip.dos.map((t) => `Do: ${t}`), ...trip.donts.map((t) => `Don't: ${t}`)],
      slides: slidePreviewFor(grade.id, 'dodont'),
    },
  ].filter((c) => c.slides || c.docs.length || c.lines.length)

  // Packing left the Itinerary tab on 2026-08-17 ("things to carry new tab").
  // It is the longest of the three lists — 13 items against safety's 11 and four
  // rules — and sharing a row with them meant none of the three fitted. On its
  // own tab it gets the whole panel and Safety and Do's/Don'ts get half each.
  const carry = {
    docs: byCategory('Things to carry'),
    lines: trip.carry || [],
    slides: slidePreviewFor(grade.id, 'carry'),
  }

  const itineraryDocs = byCategory('Itinerary')
  if (trip.itinerary.length || trip.batches?.length || itineraryDocs.length || guidelineColumns.length) {
    out.push({
      id: 'itinerary',
      label: 'Itinerary',
      node: (
        <ItinerarySection
          key="itinerary"
          trip={trip}
          itineraryDocs={itineraryDocs}
          columns={guidelineColumns}
        />
      ),
    })
  }

  if (carry.slides || carry.docs.length || carry.lines.length) {
    out.push({
      id: 'carry',
      label: 'Things to carry',
      node: <CarrySection key="carry" docs={carry.docs} lines={carry.lines} slides={carry.slides} />,
    })
  }

  const orientationDocs = byCategory('Parent orientation', 'Student orientation')
  if (orientationDocs.length) {
    out.push({
      id: 'orientation',
      label: 'Orientation',
      node: <OrientationSection key="orientation" docs={orientationDocs} />,
    })
  }

  if (trip.travel.length) {
    out.push({
      id: 'travel',
      label: 'Travel',
      node: <TravelSection key="travel" legs={trip.travel} />,
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

  if (trip.reminders.length || hasComm) {
    out.push({
      id: 'reminders',
      label: 'Reminders',
      node: <RemindersSection key="reminders" trip={trip} hasComm={hasComm} />,
    })
  }

  return out
}

/**
 * The sections are tabs, not one long page: picking a tab swaps the panel and
 * the page does not move, so each part of the trip plan reads as its own screen.
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

      {/* `is-fill` marks the one panel that must stretch to the window instead of
          scrolling: Overview, which is a single photograph. Every other panel is a
          normal block scroller. This is a class rather than a `:has(#home)` rule
          because the flex/block distinction decides whether a tall panel can be
          scrolled at all, and getting it wrong silently hides content — Safety's
          last four measures were unreachable while `.sections` stayed flex. */}
      <div
        className={current.id === 'home' ? 'sections is-fill' : 'sections'}
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

/**
 * The Overview tab: **the photograph, and nothing but the photograph.** Grade,
 * batch, dates and the whole Header Text sit on top of it — the school's layout,
 * given 2026-08-14 as "overview have only images … header text, grade, batch,
 * date, only these things needed", with the old hero and fact bar crossed out.
 *
 * Everything is inside the image on purpose. A panel of body copy underneath is
 * what used to make this tab scroll, and the same instruction asked for no
 * scrollbar; the banner grows to the height available instead.
 *
 * The photo is not `loading="lazy"`: it is the first thing on the first tab, and
 * a lazy image never loads at all while the preview pane is hidden.
 */
function HomeSection({ trip, photo, grade }) {
  const [broken, setBroken] = useState(false)
  const { lead, body } = splitHeader(trip.overview)
  const showPhoto = photo && !broken
  const batch = heroBatch(trip)
  const dates = heroDates(trip)

  return (
    <Section id="home">
      <div className={showPhoto ? 'home-banner has-photo' : 'home-banner'}>
        {showPhoto && (
          <img
            className="home-photo"
            src={photo}
            alt={`${trip.title} — photograph from the school trip`}
            onError={() => setBroken(true)}
          />
        )}
        <div className="home-banner-text">
          <div className="home-meta">
            <span>{grade.full}</span>
            {batch && <span>{batch}</span>}
            {dates && <span>{dates}</span>}
          </div>
          <h3>{trip.title}</h3>
          {lead && <p className="home-lead">{lead}</p>}
          {body && <p className="home-body-text">{body}</p>}
        </div>
      </div>
    </Section>
  )
}

/**
 * "Batch 1" -> "B1", the school's own shorthand from their sketch of this page.
 * An unrecognised label is passed through rather than mangled.
 */
function shortBatch(label) {
  const m = String(label || '').match(/batch\s*(\d+)/i)
  return m ? `B${m[1]}` : label || ''
}

/**
 * Parent and student decks, one row per kind with the batches beside each other
 * — the school drew this as `Parent Orientation [B1] [B2]`.
 *
 * The card's label is the chip's own name as the sheet has it ("G7 B1 …
 * Parent's Orientation"), which is what they asked for: it names the grade,
 * batch and destination better than any label built here could.
 */
function OrientationSection({ docs }) {
  const groups = ['Parent orientation', 'Student orientation']
    .map((category) => ({ category, items: docs.filter((d) => d.category === category) }))
    .filter((g) => g.items.length)

  return (
    <Section id="orientation" eyebrow="Before the trip" title="Orientation">
      {groups.map((g) => (
        <div className="orient-group" key={g.category}>
          <h4>{g.category}</h4>
          <div className="orient-row">
            {g.items.map((d, i) => (
              <DocCard key={`${d.label}-${i}`} {...d} batchTag={shortBatch(d.batch)} compact hideMeta />
            ))}
          </div>
        </div>
      ))}
      <PendingNote docs={docs} />
    </Section>
  )
}

/**
 * Itinerary first, then Safety, Do's and don'ts and Things to carry **beside
 * each other** underneath it — the school's layout, 2026-08-14.
 *
 * Each of those three is the sheet's own chip, shown as a preview card that
 * opens the school's poster. Nothing is written on their behalf: a column falls
 * back to printed text only when it has no chip, which is what keeps a
 * half-converted sheet working either way.
 *
 * The batch/sections block sits above, because "which batch am I in" is what a
 * parent checks the itinerary for.
 */
/**
 * The Do/Don't column is one list in the sheet, with each line marked `Do:` or
 * `Don't:` — the only thing telling the two sides apart in a single column. The
 * prefix picks the tick or the cross and is then dropped, because repeating
 * "Don't:" beside a cross is noise.
 *
 * A line with no prefix keeps its full text and gets the column's own marker, so
 * a school that just types sentences is still rendered correctly.
 */
export function splitRule(raw) {
  const text = String(raw || '').trim()
  const m = text.match(/^(do|don'?t|dont)\s*[:–-]\s*(.+)$/is)
  if (!m) return { kind: '', text }
  return { kind: m[1].toLowerCase() === 'do' ? 'do' : 'dont', text: m[2].trim() }
}

/**
 * The do's and don'ts as a **vertical stack of cards**, one per rule, grouped
 * with a DO / DON'T label above each side — the school's own poster layout,
 * asked for on 2026-08-17.
 *
 * The label only appears where the side changes, so a sheet that prefixes only
 * some of its lines still reads correctly, and an unprefixed list gets no labels
 * at all rather than a heading it did not earn.
 */
function RuleStack({ lines }) {
  const rules = lines.map(splitRule)

  return (
    <div className="rule-stack">
      {rules.map((r, i) => (
        <div key={i}>
          {r.kind && r.kind !== rules[i - 1]?.kind && (
            <span className={`rule-side is-${r.kind}`}>
              <Icon name={r.kind === 'do' ? 'dodont' : 'close'} stroke="currentColor" />
              {r.kind === 'do' ? 'Do' : "Don't"}
            </span>
          )}
          <div className={r.kind ? `rule-card is-${r.kind}` : 'rule-card'}>
            <span className="chip-mark">
              <Icon name={r.kind === 'dont' ? 'close' : 'dodont'} stroke="currentColor" />
            </span>
            <span>{r.text}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Things to carry, on its own tab since 2026-08-17. The whole panel is one
 * checklist — the longest of the three guideline lists, and the one a parent
 * reads standing over a suitcase, so it gets the width rather than a third of a
 * row. It flows into columns so all thirteen items fit on screen at once.
 */
function CarrySection({ docs, lines, slides }) {
  return (
    <Section id="carry" className="is-stretch">
      <div className={slides ? 'chip-col is-carry carry-card has-slides' : 'chip-col is-carry carry-card'}>
        <div className="chip-head">
          <span className="chip-icon"><Icon name="carry" stroke="currentColor" /></span>
          <h4>Things to carry</h4>
          {!slides && <span className="chip-count">{docs.length || lines.length}</span>}
        </div>
        {slides ? (
          <div className="chip-slides">
            <GoogleSlidesPreview title="Things to carry" url={slides} />
          </div>
        ) : docs.length > 0 ? (
          <div className="chip-docs">
            {docs.map((d, i) => <DocCard key={`carry-${i}`} {...d} hideMeta eager />)}
          </div>
        ) : (
          <ul className="plain chip-lines carry-list">
            {lines.map((t, i) => (
              <li key={i}>
                <span className="chip-mark">{i + 1}</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {!slides && <PendingNote docs={docs} />}
    </Section>
  )
}

function ItinerarySection({ trip, itineraryDocs, columns }) {
  // No section heading: the tab is already labelled "Itinerary", and the 86px it
  // cost was the difference between this tab fitting the window and scrolling.
  // The column headings below carry the meaning that matters here.
  return (
    <Section id="itinerary" className={columns.length ? 'is-stretch' : undefined}>
      {/* The batch block and the itinerary card sit BESIDE each other. Stacked
          they cost 306px of a 541px panel and left the three guideline columns
          217px — the "preview" the school photographed. Side by side they cost
          162 and hand the rest to the columns. */}
      {(trip.batches?.length > 0 || itineraryDocs.length > 0) && (
      <div className="itin-top">
      {trip.batches?.length > 0 && (
        <div className="panel is-tight">
          {trip.batchMatched && trip.batchCount > 1 && (
            <p className="batch-note">
              Showing the batch for section <strong>{trip.section}</strong>. Other batches travel on
              different dates.
            </p>
          )}
          {/* Batches sit beside each other rather than stacked. Staff see every
              batch, and two stacked rows cost ~96px that the guideline columns
              below need more than this block does. */}
          <div className="batch-grid">
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
        </div>
      )}

      {itineraryDocs.length > 0 && (
        <div className="orient-row itin-docs">
          {itineraryDocs.map((d, i) => <DocCard key={`itin-${i}`} {...d} compact />)}
        </div>
      )}
      </div>
      )}

      {trip.itinerary.length > 0 && (
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
      )}

      {columns.length > 0 && (
        <div className="chip-row">
          {columns.map((c) => (
            <div className={`chip-col is-${c.tone}`} key={c.key}>
              <div className="chip-head">
                <span className="chip-icon"><Icon name={c.icon} stroke="currentColor" /></span>
                <h4>{c.title}</h4>
                {!c.slides && <span className="chip-count">{c.docs.length || c.lines.length}</span>}
              </div>
              {/* The live deck wins over everything else. It IS the school's
                  document, so a card linking to the same document beside it, or a
                  transcription of it below, would both be noise. */}
              {c.slides ? (
                <div className="chip-slides">
                  <GoogleSlidesPreview title={c.title} url={c.slides} />
                </div>
              ) : c.docs.length > 0 ? (
                <div className="chip-docs">
                  {c.docs.map((d, i) => <DocCard key={`${c.key}-${i}`} {...d} hideMeta eager />)}
                </div>
              ) : c.key === 'dodont' ? (
                <RuleStack lines={c.lines} />
              ) : (
                <ul className="plain chip-lines">
                  {c.lines.map((t, i) => (
                    <li key={i}>
                      <span className="chip-mark">{i + 1}</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      <PendingNote docs={[...itineraryDocs, ...columns.flatMap((c) => c.docs)]} />
    </Section>
  )
}

/**
 * Travel is its own tab again (2026-08-14, "tavel tab show"). It had been folded
 * into Itinerary earlier the same day; the school wants it back on its own,
 * which also keeps the Itinerary tab short enough not to scroll.
 */
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
 * One explanation per panel for cards the sheet named but did not link — not
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
