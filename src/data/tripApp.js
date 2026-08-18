// Explicit .js: this module is checked with plain Node, which does not resolve
// extensionless paths the way Vite does.
import { normalizeRow, pick, LINKS } from './csv.js'
import { linkFor } from './xlsxSheet.js'
import { normalizeGradeId } from '../lib/grades.js'

/**
 * Reads the school's "Trip app" sheet: ONE tab, one row-group per grade, one
 * row per batch.
 *
 *   Grades | Destination | Dates | Starting Text | Parent Orientation |
 *   Student Orientation | Itinerary (nucleus) (link) | Travel details | Safety
 *
 * This is not the eight-tab schema in docs/SHEET-SCHEMA.md. The school wrote
 * this one, so it wins; `assembleTrip` stays for the other shape and the two
 * are told apart by their headers, never by configuration.
 *
 * The grade cell is merged across a grade's rows, so CSV gives it only on the
 * first row and blanks afterwards — hence the carry-forward. Losing that turns
 * every batch after the first into an orphan row that silently vanishes.
 */

const FLAT_MARKERS = ['destination', 'headertext', 'startingtext', 'parentorientation', 'studentorientation']

/** True when the rows look like the Trip app sheet rather than a Trips tab. */
export function looksLikeTripApp(rows) {
  const first = rows?.[0]
  if (!first) return false
  const keys = Object.keys(normalizeRow(first))
  return FLAT_MARKERS.filter((m) => keys.includes(m)).length >= 2
}

const val = (row, ...aliases) => String(pick(row, ...aliases) || '').trim()

/**
 * The school renames headers as it goes — "Dates" became "Dates/ Sections" and
 * "Starting Text" became "Header Text" between two reads on the same day, which
 * silently emptied the hero and the overview. Every read of these two columns
 * goes through these lists; never inline a single header name.
 */
const DATE_ALIASES = ['datessections', 'dates', 'datesection', 'date', 'tripdates', 'sections']
const OVERVIEW_ALIASES = ['headertext', 'startingtext', 'header', 'starttext', 'intro', 'introduction', 'overview']

/** Groups the flat rows by grade, carrying the merged grade cell downwards. */
export function groupByGrade(rows) {
  const groups = new Map()
  let currentGrade = ''

  for (const raw of rows) {
    const row = normalizeRow(raw)
    const cell = val(row, 'grades', 'grade', 'class')
    if (cell) {
      const id = normalizeGradeId(cell)
      // A grade cell that cannot be read still ENDS the previous group. Keeping
      // the carry-forward here silently filed the sheet's "MlC" row (Manali)
      // under Grade 11, showing one group's trip to another's parents.
      if (!id) console.warn(`[trip app] ignoring rows for "${cell}" — not a grade this app knows.`)
      currentGrade = id || ''
    }
    if (!currentGrade) continue

    // A row that carries nothing but the merged grade cell is padding.
    // LINKS is an object, so it must be skipped here or every blank row counts
    // as filled and the grouping silently takes in the sheet's empty rows.
    const hasContent = Object.entries(row).some(
      ([k, v]) => k !== 'grades' && k !== 'grade' && k !== LINKS && String(v || '').trim()
    )
    if (!hasContent) continue

    if (!groups.has(currentGrade)) groups.set(currentGrade, [])
    groups.get(currentGrade).push(row)
  }
  return groups
}

/**
 * Every one of these columns is meant to hold a link, and the school fills them
 * with smart chips. A chip's URL is absent from the CSV export — 0 of 22 cells
 * carried one — but present in the workbook export, which is what the sheets
 * adapter now reads (`xlsxSheet.js`). So a cell's link comes from one of two
 * places: the text itself when someone pasted a plain URL, or `linkFor(row, …)`
 * when it is a chip.
 */
const BATCH_LINK_COLUMNS = [
  { aliases: ['parentorientation', 'parentsorientation', 'parentorientationdeck'], category: 'Parent orientation' },
  { aliases: ['studentorientation', 'studentsorientation'], category: 'Student orientation' },
  { aliases: ['itinerarynucleuslink', 'itinerarylink', 'itinerarynucleus', 'itinerary'], category: 'Itinerary' },
]

