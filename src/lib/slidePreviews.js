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
  return url.replace(/\/pub(\?|$)/i, '/embed$1')
}

/** '' when this grade has no deck for this section — the caller then falls back. */
export function slidePreviewFor(gradeId, section) {
  const key = SECTION_KEYS[section]
  if (!key || !gradeId) return ''
  const decks = config().slidePreviews || {}
  return toEmbedUrl(decks[`${gradeId}.${key}`])
}
