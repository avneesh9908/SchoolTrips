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
 * An "Open full screen" link sits under the frame, added 2026-08-21. The school:
 * "the slides are not easily readable on main screen, i had to expand to full
 * screen which was not easy to find (the button to click for full screen)", and
 * from the principals, "for ppt it has click open text (which is easy)".
 *
 * Note this does NOT restore the 2026-08-17 card-with-a-link that the frame
 * replaced. The deck stays on the page — a parent still reads the school's own
 * safety rules without leaving the site — and the link is the way out for anyone
 * who wants it full size. Both, not either.
 *
 * The frame is Google's, so its own full-screen control is a small icon inside a
 * cross-origin iframe: it cannot be moved, enlarged or labelled from here. A link
 * of our own, in our own words, is the only fixable part.
 *
 * The skeleton is the same 16:9 box as the frame it replaces, so the panel does
 * not jump when Google answers. It sits *behind* the iframe rather than instead of
 * it: rendering the frame only after loading would mean never rendering it, since
 * the load event is what we are waiting for.
 */
/**
 * The standalone viewer for the same published deck.
 *
 * `slidePreviewFor` hands this component the `/embed` form, because that is what
 * frames cleanly. `/pub` is the same snapshot as a full page, which is what
 * should open in a new tab — so the one is derived from the other rather than
 * threading a second URL through every caller.
 */
function toOpenUrl(embedUrl) {
  return String(embedUrl || '').replace(/\/embed(\?|$)/i, '/pub$1')
}

export function GoogleSlidesPreview({ title, url }) {
  const [state, setState] = useState('loading')

  if (!url) return null
  const openUrl = toOpenUrl(url)

  return (
    /* The link is a SIBLING of the frame box, not a child of it. Inside, it is
       invisible: `.google-slides-preview` is `overflow: hidden` with a 16/9
       aspect-ratio and the iframe fills it at `height: 100%`, so a child below
       the frame is clipped away. That is a whole feature silently absent. */
    <div className="gsp-wrap">
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
      {/* A real `<a>`, not a styled span. That exact mistake shipped on the
          orientation cards and the school found it ("open button not work like i
          click no redirect"). */}
      <a className="gsp-open" href={openUrl} target="_blank" rel="noopener noreferrer">
        Open {title} full screen ↗
      </a>
    </div>
  )
}