/**
 * Common to the whole grade. The school fills these once, on the merged first
 * row of the group, so they must be read across every row — reading only the
 * student's own batch row loses them for everyone in Batch 2.
 */
const COMMON_LINK_COLUMNS = [
  { aliases: ['picfolderlink', 'picfolder', 'photos', 'photofolder'], category: 'Photos' },
  { aliases: ['lastyearspicforaddinginpage', 'lastyearspic', 'lastyearphotos'], category: 'Photos from last year' },
]

/**
 * Read as TEXT and printed on the page, per the school's instruction: a parent
 * should not have to open a file to learn what to pack. If one of these cells
 * holds a URL instead, it still becomes a card — the check is per cell, so the
 * two can be mixed while the sheet is being filled in.
 */
const TEXT_COLUMNS = [
  { key: 'safety', aliases: ['safetyguidelines', 'safety'], category: 'Safety' },
  { key: 'doDonts', aliases: ['dodonts', 'dodont', 'dosanddonts'], category: "Do's and don'ts" },
  { key: 'carry', aliases: ['thingstocarry', 'packinglist'], category: 'Things to carry' },
]

/**
 * One document card per link cell.
 *
 * A cell holding a smart chip has no URL, and the school's sheet is entirely
 * chips today. Those become **pending** cards — the name is shown, the card does
 * not open anything, and it says so — because hiding them removed whole tabs and
 * a parent could not tell that an orientation deck exists at all. The names are
 * still collected so the caller can report exactly which cells need fixing.
 *
 * `fileNamesOnly` is for the text columns: prose in one of those is guidance to
 * print, not a lost link, so only a leftover chip file name becomes a card.
 *
 * Chip URLs are resolved in **every** column, including the three text ones
 * (2026-08-14, reversing the 2026-08-13 rule that held them back). The argument
 * for holding back was that a working poster link makes those tabs look finished
 * while the text a parent needs is still missing. In practice the sheet's text
 * cells have stayed chips, so the choice was between a link a parent can open
 * and a dashed card they cannot — and the link wins. If the school later pastes
 * the text in, the cell stops being a chip and prints as text anyway.
 */
function documentsFrom(
  rows,
  columns,
  lostLinks,
  { labelWithBatch = true, fileNamesOnly = false, labelOf = null } = {}
) {
  const out = []
  const seen = new Set()
  // `labelOf` is keyed by row and the caller builds it from the WHOLE grade group.
  // Deriving labels from `rows` here was wrong whenever `rows` had been filtered to one
  // parent's batch: a single row cannot collide with anything, so `batchLabels` trusted
  // the sheet's text, and a Batch 2 parent's cards came out tagged "B1".
  const labels = labelWithBatch && !labelOf ? batchLabels(rows) : []
  rows.forEach((row, i) => {
    const batch = labelWithBatch ? (labelOf ? labelOf.get(row) || '' : labels[i]) : ''
    for (const col of columns) {
      const cell = val(row, ...col.aliases)
      if (!cell) continue
      // A common column repeated down the group is one document, not several.
      const key = `${col.category}|${cell}|${batch}`
      if (seen.has(key)) continue
      seen.add(key)

      // In a text column, only a leftover chip name is a file; prose is
      // guidance to print, even on the rare cell that carries a link inside it.
      if (fileNamesOnly && !isUrl(cell) && !looksLikeFileName(cell)) continue

      // A pasted URL is its own link; a smart chip carries its URL beside the
      // cell, recovered from the workbook export.
      const chipUrl = isUrl(cell) ? '' : linkFor(row, ...col.aliases)

      if (!isUrl(cell) && !chipUrl) {
        lostLinks.push(`${col.category}: "${cell}"`)
        // The chip's own name is the best label there is — it says which grade,
        // batch and destination the file is for.
        out.push({ grade: '', label: cell, url: '', category: col.category, batch, pending: true })
        continue
      }

      out.push({
        grade: '',
        // Which batch this file belongs to, kept as its own field so the page can
        // group a category's files and show the batches side by side. Reading it
        // back out of the label is not possible: a chip's label is whatever the
        // school named the file.
        batch,
        // A chip names the file itself ("G7 B1 … Parent's Orientation"), which
        // says more than the column ever could; a bare URL has no name, so the
        // column and batch have to supply one.
        label: chipUrl ? readableName(cell) : batch ? `${col.category} — ${batch}` : col.category,
        url: chipUrl || cell,
        category: col.category,
      })
    }
  })
  return out
}

