import { useState } from 'react'
import { describeDoc, KIND_LABEL } from '../lib/docPreview'
import { Icon } from './Icon'

/**
 * Image preview of a Google document; clicking opens the real thing in a new
 * tab. Drive's thumbnail endpoint fails for folders, Forms and anything not
 * publicly shared, so a typed placeholder always stands behind it.
 */
export function DocCard({ label, url, category }) {
  const { kind, thumb, open } = describeDoc(url)
  const [broken, setBroken] = useState(false)
  const showImage = thumb && !broken

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
