import { config } from '../config'
import { describeDoc } from './docPreview'

/**
 * Turns whatever the school pasted into something an `<img>` can load.
 *
 * A Drive *share* link (`drive.google.com/file/d/ID/view`) is a web page, not an
 * image: put it in a `src` and the browser gets HTML and shows a broken icon.
 * Drive's thumbnail endpoint is the one that answers with actual image bytes,
 * and it takes a width — so Drive resizes for us and the banner and the card
 * each fetch only the size they render, instead of the full camera original.
 *
 * This exists so the school can paste the link Drive's own Share button gives
 * them. Expecting them to hand-build a `thumbnail?id=` URL is how the photo
 * silently stops appearing six months from now.
 *
 * Anything that is not a Drive link — a local path, a CDN URL — passes straight
 * through untouched.
 *
 * The file must be shared "Anyone with the link · Viewer". For anything else the
 * endpoint returns a sign-in page rather than an image, exactly as documented for
 * the document cards, and the photo just does not appear.
 */
export function imageUrl(url, width) {
  const { kind, id } = describeDoc(url)
  if (!id || kind === 'folder' || kind === 'form') return url
  return `https://drive.google.com/thumbnail?id=${id}&sz=w${width}`
}

/**
 * The photograph shown on a trip page, keyed by grade in `config.tripPhotos`.
 *
 * This replaced the Wikipedia destination lookup (`destinationPhoto.js`, deleted
 * 2026-08-14) at the school's instruction: they supply the real photograph of
 * the real trip. Nothing is searched for and nothing is invented — a grade with
 * no entry here simply has no photo, and the page falls back to the grade
 * colour. An illustrative stock photo of a place is worse than no photo, because
 * a parent reads it as a picture of their child's trip.
 *
 * It lives in config rather than in code so the school can change or add one by
 * editing a deployed JSON file, the same way the spreadsheet pointer works.
 */
export function tripPhotoFor(gradeId, destination = '') {
  const photos = config().tripPhotos || {}
  const url = pickPhoto(photos, gradeId, destination)
  return url ? imageUrl(url, 1600) : ''
}

/**
 * "Jaipur-Abhaneri-Ranthambore" -> "jaipur-abhaneri-ranthambore", so a trip can
 * be addressed in config by the place it goes to.
 */
export function photoSlug(destination) {
  return String(destination || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * A grade's photo, or a single TRIP's within it.
 *
 * Grade 11 travels to four different places on the same dates, so one photograph
 * per grade cannot serve them: all four cards would carry the same picture and it
 * would be wrong for three of them. So a trip may be keyed
 * `"<gradeId>.<destination-slug>"`, falling back to the grade's own entry:
 *
 *   "g11.mokhamal": "https://drive.google.com/file/d/…/view"
 *   "g11.ambapani": "…"
 *
 * **Keyed by the destination, not by position.** A `g11.0` would silently point
 * at a different trip the moment the school inserts a row above it — the same
 * reason `slidePreviews` is keyed by section name rather than by column order.
 *
 * Keys are flat strings for the reason recorded in `slidePreviews`: config
 * merging walks one level and would stringify a nested object.
 */
function pickPhoto(map, gradeId, destination) {
  const slug = photoSlug(destination)
  if (slug) {
    const own = String(map[`${gradeId}.${slug}`] || '').trim()
    if (own) return own
  }
  return String(map[gradeId] || '').trim()
}

/**
 * The photograph on the grade card in the picker, which is a different shape from
 * the trip page's banner — a wide 2.6:1 strip about 132px tall, against a banner
 * that fills the window. A portrait-ish group shot that reads well on the banner
 * gets cropped to a band of torsos in the card, so the school can supply a
 * separate wide crop in `config.tripCardPhotos`.
 *
 * Falls back to `tripPhotos` when a grade has no card-specific entry, so one
 * photograph still covers both places; with neither, the card keeps the grade's
 * own colour and icon and no picture is invented.
 */
export function tripCardPhotoFor(gradeId, destination = '') {
  const cards = config().tripCardPhotos || {}
  const url = pickPhoto(cards, gradeId, destination)
  // 1200 rather than the banner's 1600: the card is a 132px strip, so the wider
  // fetch would be bytes no parent ever sees.
  return url ? imageUrl(url, 1200) : tripPhotoFor(gradeId, destination)
}
