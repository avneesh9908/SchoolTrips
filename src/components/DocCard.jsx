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
 * tell them apart at a glance.
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
 */
export function DocCard({
  label, url, category, batchTag = '', pending = false, compact = false, hideMeta = false,
  eager = false,
}) {
  const { kind, thumb, open } = describeDoc(url)
  const [broken, setBroken] = useState(false)
  const showImage = thumb && !broken && !pending && !compact

  // The sheet names the file but carries no link (a smart chip). Showing the
  // card anyway is the point — a parent can see the deck exists and ask for it —
  // but it must not look clickable when there is nothing to open.
  const cls = compact ? 'doc-card is-compact' : 'doc-card'

  if (pending) {
    const pendingKind = PENDING_KIND[category] || 'file'
    return (
      <div className={`${cls} is-pending`}>
        {batchTag && <span className="doc-batch">{batchTag}</span>}
        <span className="doc-icon">
          <Icon name={pendingKind} />
        </span>
        <span className="doc-label">{label}</span>
        <span className="doc-meta">{hideMeta ? 'link not added yet' : `${category} · link not added yet`}</span>
      </div>
    )
  }

  return (
    <a className={cls} href={open} target="_blank" rel="noopener noreferrer">
      {batchTag && <span className="doc-batch">{batchTag}</span>}
      {showImage ? (
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
      )}
      <span className="doc-label">{label}</span>
      <span className="doc-meta">{hideMeta ? 'Open ↗' : `${category || KIND_LABEL[kind]} ↗`}</span>
    </a>
  )
}