/**
 * A Google Sheets smart chip exports as its display text with the URL dropped,
 * so a cell that is not a URL cannot become a link. Treated as text instead of
 * guessing, and reported once per load so the cause is visible.
 */
function isUrl(s) {
  return /^https?:\/\//i.test(s)
}

/**
 * A single hyphen/underscore-joined token with no spaces — the shape a chip's
 * display name leaves behind. Real guidance is a sentence, so it has spaces.
 */
function looksLikeFileName(s) {
  return !/\s/.test(s) && /[-_]/.test(s)
}

/**
 * "safety-guidelines-poster" is a file name, and on a card a parent clicks it
 * should read like a title. Only slugs are touched — a chip that already has a
 * real name ("G7 B1 … Parent's Orientation") is left exactly as the school
 * wrote it.
 */
function readableName(s) {
  if (!looksLikeFileName(s)) return s
  const words = s.replace(/[-_]+/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** "Batch 1: 12-19 December 2026 …" -> "Batch 1". */
function batchLabel(row, i, total) {
  const dates = val(row, ...DATE_ALIASES)
  const m = dates.match(/batch\s*\d+/i)
  if (m) return m[0].replace(/\s+/g, ' ')
  return total > 1 ? `Batch ${i + 1}` : ''
}

/** "Batch 2: 13-20 December 2026" -> "13-20 December 2026". */
function stripBatchPrefix(s) {
  return String(s || '').replace(/^batch\s*\d+\s*[:–-]\s*/i, '').trim()
}

/**
 * One label per row of a grade's group, with collisions broken by position.
 *
 * The sheet's own text is trusted first, and normally that is right. But Grade
 * 7 currently has **both** of its rows reading "Batch 1:" (measured 2026-08-14 —
 * the second should say Batch 2), and taking that at face value does two
 * visible kinds of damage: the Orientation tab shows two cards labelled
 * identically, and because the label is part of `documentsFrom`'s de-duplication
 * key, two batches that also share a file name collapse into one card and a
 * whole batch's deck disappears.
 *
 * Position is the only thing that still distinguishes the rows once the text
 * does not, so it wins when the text repeats. A single-row group is left alone:
 * there is nothing to collide with, and renumbering it would invent a batch.
 */
function batchLabels(rows) {
  const raw = rows.map((row, i) => batchLabel(row, i, rows.length))
  if (rows.length < 2) return raw

  const seen = new Map()
  for (const label of raw) seen.set(label, (seen.get(label) || 0) + 1)

  // Silent on purpose: this runs once per document column as well as for the
  // batch list itself, so warning here said the same thing four times. The
  // caller reports it once instead.
  return raw.map((label, i) => (!label || seen.get(label) === 1 ? label : `Batch ${i + 1}`))
}

/** True when the sheet's own batch text repeated and position had to take over. */
function batchLabelsCollided(rows) {
  if (rows.length < 2) return false
  const raw = rows.map((row, i) => batchLabel(row, i, rows.length))
  return new Set(raw.filter(Boolean)).size !== raw.filter(Boolean).length
}

/**
 * Section names out of a Dates cell. The school writes them two ways:
 *
 *   "Batch 1: 12-19 December 2026\n\nSection: Acuity, Cognizance, Idea & Perspicacity"
 *   "Batch 1: Ardour, Elan, Exuberance, Rhapsody."
 *
 * so a "Section:" line is used when present, and otherwise the text after the
 * batch label is read as the list. Anything containing a digit is a date, not a
 * section.
 */
export function sectionsOf(row) {
  const cell = val(row, ...DATE_ALIASES)
  if (!cell) return []

  const explicit = cell.match(/sections?\s*:\s*([^\n]+)/i)
  const source = explicit
    ? explicit[1]
    : (cell.match(/batch\s*\d+\s*:\s*([^\n]+)/i)?.[1] ?? '')

  return source
    .split(/[,&]|\band\b/i)
    .map((s) => s.replace(/[.\s]+$/, '').trim().toLowerCase())
    .filter((s) => s && !/\d/.test(s))
}

const sameSection = (a, b) => normalizeSection(a) === normalizeSection(b)

/** "Mavericks -7" and "mavericks-7" are the same section. */
function normalizeSection(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function assembleTripApp(gradeId, rows, { section } = {}) {
  const groups = groupByGrade(rows)
  const all = groups.get(gradeId)
  if (!all || all.length === 0) return null

  /**
   * A grade travels in batches and a student is in exactly one, so the dates,
   * travel timings and per-batch decks that apply are only their batch's.
   * Everything else on the page is the same for the whole grade.
   *
   * Falling back to every batch is deliberate: staff have no section, and a
   * section the sheet never lists (Mavericks -7 today) must still see the trip
   * rather than an empty page. `batchMatched` lets the UI say which it is.
   */
  const matched = section ? all.filter((row) => sectionsOf(row).some((s) => sameSection(s, section))) : []
  const batchMatched = matched.length > 0
  const mine = batchMatched ? matched : all

  if (section && !batchMatched && all.some((row) => sectionsOf(row).length)) {
    console.warn(
      `[trip app] ${gradeId}: section "${section}" is not listed against any batch in the sheet, ` +
        'so every batch is being shown. Add it to the Dates/Sections cell to narrow this down.'
    )
  }

  // Grade-common values are read across the WHOLE group: the school types them
  // once, on the merged first row.
  const firstWith = (...aliases) => {
    for (const row of all) {
      const v = val(row, ...aliases)
      if (v) return v
    }
    return ''
  }

  const destination = firstWith('destination', 'place', 'location')

  /**
   * The Dates cell holds two things: the batch's dates on the first line, then
   * its sections below. Only the first line belongs in the hero — the rest is
   * what tells a parent which batch their child is in, so it gets its own block
   * rather than being flattened into a one-line subtitle.
   */
  /**
   * Labels are computed over the WHOLE group and then looked up per row — never over
   * `mine`, which is a single batch whenever a parent's section matched one.
   *
   * This is what the school caught on 2026-08-17: their child is in Acumen, which the
   * sheet lists against Batch 2, and the page said "Batch 1". `batchLabels` deliberately
   * leaves a one-row group alone, because renumbering a single row would invent a batch —
   * so filtering first threw away the only thing that knew this row was the second one.
   * Position survives here because `all` is still both rows.
   */
  const allLabels = batchLabels(all)
  const labelOf = new Map(all.map((row, i) => [row, allLabels[i]]))
  const mineLabels = mine.map((row) => labelOf.get(row) || '')

  if (batchLabelsCollided(all)) {
    console.warn(
      `[trip app] ${gradeId}: more than one row carries the same batch name, so batches are being ` +
        'numbered by position instead. Correct the Dates/Sections cell in the sheet — the second ' +
        'batch should say "Batch 2".'
    )
  }

  const batches = mine
    .map((row, i) => {
      const cell = val(row, ...DATE_ALIASES)
      if (!cell) return null
      const lines = cell.split('\n').map((l) => l.trim()).filter(Boolean)
      return {
        label: mineLabels[i],
        // The label sits in a pill immediately beside this line, so the cell's own
        // "Batch 2:" prefix is repetition at best — and a flat contradiction when the
        // sheet has both rows mislabelled and position has corrected the pill. Same
        // treatment `heroDates` already gives the Overview meta line.
        headline: stripBatchPrefix(lines[0] || ''),
        detail: lines.slice(1).join('\n'),
      }
    })
    .filter(Boolean)

  // Travel details are prose per batch, not the structured legs the eight-tab
  // schema assumes, so each cell becomes one block with its batch as the title.
  const travel = mine
    .map((row, i) => ({
      grade: gradeId,
      leg: mineLabels[i] || 'Travel',
      trainNo: '',
      departure: '',
      platform: '',
      coachSeat: '',
      notes: val(row, 'traveldetails', 'travel', 'traveldetail'),
    }))
    .filter((t) => t.notes)

  const lostLinks = []
  const documents = [
    ...documentsFrom(mine, BATCH_LINK_COLUMNS, lostLinks, { labelOf }),
    ...documentsFrom(all, COMMON_LINK_COLUMNS, lostLinks, { labelWithBatch: false }),
    // A text column holding a URL — or a chip pointing at one — is a poster.
    ...documentsFrom(all, TEXT_COLUMNS, lostLinks, {
      labelWithBatch: false,
      fileNamesOnly: true,
    }),
  ].map((d) => ({ ...d, grade: gradeId }))

  /** Text columns become lines on the page, one list item per line. */
  const textLines = (aliases) => {
    const seen = new Set()
    for (const row of all) {
      const cell = val(row, ...aliases)
      if (!cell || isUrl(cell)) continue
      for (const line of cell.split('\n')) {
        const t = line.replace(/^[-•*\s]+/, '').trim()
        // A chip's leftover file name ("safety-guidelines-poster") is not
        // guidance; printing it would read as a broken attachment.
        if (t && !looksLikeFileName(t)) seen.add(t)
      }
    }
    return [...seen]
  }

  /**
   * The sheet has ONE Do/Dont's column, so the two sides can only be told apart
   * by how the line starts ("Do: …" / "Don't: …"). Prefixed lines become the
   * two-column layout; anything unprefixed stays one list, so a school that just
   * types sentences still gets a correct page.
   */
  const dos = []
  const donts = []
  const doDonts = []
  for (const line of textLines(['dodonts', 'dodont', 'dosanddonts'])) {
    const m = line.match(/^(don'?ts?|dos?)\s*[:\-–—]\s*(.+)$/i)
    if (!m) doDonts.push(line)
    else if (/^don/i.test(m[1])) donts.push(m[2])
    else dos.push(m[2])
  }

  if (lostLinks.length) {
    console.warn(
      `[trip app] ${gradeId}: ${lostLinks.length} cell(s) hold a Google smart chip, which exports without its URL, ` +
        `so they cannot be linked. Paste the plain URL, or use =HYPERLINK("url","label"):\n  ` +
        lostLinks.join('\n  ')
    )
  }

  const media = mine.flatMap((row) =>
    splitLinks(val(row, 'photos', 'photo', 'media', 'photosvideos', 'photoslinks')).map((url) => ({
      grade: gradeId,
      type: /\.(mp4|mov|webm)$/i.test(url) || /youtu|vimeo|video/i.test(url) ? 'video' : 'photo',
      url,
      caption: '',
    }))
  )

  return {
    grade: gradeId,
    title: destination || 'Educational trip',
    dates: batches.map((b) => b.headline).filter(Boolean).join('  ·  '),
    batches,
    /** False when the page is showing every batch because none matched. */
    batchMatched,
    section: section || '',
    batchCount: all.length,
    status: 'confirmed',
    coverImage: '',
    overview: firstWith(...OVERVIEW_ALIASES),
    coordinator: firstWith('coordinator', 'tripcoordinator'),
    coordinatorPhone: firstWith('coordinatorphone', 'phone', 'contact'),
    coordinatorEmail: firstWith('coordinatoremail', 'email'),
    emergency: firstWith('emergency', 'emergencycontact'),
    itinerary: [],
    documents,
    safety: textLines(['safetyguidelines', 'safety']),
    doDonts,
    dos,
    donts,
    carry: textLines(['thingstocarry', 'packinglist']),
    reminders: [],
    travel,
    media,
  }
}

/** One cell can hold several links, separated by newlines, commas or spaces. */
function splitLinks(cell) {
  if (!cell) return []
  return cell.split(/[\s,;]+/).map((s) => s.trim()).filter(isUrl)
}
