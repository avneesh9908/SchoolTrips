import { useState, useMemo, useEffect, useRef, Fragment } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { TRIP_LAYOUT } from '../lib/layout'
import { useAuth } from '../auth/AuthContext'
import { useTrip } from '../data/useTrip'
import { gradeById, isComingSoon } from '../lib/grades'
import { tripPhotoFor, tripCardPhotoFor, imageUrl } from '../lib/tripPhoto'
import { useDestinationPhoto } from '../data/useDestinationPhoto'
import { config } from '../config'
import { describeDoc } from '../lib/docPreview'
import { LiveList } from '../components/LiveList'
import { slidePreviewFor } from '../lib/slidePreviews'
import { Section } from '../components/Section'
import { DocCard } from '../components/DocCard'
import { GoogleSlidesPreview, SlidesOpenLink } from '../components/GoogleSlidesPreview'
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
  // Every batch is shown to everyone (2026-08-19): students change batch during
  // the term, so narrowing the page to the batch the sheet lists their section
  // against would go stale. The section is still passed so the data layer can warn
  // when the sheet lists no batch for it — it no longer filters anything.
  /**
   * Which of the grade's trips is being read, taken from the URL rather than
   * state: `/trip/g11/t/2` is a real address, so Back leaves a trip for the
   * picker instead of the child list, and a parent can bookmark the one their
   * child is on.
   *
   * Absent on `/trip/:gradeId`, which is the picker's own address. A junk or
   * out-of-range segment is treated as absent, so a stale bookmark lands on the
   * picker rather than silently showing trip 0 under a URL claiming trip 9.
   */
  const { tripIndex: tripParam } = useParams()
  const pickedTrip = /^\d+$/.test(tripParam || '') ? Number(tripParam) : null
  const { status, trip, error, retry } = useTrip(gradeId, {
    enabled: allowed && !soon,
    section: activeStudent?.section || '',
    // tripOptions is the same whichever trip is assembled, so the picker can be
    // drawn from a load of the first one.
    tripIndex: pickedTrip ?? 0,
  })
  const grade = gradeById(gradeId)
  // Per trip, not per grade: Grade 11's four trips go to four different places,
  // so one photograph for the grade would be wrong on three of the pages.
  const photo = tripPhotoFor(gradeId, trip?.title || '')

  const sections = useMemo(
    () => (trip ? buildSections(trip, photo, grade) : []),
    [trip, photo, grade]
  )

  // The tab a parent picked, held by id rather than index: the list is built
  // from the data, so a different grade can have a different set of tabs and a
  // remembered index would land on the wrong one.
  const [chosen, setChosen] = useState('')
  const active = sections.some((s) => s.id === chosen) ? chosen : sections[0]?.id || ''

  /**
   * Show the picker only when there is a real choice to make and none has been
   * made. A grade with ONE trip goes straight to it: an extra page carrying a
   * single card is a click that tells a parent nothing.
   *
   * An out-of-range index counts as no choice, so `/trip/g11/t/9` offers the
   * picker instead of quietly rendering trip 0.
   */
  const count = trip?.tripOptions?.length || 0
  const needsPick = count > 1 && (pickedTrip === null || pickedTrip >= count)

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

      {/* More than one trip and none chosen yet: the picker is the whole page. It
          is not shown alongside a trip, because a grade with four trips had four
          switch buttons stacked above every tab bar. */}
      {status === 'ready' && trip && needsPick && (
        <TripSelect grade={grade} options={trip.tripOptions} gradeId={gradeId} />
      )}

      {status === 'ready' && trip && !needsPick && (
        <>
          {trip.tripOptions.length > 1 && (
            <Link className="trip-back" to={`/trip/${gradeId}`}>← Choose another trip</Link>
          )}
          <TripBody sections={sections} active={active} onSelect={setChosen} />
        </>
      )}
    </>
  )
}

/**
 * The trip picker — its own page between the grade and the trip, for a grade
 * that travels on several (the school, 2026-08-21: "show extra page after the
 * grade to selected the trip when more then one trip").
 *
 * It replaced an inline row of switch buttons above the tab bar. Grade 11 has
 * FOUR trips, and four buttons stacked over every tab of every trip is a
 * permanent band of navigation on a page whose job is to be read.
 *
 * Deliberately reuses the grade picker's own `card-grid` / `pick-card` classes so
 * the step reads as the same kind of choice a parent has just made, rather than a
 * new interface. **No photograph, unlike the grade cards:** `tripCardPhotoFor` is
 * keyed by grade, so every card here would carry the same image and the picture
 * would say nothing about which trip it is. The gradient and the grade's glyph
 * stand in, and the destination is named on the media itself exactly as it is
 * over there.
 */
function TripSelect({ grade, options, gradeId }) {
  const navigate = useNavigate()
  return (
    <>
      <div className="dash-head">
        <div>
          <div className="crumbs">
            <span>School Trips</span><span>/</span>
            <Link to="/children" className="crumb-link">Grades</Link><span>/</span>
            <span className="here">{grade.full}</span>
          </div>
          <h2>Choose a trip</h2>
          <p className="lede">
            {grade.full} travels on {options.length} trips. Open the one your child is going on —
            each has its own dates, travel details and things to carry.
          </p>
        </div>
      </div>

      <div className="card-grid">
        {options.map((o) => (
          <TripSelectCard
            key={o.index}
            grade={grade}
            option={o}
            onOpen={() => navigate(`/trip/${gradeId}/t/${o.index}`)}
          />
        ))}
      </div>
    </>
  )
}

/**
 * One trip's card on the picker.
 *
 * Its photograph is resolved PER TRIP, not per grade: Grade 11's four trips go
 * to four different places, so the grade's single `tripPhotos` entry would put
 * one picture on all four cards and be wrong for three. `tripCardPhotoFor` takes
 * the destination and looks for a `"<gradeId>.<slug>"` key first.
 *
 * With no photograph of the school's own, a credited stand-in is looked up for
 * the destination — which resolves for a Jaipur or a Manali and, correctly, not
 * for Grade 11's local campsites, whose cards keep the grade's colour.
 */
