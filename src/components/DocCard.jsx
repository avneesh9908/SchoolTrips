import { useState } from 'react'
import { describeDoc, KIND_LABEL } from '../lib/docPreview'
import { Icon } from './Icon'

/**
 * A document the school linked. The Drive thumbnail is shown when it loads —
 * it fails for folders, Forms and anything not publicly shared — and a typed
 * icon tile always stands behind it.
 */
/**
 * A chip carries no URL, so the kind cannot be read off one. The category says
 * what the file is well enough to pick an icon.
 */
const PENDING_KIND = {
  'Parent orientation': 'slides',
  'Student orientation': 'slides',
  Itinerary: 'sheet',
  Photos: 'folder',
  'Photos from last year': 'folder',
}

/**
 * `batchTag` is the short batch code ("B1") shown on the Orientation tab, where
 * one row holds a card per batch and the chip's own file name is too long to
 * tell them apart at a glance. It sits **beside the label, in the flow** — never
 * over the medium. Positioned at `top/right` it landed on top of the live deck
 * frame, printing "B1" across the school's first slide (the school caught this on
 * 2026-08-19: "dont b1 and b2 show in pdf"). Beside the label it reads as the
 * "[B1] Students Orientation details" line they asked for, and it cannot cover
 * anything.
 *
 * `compact` drops the Drive thumbnail and tightens the card to an icon and a
 * line of text. The Orientation tab uses it so its four cards fit one screen
 * without scrolling (the school's instruction, 2026-08-14) — a 150px preview per
 * card is what pushed that tab past the fold.
 *
 * `hideMeta` drops the category line, for the guideline chips where a heading
 * directly above already says "Safety" / "Things to carry".
 *
 * `eager` loads the thumbnail immediately instead of lazily. Set it where the
 * image IS the content of the panel — the guideline posters — since the card only
 * mounts when its tab is opened, so it is on screen the moment it exists and a
 * lazy load is pure delay.
 *
 * There was a `cover` mode here for one afternoon (2026-08-19) — `preview`'s frame
 * filled with Drive's `thumbnail?id=…` instead of a live embed. It was removed the
 * same day, and deliberately not refactored into something cleverer: **that endpoint
 * serves only files shared "anyone with the link"**, and the school's itinerary Docs
 * are not, so every card fell back to the typed icon in their own browser as well as
 * in the dev preview. If a cover image is wanted again, the SHARING has to be fixed
 * first — the code was never the problem.
 */
export function DocCard({
  label, url, category, batchTag = '', pending = false, compact = false, hideMeta = false,
  eager = false, preview = false,
}) {
  const { kind, thumb, embed, open } = describeDoc(url)
  const [broken, setBroken] = useState(false)
  const showImage = thumb && !broken && !pending && !compact

  // The sheet names the file but carries no link (a smart chip). Showing the
  // card anyway is the point — a parent can see the deck exists and ask for it —
  // but it must not look clickable when there is nothing to open.
  // `is-preview` is what lets the CSS size these cards from their frame instead of the
  // 270px/420px basis the icon-only cards want — and it has to be a class rather than a
  // `:has(.doc-preview)` selector so the itinerary's compact card in the same
  // `.orient-row` is not caught by it.
  const cls =
    (compact ? 'doc-card is-compact' : 'doc-card') + (preview ? ' is-preview' : '')

  /**
   * The chip goes INSIDE the label, as the first inline thing in its text flow —
   * not as a flex sibling beside it. As a sibling it took ~42px off the label's
   * column for every line, and "Parents Orientation details" then wrapped to three
   * lines in one card and two in its neighbour, from a 2px difference in the space
   * left over. Inline, only the first line pays for the chip and the rest of the
   * label has the full width back.
   */
  const labelText = batchTag ? (
    <>
      <span className="doc-batch">{batchTag}</span>
      {label}
    </>
  ) : (
    label
  )

  if (pending) {
    const pendingKind = PENDING_KIND[category] || 'file'
    return (
      <div className={`${cls} is-pending`}>
        <span className="doc-icon">
          <Icon name={pendingKind} />
        </span>
        <span className="doc-label">{labelText}</span>
        <span className="doc-meta">{hideMeta ? 'link not added yet' : `${category} · link not added yet`}</span>
      </div>
    )
  }

  const medium = showImage ? (
    <img
      className="doc-thumb"
      src={thumb}
      alt={`Preview of ${label}`}
      loading={eager ? 'eager' : 'lazy'}
      onError={() => setBroken(true)}
    />
  ) : (
    <span className="doc-icon">
      <Icon name={kind} />
    </span>
  )

  if (preview && embed) {
    return (
      <div className={`${cls} is-framed`}>
        {/* The frame is live, so the reader pages through the deck in place. The card
            cannot be an `<a>` around it — an iframe is interactive content and an anchor
            may not contain any — so the label carries the link instead, which is also
            what stops a click on slide 2 from navigating away. */}
        <span className="doc-preview">
          {/* Not lazy: the card only mounts when its section is opened, so the frame is on
              screen the moment it exists and a lazy load is pure delay — the same reason
              the guideline decks and the poster thumbnails are eager. */}
          <iframe className="doc-frame" src={embed} title={label} allowFullScreen />
        </span>
        <a className="doc-label is-link" href={open} target="_blank" rel="noopener noreferrer">
          {labelText}
        </a>
        <span className="doc-meta">{hideMeta ? 'Open ↗' : `${category || KIND_LABEL[kind]} ↗`}</span>
      </div>
    )
  }

  return (
    <a className={cls} href={open} target="_blank" rel="noopener noreferrer">
      {/* `preview` puts the medium in a fixed-ratio frame — a slide-sized box that a
          reader can actually read, asked for on 2026-08-17 ("make box big like screen
          preview in box like ppt docs or slide preview").
          The wrapper is the point: Drive's thumbnail endpoint returns an HTML sign-in
          page rather than an image for a file that is not link-shared, so the `<img>`
          errors and falls back to the icon — and without a wrapper of its own size, that
          card would collapse to 46px while its neighbour stayed slide-sized, leaving the
          row visibly ragged for a reason no parent could guess. Measured 2026-08-17: 5 of
          the 7 orientation decks in the sheet are private, so this is the common case,
          not the edge one. */}
      {preview ? <span className="doc-preview">{medium}</span> : medium}
      <span className="doc-label">{labelText}</span>
      <span className="doc-meta">{hideMeta ? 'Open ↗' : `${category || KIND_LABEL[kind]} ↗`}</span>
    </a>
  )
}
