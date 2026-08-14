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

export function DocCard({ label, url, category, pending = false }) {
  const { kind, thumb, open } = describeDoc(url)
  const [broken, setBroken] = useState(false)
  const showImage = thumb && !broken && !pending

  // The sheet names the file but carries no link (a smart chip). Showing the
  // card anyway is the point — a parent can see the deck exists and ask for it —
  // but it must not look clickable when there is nothing to open.
  if (pending) {
    const pendingKind = PENDING_KIND[category] || 'file'
    return (
      <div className="doc-card is-pending">
        <span className="doc-icon">
          <Icon name={pendingKind} />
        </span>
        <span className="doc-label">{label}</span>
        <span className="doc-meta">{category} · link not added yet</span>
      </div>
    )
  }

  return (
    <a className="doc-card" href={open} target="_blank" rel="noopener noreferrer">
      {showImage ? (
        <img
          className="doc-thumb"
          src={thumb}
          alt={`Preview of ${label}`}
          loading="lazy"
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="doc-icon">
          <Icon name={kind} />
        </span>
      )}
      <span className="doc-label">{label}</span>
      <span className="doc-meta">{category || KIND_LABEL[kind]} ↗</span>
    </a>
  )
}
