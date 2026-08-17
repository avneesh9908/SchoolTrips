import { useState } from 'react'

/**
 * A published Google Slides deck, live on the page.
 *
 * Asked for on 2026-08-17: the guideline sections used to render a card with an
 * Open link, so a parent had to leave the site to read the school's own safety
 * rules. This frames the deck instead — no click, and because it is the published
 * document rather than an export, an edit staff make in Slides shows up on the
 * next page load with nothing to rebuild.
 *
 * The skeleton is the same 16:9 box as the frame it replaces, so the panel does
 * not jump when Google answers. It sits *behind* the iframe rather than instead of
 * it: rendering the frame only after loading would mean never rendering it, since
 * the load event is what we are waiting for.
 */
export function GoogleSlidesPreview({ title, url }) {
  const [state, setState] = useState('loading')

  if (!url) return null

  return (
    <div className={`google-slides-preview is-${state}`}>
      {state !== 'ready' && (
        <div className="gsp-skeleton" role="status">
          <span className="gsp-shimmer" aria-hidden="true" />
          <span className="gsp-note">
            {state === 'error' ? 'This presentation could not be loaded.' : `Loading ${title}…`}
          </span>
        </div>
      )}
      <iframe
        src={url}
        title={title}
        frameBorder="0"
        allowFullScreen
        onLoad={() => setState('ready')}
        onError={() => setState('error')}
      />
    </div>
  )
}