function TripSelectCard({ grade, option, onOpen }) {
  const photo = tripCardPhotoFor(grade.id, option.title)
  const [broken, setBroken] = useState(false)
  const showPhoto = photo && !broken
  const found = useDestinationPhoto(option.title, !photo)
  const [standInBroken, setStandInBroken] = useState(false)
  const showStandIn = !showPhoto && found && !standInBroken

  return (
    <button className="pick-card" onClick={onOpen}>
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
        {option.name && <span className="pick-code">{option.name}</span>}
        {!showPhoto && !showStandIn && (
          <span className="glyph"><Icon name={grade.icon} stroke="currentColor" /></span>
        )}
        <span className="pick-label">{option.title}</span>
        {showStandIn && <span className="pick-credit">area photo · Wikipedia</span>}
      </span>
      <span className="pick-body">
        <span className="pick-name">
          <span className="n">{option.dates || grade.full}</span>
        </span>
        <span className="pick-cta">
          {option.batchCount > 1
            ? `${option.batchCount} batches · View trip details →`
            : 'View trip details →'}
        </span>
      </span>
    </button>
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

/**
 * The school's boilerplate "read the rest of this page" sentence, dropped from
 * the Overview on the school's instruction (2026-08-21).
 *
 * It is CONTENT, and content belongs in the sheet — this is a stopgap, not the
 * fix. It sits here because the sentence is pasted into the Header Text cell of
 * six separate grade rows, so removing it properly means six edits in the
 * school's spreadsheet, and until those are made this is the only way to take
 * it off the page. **Delete this filter once the cells are clean**: an app that
 * quietly rewrites what staff typed is exactly the thing this codebase avoids
 * everywhere else.
 *
 * Deliberately narrow. It matches only this one sentence, anchored to its own
 * paragraph, so a reworded intro is left alone rather than half-eaten — if the
 * school changes the wording the sentence reappears, which is the honest
 * failure and a visible prompt to fix the sheet instead.
 */
const BOILERPLATE =
  /(^|\n)\s*Please go through the details below for the upcoming trip[^\n]*\.?\s*(?=\n|$)/gi

export function stripBoilerplate(raw) {
  return String(raw || '').replace(BOILERPLATE, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function splitHeader(raw) {
  const text = stripBoilerplate(raw)
  if (!text) return { lead: '', body: '' }
  const [first, ...others] = text.split('\n')
  const lead = first.trim()
  if (!lead || lead.length > LEAD_MAX) return { lead: '', body: text }
  return { lead, body: others.join('\n').trim() }
}

/**
 * "Batch 1: 12-19 December" -> "12-19 December". The batch is already named on the
 * card that carries the line, so repeating the prefix inside it is noise — and the
 * sheet has it wrong on both Grade 7 rows (see `batchLabels`), which is how staff
 * came to read "Batch 1: 12-19 December · Batch 1: 13-20 December". `batchLabels`
 * corrects the label but cannot rewrite the school's headline text.
 */
function stripBatchPrefix(s) {
  return String(s || '').replace(/^batch\s*\d+\s*[:–-]\s*/i, '').trim()
}

/**
 * The sections, in the order the school set on 2026-08-17 — the order a parent
 * reads them in, not the order the sheet's columns happen to be in:
 *
 *   Overview        the photograph, then the batch dates, then the Header Text
 *   Orientation     the parent and student decks — what a parent does FIRST
 *   Itinerary       the batch, the day plan, and Safety and Do's/Don'ts beside it
 *   Travel details  a card per batch
 *   Things to carry the packing deck or list — last thing before the trip
 *   Photos          only when the sheet holds photos or album folders
 *   Reminders       only when it holds coordinator details
 *
 * This list is the single source of the order: the jump nav, the block order on the
 * one-page layout and the tab order in the tabbed ones all read it. **To reorder the
 * page, move a `push` in this function and nothing else.**
 *
 * A section with nothing behind it is never rendered, which is what keeps a
 * half-filled sheet reading as a finished page rather than a row of empty shelves.
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

  if (stripBoilerplate(trip.overview) || photo) {
    out.push({
      id: 'home',
      label: 'Overview',
      node: <HomeSection key="home" trip={trip} photo={photo} />,
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

  // Packing left the Itinerary section on 2026-08-17 ("things to carry new tab").
  // It is the longest of the three lists — 13 items against safety's 11 and four
  // rules — and sharing a row with them meant none of the three fitted. On its own it
  // gets the full width and Safety and Do's/Don'ts get half each. It sits after Travel
  // in the order the school set later the same day, so the guideline decks are no
  // longer adjacent — that is deliberate, not a leftover.
  const carry = {
    docs: byCategory('Things to carry'),
    lines: trip.carry || [],
    slides: slidePreviewFor(grade.id, 'carry'),
  }

  const orientationDocs = byCategory('Parent orientation', 'Student orientation')
  if (orientationDocs.length) {
    out.push({
      id: 'orientation',
      label: 'Orientation',
      titled: true,
      node: <OrientationSection key="orientation" docs={orientationDocs} />,
    })
  }

  const itineraryDocs = byCategory('Itinerary')
  // `trip.batches` is deliberately NOT a reason to open this tab any more: the batch
  // dates are on Overview since 2026-08-18, so a sheet with batches and nothing else
  // would have opened an Itinerary tab with nothing in it.
  if (trip.itinerary.length || itineraryDocs.length || guidelineColumns.length) {
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

  /**
   * The student list, immediately after Itinerary — the school's placement, 2026-08-19.
   *
   * One link per batch, so it reuses `ItineraryCards`: the same filled card with the batch's
   * dates and sections, which is exactly what a reader needs to pick the right list. The
   * component takes its wording from `kind`/`action` rather than hard-coding "Itinerary".
   *
   * The tab is absent until the sheet has the column — `byCategory` returns nothing, the
   * `if` fails, and no empty tab is published. That is the same rule every other tab follows.
   */
  const studentListDocs = byCategory('Student list')
  if (studentListDocs.length) {
    out.push({
      id: 'students',
      label: 'Student list',
      node: (
        <Section id="students" key="students">
          <ItineraryCards
            docs={studentListDocs}
            batches={trip.batches || []}
            kind="Student list"
            action="Open the student list"
            live
          />
        </Section>
      ),
    })
  }

  if (trip.travel.length) {
    out.push({
      id: 'travel',
      // "Travel details", matching the heading the section renders and the name the
      // school uses for it; the older short "Travel" said one thing in the nav and
      // another over the cards.
      label: 'Travel details',
      titled: true,
      node: <TravelSection key="travel" legs={trip.travel} />,
    })
  }

  if (carry.slides || carry.docs.length || carry.lines.length) {
    out.push({
      id: 'carry',
      label: 'Things to carry',
      node: <CarrySection key="carry" docs={carry.docs} lines={carry.lines} slides={carry.slides} />,
    })
  }

  const albums = byCategory('Photos', 'Photos from last year')
  const media = trip.media || []
  if (albums.length || media.length) {
    out.push({
      id: 'photos',
      label: 'Photos',
      titled: true,
      node: (
        <PhotosSection key="photos" albums={albums} media={media} title={trip.title} photo={photo} />
      ),
    })
  }

  if (trip.reminders.length || hasComm) {
    out.push({
      id: 'reminders',
      label: 'Reminders',
      titled: true,
      node: <RemindersSection key="reminders" trip={trip} hasComm={hasComm} />,
    })
  }

  return out
}

/**
 * The one-page layout: every section stacked, the window scrolling, and the tab
 * strip demoted to a **jump nav** — anchor links, not tabs, because with all the
 * content present there is nothing to switch between, only somewhere to go.
 *
 * Deliberately no scroll-spy. `useActiveSection` was deleted on 2026-08-13 and
 * this does not bring it back: a listener that repaints the nav on every scroll
 * frame was the reason it went, and `:target` plus a real anchor gets a reader
 * where they asked to go without one.
 *
 * `scroll-margin-top` on each section (CSS) is what stops the sticky header from
 * covering the heading a reader just jumped to.
 */
function TripFlow({ sections }) {
  return (
    <>
      <nav className="secnav">
        <div className="secnav-inner" aria-label="Jump to a section">
          {sections.map((s) => (
            <a key={s.id} href={`#sec-${s.id}`}>{s.label}</a>
          ))}
        </div>
      </nav>

      <div className="sections is-flow">
        {sections.map((s) => (
          <div className="flow-block" id={`sec-${s.id}`} key={s.id}>
            {/* Only for the sections that carry no heading of their own. Orientation,
                Travel, Photos and Reminders each render a `Section` head already, and
                printing the label above it read "Orientation / Before the trip /
                Orientation" — the same word twice with 40px of nothing between. */}
            {!s.titled && <h3 className="flow-title">{s.label}</h3>}
            {s.node}
          </div>
        ))}
      </div>
    </>
  )
}

/**
 * Arrow keys move between tabs, which is what a tablist is expected to do.
 * Shared by both tab layouts — the stage and the older strip differ in how they
 * look, not in how they behave.
 *
 * Focus must not scroll the page, but the strip itself has to follow, or the
 * selected tab can end up off the right edge of a phone with nothing on screen
 * looking selected.
 */
function tabKeys(sections, current, onSelect) {
  return (e) => {
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
}

/**
 * Scrolls smoothly unless the reader has asked for no motion.
 */
function smoothScrollTo(top) {
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: Math.max(0, top), behavior: still ? 'auto' : 'smooth' })
}

/**
 * Puts the top of a block just under whichever bars will still be on screen once the
 * scroll finishes. On a phone `.topbar` is `static` in this layout, so it scrolls away
 * and must NOT be subtracted; on a desktop it is sticky and must be. Reading the
 * computed position is the only honest way to know which — and `--header-h` would be
 * wrong either way, since the bar wraps to 165px on a phone against the token's 66.
 */
function scrollToBlock(el) {
  if (!el) return
  const nav = document.querySelector('.stage-nav')
  const header = document.querySelector('.topbar')
  const overlays = (node) => node && getComputedStyle(node).position !== 'static'
  const bars =
    (overlays(header) ? header.getBoundingClientRect().height : 0) + (nav ? nav.offsetHeight : 0)
  smoothScrollTo(el.getBoundingClientRect().top + window.scrollY - bars)
}

/**
 * The section nav, in both of its shapes and both of its modes.
 *
 * SHAPES — a row of pills on a wide window, a **menu** on a phone. Asked for on
 * 2026-08-17 ("in phone view tabs like menu make responsive"): at 375px the pill
 * strip held 652px of sections in 373px of window, so four of the six sat off the
 * right edge behind a scroller whose scrollbar is hidden, with nothing on screen
 * saying they were there. Both shapes are rendered and CSS picks one — a JS
 * breakpoint would need a resize listener and would render the wrong one on first
 * paint — and whichever is hidden is `display: none`, so it leaves the
 * accessibility tree with it.
 *
 * MODES — pass `current` for TABS (the `stage-tabs` / `stage-fit` layouts) or omit
 * it for the one-page JUMP nav. They differ in three ways and share everything
 * else, which is the reason this is one component: the phone menu was written for
 * the jump nav first, and leaving the tabbed layouts on the bare scroller would
 * have reintroduced the exact problem the school reported.
 *
 *   - tabs use buttons and carry the `tablist` roles, arrow keys and roving
 *     `tabIndex`; the jump nav uses real anchors, so a pasted `#sec-travel` works;
 *   - the menu's trigger names the CURRENT tab, because in a tablist one section is
 *     showing and the reader needs to know which. In the jump nav nothing is
 *     current — every section is on the page — so it just says "Sections";
 *   - only the tab strip marks a selection. Deliberately no scroll-spy in the jump
 *     nav: `useActiveSection` was deleted on 2026-08-13 and a listener repainting
 *     the nav every frame is not worth a highlight.
 */
function StageNav({ sections, current, onSelect, onJump }) {
  const [open, setOpen] = useState(false)
  const tabs = !!current

  // Escape and a tap outside — the two things a menu is expected to do. Both
  // listeners exist only while it is open.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    const onDown = (e) => { if (!e.target.closest('.stage-menu')) setOpen(false) }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  const choose = (s) => {
    onSelect(s.id)
    setOpen(false)
  }

  return (
    <nav className="stage-nav">
      {tabs ? (
        <div
          className="stage-nav-inner"
          role="tablist"
          aria-label="Trip sections"
          onKeyDown={tabKeys(sections, current, onSelect)}
        >
          {sections.map((s) => (
            <button
              key={s.id}
              id={`tab-${s.id}`}
              role="tab"
              aria-selected={s.id === current.id}
              aria-controls={`panel-${s.id}`}
              tabIndex={s.id === current.id ? 0 : -1}
              className={s.id === current.id ? 'stage-tab is-active' : 'stage-tab'}
              onClick={() => onSelect(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="stage-nav-inner" aria-label="Jump to a section">
          {sections.map((s) => (
            <a
              key={s.id}
              className="stage-tab"
              href={`#sec-${s.id}`}
              onClick={(e) => { onJump(e, s.id); setOpen(false) }}
            >
              {s.label}
            </a>
          ))}
        </div>
      )}

      <div className="stage-menu">
        <button
          type="button"
          className="stage-menu-btn"
          aria-expanded={open}
          aria-controls="stage-menu-list"
          onClick={() => setOpen((v) => !v)}
        >
          <Icon name="menu" stroke="currentColor" />
          <span className="t">{tabs ? current.label : 'Sections'}</span>
          {/* The chevron turns over when the list opens. It has a wrapper so the CSS
              can hook `.chev` rather than `svg:last-child`, which would silently move
              to whatever element is added after it next. */}
          <span className="chev"><Icon name="chevron" stroke="currentColor" /></span>
        </button>

        {/* Mounted only when open: there is nothing to animate, and a hidden list that
            still answers a tap through the page above it is worse than no list.
            The items are plain buttons or links — the `tab` roles stay on the strip
            alone, so the two shapes never both claim to be the tablist. */}
        {open && (
          <div className="stage-menu-list" id="stage-menu-list">
            {sections.map((s) =>
              tabs ? (
                <button
                  key={s.id}
                  type="button"
                  className={s.id === current.id ? 'is-current' : undefined}
                  aria-current={s.id === current.id ? 'true' : undefined}
                  onClick={() => choose(s)}
                >
                  {s.label}
                </button>
              ) : (
                <a
                  key={s.id}
                  href={`#sec-${s.id}`}
                  onClick={(e) => { onJump(e, s.id); setOpen(false) }}
                >
                  {s.label}
                </a>
              )
            )}
          </div>
        )}
      </div>
    </nav>
  )
}

/**
 * ONE page: the photograph as a full-bleed cover, then every section stacked beneath
 * it in the centred column, and the pill bar demoted to a jump nav.
 *
 * Asked for on 2026-08-17 — "remove tabs like different page make single page with
 * header" — which is the fourth answer the school has given to the same question in a
 * day (tabs → one page → tabs → one page). The tab layouts are still there behind
 * `TRIP_LAYOUT`; nothing was deleted to build this.
 *
 * The nav's links are real anchors, so a pasted `#sec-travel` works and the hash is
 * shareable; the click handler exists only to scroll smoothly and to clear the sticky
 * bars, which `scroll-margin-top` alone cannot do reliably here because the header's
 * height depends on how far the parent's name wraps.
 *
 * Deliberately **no scroll-spy**, exactly as `TripFlow` has none: `useActiveSection`
 * was deleted on 2026-08-13 and a listener that repaints the nav on every scroll frame
 * is not worth a highlight. The nav says where you can go, not where you are.
 */
function TripStagePage({ sections }) {
  const jump = (e, id) => {
    const el = document.getElementById(`sec-${id}`)
    if (!el) return
    e.preventDefault()
    scrollToBlock(el)
    // The hash still changes, so the address bar and the back button behave as they
    // would for a plain anchor.
    history.replaceState(null, '', `#sec-${id}`)
  }

  return (
    <>
      <StageNav sections={sections} onJump={jump} />

      <div className="stage-page">
        {sections.map((s) => {
          // Overview is the cover: it bleeds to both edges, carries the school's words
          // on the photograph, and takes no heading — the picture is the heading.
          const cover = s.id === 'home'
          return (
            <div
              className={cover ? 'stage-block is-cover' : 'stage-block'}
              id={`sec-${s.id}`}
              key={s.id}
            >
              {/* Only for the sections that carry no head of their own. Orientation,
                  Travel, Photos and Reminders each render a `Section` head already, and
                  printing the label above it read "Orientation / Before the trip /
                  Orientation" — the same word twice. Any new section that renders its
                  own head needs `titled: true` in `buildSections`. */}
              {!cover && !s.titled && <h3 className="stage-block-title">{s.label}</h3>}
              {s.node}
            </div>
          )
        })}
      </div>
    </>
  )
}

/**
 * Puts the top of the panel just under the sticky header and tab bar, so a tab
 * switch starts the new section at its beginning however far down the last one the
 * reader had gone.
 *
 * Asked for on 2026-08-17: "after the tab click switch scroll the web page". It
 * **reverses the 2026-08-13 rule** that clicking a tab must never move the page —
 * that rule existed because the page was one long scroll with a spy on it, and a
 * tab click that jumped felt like losing your place. Now each tab is its own screen
 * and the page only scrolls within one, so landing at the top of it is the point.
 *
 * Only the `'stage'` layout calls this. `'stage-fit'` and `'fixed'` cannot scroll
 * the window at all, and `'flow'` uses real anchors.
 */
function scrollToPanel() {
  const panel = document.querySelector('.stage')
  const nav = document.querySelector('.stage-nav')
  if (!panel || !nav) return
  // Both bars are MEASURED, not read from `--header-h`. That token is 66 while the
  // bar's own rect is 67, which is only a pixel — but on a phone the bar wraps to
  // three rows and stands at ~176, and subtracting 66 there would scroll the panel's
  // first heading up underneath it. `.topbar` is sticky at `top: 0`, so its bottom is
  // its height wherever the page happens to be.
  const header = document.querySelector('.topbar')
  const bars = (header ? header.getBoundingClientRect().height : 0) + nav.offsetHeight
  // rect.top + scrollY is the panel's position in the document.
  smoothScrollTo(panel.getBoundingClientRect().top + window.scrollY - bars)
}

/**
 * The stage: one section at a time, centred on a canvas, each tab at least a
 * screenful. The school's brief on 2026-08-17 was "redesign whole page, centre all
 * things, change font, change style, cover whole page, fit on screen", and then
 * "same page scrollable make after the tab click switch scroll the web page" — so
 * the design stayed and the window was let go: a tab with more than a screenful of
 * content grows the page instead of scrolling inside its own panel.
 *
 * Two things make it a redesign rather than a restyle of the old tab view:
 *   - the tab strip is a **centred segmented control** floating on the canvas,
 *     not a left-aligned underline row, so the page has one axis and everything
 *     sits on it;
 *   - **Overview covers the window** — the photograph bleeds past the page gutter
 *     to all four edges with the school's words centred on it, instead of being a
 *     rounded card inside the column.
 *
 * The section is centred with `margin-block: auto` rather than
 * `justify-content: center`. Auto margins collapse to zero when the free space is
 * negative, so a section taller than the window starts at its top and reads
 * downwards instead of being centred with both ends out of reach.
 */
function TripStage({ sections, current, onSelect }) {
  const cover = current.id === 'home'
  // Itinerary covers the page too, in the other sense: not a photograph bleeding to
  // the edges but the boxes themselves taking the whole window instead of a 1400px
  // column with canvas down both sides (2026-08-18). Its content is four boxes and
  // two cards — the wider they are, the fewer lines each one wraps to.
  const wide = current.id === 'itinerary'
  // Switching a tab also puts the reader at the top of it — see `scrollToPanel`.
  // Wrapped here rather than inside `onSelect` because the other two tab layouts
  // share that callback and neither of them may move the window.
  const select = (id) => {
    onSelect(id)
    if (TRIP_LAYOUT === 'stage-tabs') scrollToPanel()
  }

  return (
    <>
      <StageNav sections={sections} current={current} onSelect={select} />

      {/* `is-cover` is the one section that is not a centred card but the whole
          window: it drops the column's width cap and the page gutter so the
          photograph reaches every edge. Keyed on the tab id so the fade replays
          on each switch. */}
      <div
        className={cover ? 'stage is-cover' : wide ? 'stage is-wide' : 'stage'}
        key={current.id}
        id={`panel-${current.id}`}
        role="tabpanel"
        aria-labelledby={`tab-${current.id}`}
        tabIndex={-1}
      >
        <div className="stage-inner">{current.node}</div>
      </div>
    </>
  )
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

  // The two one-page layouts take no tab state at all.
  if (TRIP_LAYOUT === 'stage') return <TripStagePage sections={sections} />
  if (TRIP_LAYOUT === 'flow') return <TripFlow sections={sections} />

  const current = sections.find((s) => s.id === active) || sections[0]

  // Both tabbed stage variants render the same markup — `App` puts `is-scroll` or
  // `is-fit` on the route and the CSS decides whether the page may grow. Only the
  // scrolling one moves the window on a tab switch.
  if (TRIP_LAYOUT === 'stage-tabs' || TRIP_LAYOUT === 'stage-fit') {
    return <TripStage sections={sections} current={current} onSelect={onSelect} />
  }

  const onKeyDown = tabKeys(sections, current, onSelect)

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

      {/* Every panel is a plain block scroller, Overview included. `is-fill` used to
          stretch Overview to the window because it was a single photograph with the
          words on it; since 2026-08-18 it carries the batch cards and the Header Text
          under the picture, and a flex panel that cannot scroll silently hides content
          — that is how Safety's last four measures became unreachable. */}
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

/**
 * The Overview tab, in the order the school asked for on 2026-08-18:
 * **the photograph with nothing written on it**, then the batches as two cards
 * with their dates, then the sheet's Header Text.
 *
 * It replaces the 2026-08-14 layout, where grade, batch, dates and the whole
 * Header Text were set ON the image. Off the photograph the words need no scrim,
 * no measured contrast and no text-shadow — they are ink on the page — and the
 * dates stop competing with a photo for legibility, which is what the two cards
 * are for.
 *
 * The tab scrolls now: there is real content under the picture, so the band takes
 * a share of the first screen instead of filling it.
 *
 * The photo is not `loading="lazy"`: it is the first thing on the first tab, and
 * a lazy image never loads at all while the preview pane is hidden.
 */
function HomeSection({ trip, photo }) {
  const [broken, setBroken] = useState(false)
  const { lead, body } = splitHeader(trip.overview)
  const showPhoto = photo && !broken

  /**
   * A credited photograph of the destination, shown ONLY where the school has
   * given none of its own — Grade 7 has a real one, the rest had a flat colour
   * (the school, 2026-08-21). Nothing is fetched when `photo` is set, so a
   * school photograph is never replaced.
   *
   * `trip.title` is the destination, and `placeCandidates` splits a compound one
   * like "Jaipur-Abhaneri-Ranthambore" and takes the first place that resolves.
   */
  const found = useDestinationPhoto(trip.title, !photo)
  const [standInBroken, setStandInBroken] = useState(false)
  const showStandIn = !showPhoto && found && !standInBroken
  // One card per batch. A sheet with no batch rows still has the trip's own dates,
  // and one card saying so beats an empty row where two cards should be.
  const cards = trip.batches?.length
    ? trip.batches.map((b, i) => ({
        label: b.label || `Batch ${i + 1}`,
        dates: stripBatchPrefix(b.headline),
        detail: b.detail,
      }))
    : trip.dates
      ? [{ label: 'Dates', dates: trip.dates, detail: '' }]
      : []

  return (
    <Section id="home">
      {showPhoto && (
        <div className="home-photo-band">
          <img
            className="home-photo"
            src={photo}
            alt={`${trip.title} — photograph from the school trip`}
            onError={() => setBroken(true)}
          />
        </div>
      )}

      {/* The stand-in. The credit is not decoration and must not be removed: it
          is the whole reason this is allowed back on the page. Without it a
          library photograph of Pachmarhi reads as a picture of the trip, and a
          parent looks for their child in it. */}
      {showStandIn && (
        <div className="home-photo-band is-standin">
          <img
            className="home-photo"
            src={found.url}
            alt={`${found.title} — a general photograph of the area, not from this trip`}
            onError={() => setStandInBroken(true)}
          />
          <a
            className="home-photo-credit"
            href={found.pageUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {found.title} · a photograph of the area, not of this trip · Wikipedia
          </a>
        </div>
      )}

      {/* The band bleeds to both window edges; everything under it goes back into
          the page's column, which is what this wrapper is for. */}
      <div className="home-below">
        {/* The destination, and no "Grade 7" line above it (2026-08-18): the grade
            is already on the card the reader came from and in the page they signed
            in to, so on this head it was a label on a label. */}
        <div className="section-head">
          <div><h3>{trip.title}</h3></div>
        </div>

        {cards.length > 0 && (
          <div className="home-batches">
            {cards.map((c, i) => (
              <div className="home-batch-card" key={i}>
                <span className="batch-tag">{c.label}</span>
                <div className="home-batch-dates">{c.dates}</div>
                {c.detail && <div className="home-batch-detail">{c.detail}</div>}
              </div>
            ))}
          </div>
        )}

        {(lead || body) && (
          <div className="home-about">
            {lead && <p className="home-lead">{lead}</p>}
            {body && <p className="home-body-text">{body}</p>}
          </div>
        )}
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
 * The card labels, given by the school on 2026-08-19 as "B1- Parents Orientation
 * details". The `B1` half is the `batchTag` chip the card already draws, so only
 * the words live here — and they OVERRIDE whatever the sheet called the file.
 *
 * That reverses the 2026-08-17 rule, which used the chip's own name from the sheet
 * ("G7 B1 … Parent's Orientation") on the grounds that it named grade, batch and
 * destination better than anything built here. The school would rather have four
 * cards that read identically apart from their batch, so the label is now fixed
 * copy and a renamed file in Drive cannot change it.
 */
const ORIENTATION_LABELS = {
  'Parent orientation': 'Parents Orientation details',
  'Student orientation': 'Students Orientation details',
}

/**
 * Parent and student decks, one row per kind with the batches beside each other
 * — the school drew this as `Parent Orientation [B1] [B2]`.
 *
 * **No section head**: the school removed "Before the trip / Orientation" on
 * 2026-08-19. The tab the reader pressed already says Orientation, so the eyebrow
 * and heading were the third and fourth time the word appeared on one screen.
 * `titled: true` stays in `buildSections` — it means "this section draws its own
 * head, do not print one above it", and without it the flow and stage layouts would
 * put the heading straight back.
 */
function OrientationSection({ docs }) {
  const groups = ['Parent orientation', 'Student orientation']
    .map((category) => ({ category, items: docs.filter((d) => d.category === category) }))
    .filter((g) => g.items.length)

  return (
    <Section id="orientation">
      {/* The two kinds of deck sit BESIDE each other. Stacked, a grade with one batch
          gave this section two labels and two small cards down the middle of a 1400px
          column — ~350px of which was empty, which is the screenshot the school sent
          on 2026-08-17. Side by side it is one row. */}
      <div className="orient-groups">
        {groups.map((g) => (
          <div className="orient-group" key={g.category}>
            {/* The heading is OUTSIDE `.orient-box` on the school's instruction
                (2026-08-19): it labels the box rather than sitting inside it as its
                first row. `.orient-group` is now just the stack — heading, then box —
                and every border, fill and pad belongs to `.orient-box`. */}
            <h4>{g.category}</h4>
            <div className="orient-box">
              <div className="orient-row">
                {/* Big, with a slide preview in the box (2026-08-17). `compact` — which
                    dropped the medium entirely to save height on the 2026-08-14 fitted
                    layout — is gone; `eager` because the deck IS the content of this
                    section, so a lazy load is pure delay. */}
                {g.items.map((d, i) => (
                  <DocCard
                    key={`${d.label}-${i}`}
                    {...d}
                    label={ORIENTATION_LABELS[d.category] || d.label}
                    batchTag={shortBatch(d.batch)}
                    hideMeta
                    preview
                    eager
                  />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
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
          <SlidesOpenLink url={slides} />
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

/**
 * The itinerary links as FILLED cards carrying the batch's own dates and sections.
 *
 * This is the fourth attempt at this row in one day, and the first that does not depend on
 * something outside the page:
 *   1. `compact` cards — an icon and a line of text; the two batches looked identical.
 *   2. a live `/preview` iframe of the Doc — worked, but the school wanted it smaller and
 *      not a working document.
 *   3. Drive's `thumbnail?id=…` as a cover image — **it does not load.** Not only in the
 *      restricted preview pane where it was first noticed, but in the school's own browser
 *      too: their screenshot on 2026-08-19 shows the icon fallback, a grey rectangle with a
 *      document glyph. Drive serves that endpoint only for files shared "anyone with the
 *      link", and these are not.
 *   4. this — no image at all. The dates and sections come from `trip.batches`, which the
 *      sheet already fills for the Overview tab, so the card is legible whatever Drive
 *      decides to serve and nothing here can silently become an empty box again.
 *
 * Matched by batch LABEL, not by index: `documentsFrom` and `batches` both take their labels
 * from the same `batchLabels(all)` map, so "Batch 2" is the reliable join. A doc whose batch
 * has no row still renders — it just shows the link without dates.
 *
 * `kind` and `action` are parameters rather than literals because the Student list tab
 * (2026-08-19) is the same card with different words: one link per batch, and the batch's
 * dates and sections are exactly what tells a reader which list is theirs.
 */
/**
 * A card whose document is drawn ON the page — today only the student list.
 *
 * It shows the table OR the link, never both. The school, 2026-08-21: *"there is
 * blank page on the webpage and it links to the spreadsheet too ... so if names
 * are going to be displayed on web page than no need for link ... either of the
 * the two is needed"*.
 *
 * So `names` decides:
 *   - names on the page  -> the table, and no link. The scroller reaches the rest.
 *   - no names yet, or the sheet could not be read -> no empty table, and the link
 *     is what a parent uses.
 *
 * `null` means the fetch has not resolved: neither is shown, which is why the link
 * does not flash in and then vanish under a table that was about to arrive.
 */
function LiveDocCard({ url, action, children }) {
  const [names, setNames] = useState(null)
  return (
    <div className="itin-card is-live">
      {children}
      <LiveList url={url} onResolved={setNames} />
      {names === 0 && (
        <a className="itin-card-open" href={url} target="_blank" rel="noopener noreferrer">
          {action} ↗
        </a>
      )}
    </div>
  )
}

function ItineraryCards({
  docs,
  batches,
  kind = 'Itinerary',
  action = 'Open the day-by-day plan',
  live = false,
}) {
  const byLabel = new Map(batches.map((b) => [b.label, b]))

  return (
    <div className="itin-cards">
      {docs.map((d, i) => {
        const batch = byLabel.get(d.batch)
        const tag = shortBatch(d.batch)
        /**
         * `live` renders the document's own rows inside the card (2026-08-20: "show preview
         * like live list"). Only where the file is readable without an account — the student
         * list is, unlike the photo folders — and only where it adds something: a list is
         * worth reading in place, a day-by-day plan is not.
         *
         * `LiveList` fetches and draws the table itself rather than framing Google's page.
         * Two reasons, both learned here: `/preview` ignores `?gid=` and showed the wrong
         * tab with a tab bar attached, and a cross-origin frame cannot be styled, so the
         * sheet's merged title made column A three times wider than the names beside it.
         */
        const isLive = live && describeDoc(d.url).kind === 'sheet'

        const body = (
          <>
            <span className="itin-card-top">
              {tag && <span className="itin-card-tag">{tag}</span>}
              <span className="itin-card-kind">{kind}</span>
            </span>

            {/* The batch's dates, the largest thing on the card: it is what tells a parent
                which of the two links is theirs. */}
            {batch?.headline && <span className="itin-card-dates">{batch.headline}</span>}
            {batch?.detail && <span className="itin-card-sections">{batch.detail}</span>}
          </>
        )

        /**
         * With a frame the card cannot be an anchor — an iframe is interactive content and an
         * anchor may not contain any — so the action line carries the link instead. It is a
         * real `<a>`, not a styled span: that exact mistake shipped on the orientation cards
         * and the school found it ("open button not work like i click no redirect").
         */
        if (isLive) {
          return (
            <LiveDocCard key={`itin-${i}`} url={d.url} action={action}>
              {body}
            </LiveDocCard>
          )
        }

        return (
          <a
            className="itin-card"
            key={`itin-${i}`}
            href={d.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {body}
            <span className="itin-card-open">{action} ↗</span>
          </a>
        )
      })}
    </div>
  )
}

function ItinerarySection({ trip, itineraryDocs, columns }) {
  // No section heading: the tab is already labelled "Itinerary", and the 86px it
  // cost was the difference between this tab fitting the window and scrolling.
  // The column headings below carry the meaning that matters here.
  return (
    <Section id="itinerary" className={columns.length ? 'is-stretch' : undefined}>
      {/* The batch dates ARE on these cards, unlike the 2026-08-18 rule that kept them
          on Overview only. That rule was about not printing the same block twice on one
          screen; here they are not a repeated block but the label that tells a parent
          which of the two links is theirs. */}
      {itineraryDocs.length > 0 && (
        <ItineraryCards docs={itineraryDocs} batches={trip.batches || []} />
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
                {/* In the HEAD, not under the deck: the panel is a fixed height, so
                    a link below the frame takes 51px off it and the deck drops from
                    777x437 to 686x386. Here it costs 11px of width. Measured. */}
                <SlidesOpenLink url={c.slides} />
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
/**
 * The school writes travel as prose in one cell, one fact per line:
 *
 *   Departure - 12 Dec at 10:30 pm (reporting 9:45 pm)
 *   Train - MMCT JAIPUR SF (12955) to Sawai Madhopur Junction
 *   Arrival - 19 Dec at 8:45 am
 *
 * The label before the dash is what a parent scans for — "when do we leave, which
 * train, when do we get back" — so it is set in bold and the rest of the line is
 * left exactly as typed (2026-08-18).
 *
 * Only the words below are treated as labels. Bolding whatever happens to precede
 * a dash would have picked up "MMCT JAIPUR SF (12955) to Sawai Madhopur Junction"
 * on any line the school wrote with a dash in the middle of it.
 */
const TRAVEL_LABELS = /^(departure|departs|arrival|arrives|train|reporting|platform|coach|coach\s*\/\s*seat|seat|boarding|return)\s*[:–-]\s*/i

/**
 * The labels that begin a LEG, so the card can group "Departure, Train" and
 * "Arrival, Train" as two blocks with a gap between them — the school's own reading of
 * this card (2026-08-20: "depature , train and arrival, train make gap previously like").
 *
 * Derived from the LABEL rather than from the sheet's own blank lines, which are typed
 * inconsistently: g7 has a blank after Departure and after the outbound Train, but none
 * before the return Train. Honouring those put gaps in the wrong places; deriving them
 * puts one gap in the right place whatever staff type.
 */
const TRAVEL_LEG_START = /^(arrival|arrives|return|boarding)$/i

export function splitTravelLine(raw) {
  const line = String(raw || '')
  const m = line.match(TRAVEL_LABELS)
  if (!m) return { label: '', rest: line }
  return { label: m[1], rest: line.slice(m[0].length) }
}

/**
 * Drops a leading "Batch 1" / "Batch 2:" line from a travel cell.
 *
 * The school types the batch as the first line of the prose, and the card already shows
 * it as a pill immediately above it — so it printed twice, "Batch 1" under "Batch 1"
 * (their screenshot, 2026-08-19). The PILL is the one that survives, because `batchLabels`
 * corrects it by position when the sheet repeats a name, while this line is raw text and
 * cannot be corrected. Same reasoning as `stripBatchPrefix` on the Overview headlines.
 *
 * Only a line that is JUST the batch goes. "Batch 1 - 12 Dec" keeps its detail, and a cell
 * that never names its batch is untouched.
 */
function dropBatchHeading(lines) {
  const first = (lines[0] || '').trim()
  return /^batch\s*\d+\s*:?$/i.test(first) ? lines.slice(1) : lines
}

/**
 * The notes, one line per fact with each label emboldened.
 *
 * **Blank lines are dropped** (2026-08-20: "departure and train have one line gap please
 * remove"). The school's travel cell carries them inconsistently — Grade 7 has one after
 * Departure and one after the outbound Train, but none between Arrival and the return
 * Train — so honouring them made the card look like the typing rather than like a list.
 * Filtering them out is what makes all four facts read as one column, matching the
 * Arrival/Train pair that already had no gap.
 *
 * `white-space: pre-wrap` stays on `.travel-notes`: it is what keeps the single newlines
 * between these facts, now that there are no doubles left to honour.
 */
function TravelNotes({ text, className }) {
  const lines = dropBatchHeading(String(text || '').split('\n')).filter((l) => l.trim())

  return (
    <p className={className}>
      {lines.map((line, i) => {
        const { label, rest } = splitTravelLine(line.trim())
        // A blank line before the RETURN leg, none between a leg's own facts. `pre-wrap`
        // renders the doubled newline, so no extra element is needed to space them.
        const gap = i > 0 && TRAVEL_LEG_START.test(label.trim()) ? '\n\n' : '\n'
        return (
          <Fragment key={i}>
            {i > 0 && gap}
            {label ? (
              <>
                <strong className="travel-key">{label}</strong>
                {' — '}
                {rest}
              </>
            ) : (
              line
            )}
          </Fragment>
        )
      })}
    </p>
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
                <TravelNotes
                  text={leg.notes}
                  className={structured ? 'travel-notes has-route' : 'travel-notes'}
                />
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

/**
 * An album is a Drive FOLDER, and a folder has no thumbnail — Drive serves none, so these
 * cards were a folder glyph on white and the tab read as empty (the school's screenshot,
 * 2026-08-20: "make this page like background fancynatic ... like thoese i use in overview").
 *
 * So the card borrows the grade's OWN trip photograph, the same file the Overview tab shows,
 * as a background with a scrim over it. It is honest — it is a picture of this trip, not a
 * stock image — and it costs no extra request, since Overview has already fetched it.
 *
 * When a grade has no photograph configured the card keeps its plain form: `is-photo` and the
 * custom property are only set when there is a file, so nothing renders a broken image or an
 * empty dark box. Same rule as the Overview banner.
 */
/**
 * The album card's wording, given by the school on 2026-08-20 ("PICS FOR TRIP INTEND OF THIS
 * SHOW THE USE Trip Memories"). Without this the card is named by the Drive chip in the
 * sheet, which reads "Pics for trips" — the school's own filing name for the folder rather
 * than something written for a parent.
 *
 * Same trade as `ORIENTATION_LABELS`, and the same reason to accept it: the page says what
 * the school decided it should say, and renaming the folder in Drive can no longer change the
 * page's wording. A category with no entry here still takes the file's own name.
 */
const ALBUM_LABELS = {
  Photos: 'Trip Memories',
}

function PhotosSection({ albums, media, title, photo }) {
  /**
   * The collage's tiles: `media` and nothing else. `media` is the sheet's own photo links,
   * and with a `driveApiKey` set it also carries one entry per image in the album folder,
   * because `expandFolderDocuments` turns a folder row into a row per file.
   *
   * There was briefly a fallback here that used the grade's own photograph as a single tile
   * when `media` was empty. **Removed 2026-08-20 at the school's request** — and they were
   * right: the album card below already carries that same photograph as its background, so
   * the tab showed one picture twice. With no media the collage renders nothing and the card
   * is the whole tab, which is also the honest state — the app does not invent photographs it
   * does not have.
   */
  const tiles = media

  const collage = useRef(null)
  // Sets `js-reveal` on the element itself once it has a live observer — see the hook for why
  // that cannot be decided here at render time.
  useScrollReveal(collage, tiles.length)

  return (
    <Section
      id="photos"
      eyebrow="Memories from the journey"
      title="Trip photos"
      aside={title}
    >
      {tiles.length > 0 && (
        <div className="photo-collage" ref={collage}>
          {tiles.map((m, i) => <PhotoTile key={i} item={m} />)}
        </div>
      )}

      {albums.length > 0 && (
        <div className="doc-grid" style={{ marginTop: media.length ? 24 : 0 }}>
          {albums.map((d, i) => (
            <div
              className={photo ? 'album-card is-photo' : 'album-card'}
              key={`${d.label}-${i}`}
              style={photo ? { '--album-photo': `url("${photo}")` } : undefined}
            >
              <DocCard {...d} label={ALBUM_LABELS[d.category] || d.label} />
            </div>
          ))}
        </div>
      )}
      <PendingNote docs={albums} />
    </Section>
  )
}

/**
 * Leans a collage tile toward the pointer, by writing the two custom properties the CSS
 * already reads (`--tilt-x` / `--tilt-y`). Asked for on 2026-08-20 ("3d motion collage").
 *
 * Written here rather than in CSS because a tilt that follows the cursor needs the cursor's
 * position, and `:hover` cannot supply it. Everything else about the effect — the stage, the
 * entrance, the lift — is CSS, so this handler is an enhancement on top of a collage that
 * already works: with the script inert the properties keep their 0deg defaults.
 *
 * `MAX_TILT` is small on purpose. Past ~10deg a photograph starts to read as distorted
 * rather than tilted, and this is a page parents read on a phone in a corridor.
 */
const MAX_TILT = 7

/**
 * One place to ask whether this reader wants motion, because three separate features now
 * need the answer — the tilt, the glare and the scroll reveal — and they must agree.
 *
 * Read at render rather than subscribed: someone who changes this system setting mid-visit
 * gets it on their next navigation, which is worth not holding a media-query listener per
 * tile in a grid that may hold dozens.
 */
function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )
}

function tiltHandlers(reduced) {
  if (reduced) return {}
  return {
    onPointerMove: (e) => {
      // Ignore touch: a finger is already on the tile it would tilt, and the transform
      // fights the tap.
      if (e.pointerType === 'touch') return
      const b = e.currentTarget.getBoundingClientRect()
      const px = (e.clientX - b.left) / b.width - 0.5
      const py = (e.clientY - b.top) / b.height - 0.5
      e.currentTarget.style.setProperty('--tilt-y', `${(px * MAX_TILT * 2).toFixed(2)}deg`)
      e.currentTarget.style.setProperty('--tilt-x', `${(-py * MAX_TILT * 2).toFixed(2)}deg`)
      // The same two numbers again, as percentages, for the glare highlight: one
      // `getBoundingClientRect` pays for both effects rather than each measuring its own.
      e.currentTarget.style.setProperty('--mx', `${((px + 0.5) * 100).toFixed(1)}%`)
      e.currentTarget.style.setProperty('--my', `${((py + 0.5) * 100).toFixed(1)}%`)
    },
    onPointerLeave: (e) => {
      e.currentTarget.style.setProperty('--tilt-y', '0deg')
      e.currentTarget.style.setProperty('--tilt-x', '0deg')
      // Back to the centre, so the next hover starts from the middle instead of wherever
      // the cursor happened to leave.
      e.currentTarget.style.setProperty('--mx', '50%')
      e.currentTarget.style.setProperty('--my', '50%')
    },
  }
}

/**
 * Lets each tile play its entrance when it is actually scrolled to, instead of every tile
 * animating at load and the ones below the fold finishing unseen.
 *
 * **`js-reveal` is added from inside the first callback, not up front, and that ordering is
 * the whole safety story.** The class is what pauses the animation, and a paused entrance
 * holds a tile invisible — so adding it at mount would hide the entire collage for ever on
 * any page where the callback never arrives. That is not hypothetical: the steps that deliver
 * an `IntersectionObserver` callback only run for a document that is being *rendered*, so a
 * page loaded in a background tab observes and hears nothing back. Waiting for the first
 * callback inverts the failure: if it never comes, no tile is ever paused and every one of
 * them simply animates at load, exactly as it did before this hook existed.
 *
 * The class goes on and the on-screen tiles are released in the SAME callback, so there is no
 * paint in between and nothing flashes. A tile is unobserved once it has arrived; an entrance
 * that replayed on every scroll past would be a page that never settles.
 */
function useScrollReveal(ref, count) {
  useEffect(() => {
    const grid = ref.current
    if (!grid || prefersReducedMotion() || !('IntersectionObserver' in window)) return

    let armed = false
    const io = new IntersectionObserver(
      (entries) => {
        if (!armed) {
          armed = true
          grid.classList.add('js-reveal')
        }
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('is-in')
          io.unobserve(entry.target)
        }
      },
      // A tile starts its rise just before it is fully on screen, so the reader sees the
      // movement rather than arriving to find it already over.
      { rootMargin: '0px 0px -8% 0px', threshold: 0.15 }
    )
    for (const tile of grid.children) io.observe(tile)
    return () => {
      io.disconnect()
      grid.classList.remove('js-reveal')
    }
  }, [ref, count])
}

/**
 * A photo a parent's browser may not be able to load — a Drive image that is
 * not link-shared 403s. Falling back to a typed tile keeps the grid looking
 * deliberate instead of leaving a white gap, and the link still works.
 */
function PhotoTile({ item }) {
  const [broken, setBroken] = useState(false)
  const isVideo = item.type === 'video'
  const reduced = prefersReducedMotion()

  return (
    <a
      className="photo-item"
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      title={item.caption || ''}
      {...tiltHandlers(reduced)}
    >
      {isVideo || broken ? (
        <div className="thumb">
          {isVideo ? <span className="play">▶</span> : <Icon name="photo" stroke="currentColor" />}
        </div>
      ) : (
        /* `imageUrl` is why a Drive link works here at all: a Drive *share* URL is a web
           page, so putting it straight in `src` gets HTML and a broken tile. The rewrite
           turns it into Drive's thumbnail endpoint at the width the tile renders, and passes
           any non-Drive URL through untouched. Same helper the Overview banner uses — added
           here 2026-08-20, when the school offered to paste photo links into the sheet.
           The file still has to be shared "anyone with the link", or the endpoint answers
           with a sign-in page and the tile falls back to the icon. */
        <img
          src={imageUrl(item.url, 800)}
          alt={item.caption || ''}
          loading="lazy"
          onError={() => setBroken(true)}
        />
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
