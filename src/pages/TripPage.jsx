import { useState, useMemo, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { TRIP_LAYOUT } from '../lib/layout'
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
 * The sections, in the order the school set on 2026-08-17 — the order a parent
 * reads them in, not the order the sheet's columns happen to be in:
 *
 *   Overview        the photograph, carrying the sheet's Header Text
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
      node: <PhotosSection key="photos" albums={albums} media={media} title={trip.title} />,
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
        className={cover ? 'stage is-cover' : 'stage'}
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
      {/* The two kinds of deck sit BESIDE each other. Stacked, a grade with one batch
          gave this section two labels and two small cards down the middle of a 1400px
          column — ~350px of which was empty, which is the screenshot the school sent
          on 2026-08-17. Side by side it is one row. */}
      <div className="orient-groups">
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
