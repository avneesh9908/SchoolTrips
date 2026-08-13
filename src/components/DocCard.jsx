import { useState } from 'react'
import { describeDoc, KIND_LABEL } from '../lib/docPreview'
import { Icon } from './Icon'

/**
 * Image preview of a Google document; clicking opens the real thing in a new
 * tab. Drive's thumbnail endpoint fails for folders, Forms and anything not
 * publicly shared, so a typed placeholder always stands behind it.
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
        <div className="doc-fallback">
          <Icon name={pendingKind} />
          <span>{KIND_LABEL[pendingKind]}</span>
        </div>
        <div className="doc-body">
          <div className="doc-label">{label}</div>
          <div className="doc-meta">{category} · link not added yet</div>
        </div>
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
        <div className="doc-fallback">
          <Icon name={kind} />
          <span>{KIND_LABEL[kind]}</span>
        </div>
      )}
      <div className="doc-body">
        <div className="doc-label">{label}</div>
        <div className="doc-meta">{category || KIND_LABEL[kind]} ↗</div>
      </div>
    </a>
  )
}
