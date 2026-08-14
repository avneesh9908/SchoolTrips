/**
 * Guideline text of last resort.
 *
 * The school's sheet holds a poster *chip* in Safety, Do/Dont's and Things to
 * carry, and a chip carries no text — so those tabs had nothing to print and
 * fell back to a link card. The school's rule is that a parent should read
 * these on the page rather than open a file, so this file supplies the text
 * until the cells are filled.
 *
 * It is a fallback and must stay one:
 * - a column is only filled when the sheet gave **no** text for it, so the
 *   moment management types into the cell their words win with no code change;
 * - filling a column also drops that column's poster card, because the page
 *   should not offer a link to the same thing it is already printing.
 *
 * Loaded from public/, not bundled, so the text can be corrected by editing one
 * deployed file — the same reasoning as config.json.
 */

let current = null

/** Same SPA-fallback guard as config.js: a missing file returns index.html. */
export async function loadGuidelines() {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}trip-guidelines.json`, { cache: 'no-store' })
    if (!res.ok) return (current = {})
    const text = await res.text()
    if (text.trimStart().startsWith('<')) return (current = {})
    current = JSON.parse(text)
  } catch (err) {
    console.warn('[guidelines] could not read trip-guidelines.json:', err.message)
    current = {}
  }
  return current
}

/** Category on a document card, per column, so a filled column drops its card. */
const CARD_CATEGORY = {
  safety: 'Safety',
  doDonts: "Do's and don'ts",
  carry: 'Things to carry',
}

const list = (v) => (Array.isArray(v) ? v.filter((s) => typeof s === 'string' && s.trim()) : [])

/**
 * Fills empty guideline lists on an assembled trip. Returns the trip unchanged
 * when the sheet already carries the text, which is the expected end state.
 */
export function applyGuidelineFallback(trip, gradeId) {
  const entry = current && current[gradeId]
  if (!trip || !entry) return trip

  const safety = list(entry.safety)
  const dos = list(entry.dos)
  const donts = list(entry.donts)
  const doDonts = list(entry.doDonts)
  const carry = list(entry.carry)

  const next = { ...trip }
  const filled = []

  if (!next.safety?.length && safety.length) {
    next.safety = safety
    filled.push('safety')
  }
  // dos/donts and the single-list doDonts are three views of one column, so
  // they stand or fall together — a half-filled Do/Don't panel reads as a bug.
  if (!next.dos?.length && !next.donts?.length && !next.doDonts?.length && (dos.length || donts.length || doDonts.length)) {
    next.dos = dos
    next.donts = donts
    next.doDonts = doDonts
    filled.push('doDonts')
  }
  if (!next.carry?.length && carry.length) {
    next.carry = carry
    filled.push('carry')
  }

  if (!filled.length) return trip

  const dropped = new Set(filled.map((k) => CARD_CATEGORY[k]))
  next.documents = (next.documents || []).filter((d) => !dropped.has(d.category))

  console.info(
    `[guidelines] ${gradeId}: printed fallback text for ${filled.join(', ')} because the sheet cell holds no text. ` +
      `Type into the sheet and it takes over.`
  )
  return next
}
