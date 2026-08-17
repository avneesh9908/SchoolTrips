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
