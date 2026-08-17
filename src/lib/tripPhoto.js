import { config } from '../config'

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
export function tripPhotoFor(gradeId) {
  const photos = config().tripPhotos || {}
  const url = String(photos[gradeId] || '').trim()
  return url || ''
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
export function tripCardPhotoFor(gradeId) {
  const cards = config().tripCardPhotos || {}
  const url = String(cards[gradeId] || '').trim()
  return url || tripPhotoFor(gradeId)
}
