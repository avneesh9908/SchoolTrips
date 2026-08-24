import { config } from '../config'

/**
 * The published Google Slides deck shown inline for a guideline section.
 *
 * The school keeps Safety, Do's and don'ts and Things to carry as Slides decks
 * and asked for them **live on the page** (2026-08-17) rather than as a card with
 * an Open link. So the deck is framed, not exported: staff edit the presentation
 * in Google Slides and a parent's next page load shows the new version, with no
 * image to replace, no poster to redraw and no deploy.
 *
 * The URLs live in `config.slidePreviews`, not in code, for the same reason as
 * `tripPhotos` — a deck can be re-published or a grade added by editing one
 * deployed JSON file.
 *
 * **Keys are flat `"<gradeId>.<section>"` strings, and must stay flat.**
 * `config.js`'s `merge()` walks one level into an object and calls `String()` on
 * each value, so a nested `{ g7: { safety: "…" } }` would reach the app as the
 * literal `"[object Object]"`. Sections are keyed per grade because Grade 8's
 * parents must never be shown Grade 7's safety deck.
 */
const SECTION_KEYS = { safety: 'safety', dodont: 'dodont', carry: 'carry' }

/**
 * Google publishes a deck at `/pub`, which is the standalone viewer — a page with
 * its own background and chrome, meant to be opened. `/embed` is the same
 * snapshot of the same document, sized to fit its frame, which is what makes it
 * read as part of this page instead of a website inside a website.
 *
 * Both were measured as frameable (2026-08-17); this only swaps the endpoint.
 * The document id and the publish state — the things that make edits appear
 * automatically — are untouched, so a URL pasted in either form works.
 */
export function toEmbedUrl(raw) {
  const url = String(raw || '').trim()
  if (!url) return ''
  if (!/^https:\/\/docs\.google\.com\/presentation\//i.test(url)) return ''
  // A published snapshot: /d/e/2PACX-…/pub is the standalone viewer.
  if (/\/pub(\?|#|$)/i.test(url)) return url.replace(/\/pub(\?|#|$)/i, '/embed$1')
  /**
   * An ordinary share link — /presentation/d/<id>/edit?usp=sharing — which is what
   * a smart chip in the sheet resolves to. `/embed` on the same id frames the deck
   * for anyone the file is shared with, so a deck does NOT have to be published to
   * the web to appear on the page; "Anyone with the link → Viewer" is enough.
   * Measured anonymously 2026-08-24: all three of the school's poster decks answer
   * 200 on /embed with no publish link involved.
   *
   * Everything after the id is dropped rather than kept — an /edit URL carries
   * `usp=sharing` and can carry a slide anchor, neither of which belongs on a frame.
   */
  const base = url.match(/^(https:\/\/docs\.google\.com\/presentation\/d\/(?:e\/)?[^/?#]+)/i)
  if (!base) return ''
  return `${base[1]}/embed?start=false&loop=false&delayms=3000`
}

/**
 * The deck a guideline column's own sheet cell points at.
 *
 * This is the route that makes every grade behave like Grade 7 (2026-08-24, the
 * school: "other grades (8,9,10,11) does not show safety, do/donts and things to
 * carry … i made changes as these posters were not reflected in all grades"). The
 * sheet's Safety / Do-Dont's / Things-to-carry columns now hold a smart chip on
 * EVERY grade's row, and `xlsxSheet.js` recovers each chip's URL — so the deck for
 * a grade is already in the data and does not have to be pasted into config per
 * grade. Verified 2026-08-24: all eleven trip rows point at the same three files,
 * and each file's title matches its column, so there is no rotation to get wrong.
 *
 * **One deck, or none.** A column holding two files is a card grid, not a frame:
 * framing the first would silently hide the second. So this returns '' unless the
 * column resolved to exactly one document and that document is a Slides deck.
 */
export function soleSlideDeck(docs) {
  const list = docs || []
  if (list.length !== 1) return ''
  return toEmbedUrl(list[0] && list[0].url)
}

/** '' when this grade has no deck for this section — the caller then falls back. */
export function slidePreviewFor(gradeId, section) {
  const key = SECTION_KEYS[section]
  if (!key || !gradeId) return ''
  const decks = config().slidePreviews || {}
  return toEmbedUrl(decks[`${gradeId}.${key}`])
}
