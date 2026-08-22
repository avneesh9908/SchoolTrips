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

/**
 * The "open it full size" link, as a SEPARATE component rendered BESIDE
 * `.chip-slides` rather than inside it.
 *
 * Both of the wrong places were tried first, and each cost the school a round
 * trip:
 *   - inside `.google-slides-preview` the link is invisible. That box is
 *     `overflow: hidden` with a 16/9 `aspect-ratio` and the iframe fills it at
 *     `height: 100%`, so anything below the frame is clipped away.
 *   - inside `.chip-slides` as a second child it changed the deck's size. That
 *     container sizes its single child, and adding a sibling made the frame's
 *     width come from the iframe's intrinsic 300px instead of from its height:
 *     the deck shrank to a letterboxed thumbnail. The school: "ok give you
 *     button dont change the slide size".
 *   - as a sibling BELOW `.chip-slides` the ratio is right but the panel is a
 *     fixed height, so the link's 51px comes straight off the deck: 777x437 down
 *     to 686x386.
 *
 * So it goes in `.chip-head`, beside the panel's own title, where it costs 11px
 * of deck width — 766x431, measured in a 1200x520 panel. The title says "Open
 * full screen" rather than naming the deck, because the heading it sits next to
 * already does.
 */
export function SlidesOpenLink({ url }) {
  if (!url) return null
  return (
    <a className="gsp-open" href={toOpenUrl(url)} target="_blank" rel="noopener noreferrer">
      Open full screen ↗
    </a>
  )
}
