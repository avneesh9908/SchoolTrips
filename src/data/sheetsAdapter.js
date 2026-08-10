import { config } from '../config'
import { csvToObjects, normalizeKey, pick } from './csv'
import { parseSheetRef, csvExportUrl } from '../lib/sheetUrl'
import { listFolder, folderIdOf } from '../lib/drive'
import {
  toStudent, toTrip, toItineraryRow, toDocument,
  toGuideline, toReminder, toTravelLeg, toMedia,
} from './normalize'

/**
 * Reads Google Sheets straight from the browser via the CSV export endpoint.
 *
 * SECURITY: the spreadsheet must be shared "anyone with the link can view", and
 * its id ships inside the JS bundle. Any parent can therefore open the raw sheet
 * and read every family's row. The grade filter applied downstream is a
 * convenience, NOT access control. Use the api adapter for anything private.
 */

const TAB_NAMES = {
  students: 'Students',
  trips: 'Trips',
  itinerary: 'Itinerary',
  documents: 'Documents',
  guidelines: 'Guidelines',
  reminders: 'Reminders',
  travel: 'Travel',
  media: 'Media',
}

const SOURCES = Object.keys(TAB_NAMES)

async function fetchCsv(url, label) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Could not read "${label}" (HTTP ${res.status}). Check the spreadsheet is shared publicly.`)
  const text = await res.text()
  // A sheet that is not link-shared returns Google's sign-in HTML with a 200.
  // Vite's dev server likewise answers a missing file with the SPA index.html.
  if (text.trimStart().startsWith('<')) {
    throw new Error(`"${label}" is not shared publicly — Google returned a sign-in page instead of data.`)
  }
  return text
}

/**
 * Optional index tab. Management pastes a link per source into it, so a source
 * can live in a different spreadsheet without anyone touching config.json.
 * A missing tab is normal and silently means "use the tabs in this file".
 */
let indexCache = null

async function loadIndex() {
  if (indexCache) return indexCache

  const { sheetId, settingsTab } = config()
  const ref = parseSheetRef(sheetId)
  if (!ref || !settingsTab) {
    indexCache = {}
    return indexCache
  }

  try {
    const text = await fetchCsv(csvExportUrl({ id: ref.id, tabName: settingsTab }), settingsTab)
    const out = {}
    for (const row of csvToObjects(text)) {
      const key = normalizeKey(pick(row, 'key', 'name', 'sheet', 'source', 'item'))
      const link = pick(row, 'link', 'url', 'sheetlink', 'sheeturl')
      if (key && link && SOURCES.includes(key)) out[key] = link
    }
    indexCache = out
  } catch {
    indexCache = {}
  }
  return indexCache
}

const SPREADSHEET_MIME = 'application/vnd.google-apps.spreadsheet'

/**
 * Maps the spreadsheets found in a Drive folder onto the eight sources by file
 * name. Exported so the matching can be checked without a network call.
 *
 * Exact name wins. Otherwise a single file whose name *contains* the source
 * word is accepted, so "Grade 7 Students 2026" still resolves. Two candidates
 * is ambiguous and deliberately resolves to nothing rather than guessing.
 */
export function matchFolderFiles(files) {
  const sheets = []
  for (const f of files) {
    if (f.mimeType && f.mimeType !== SPREADSHEET_MIME) {
      // An .xlsx that was uploaded but never opened as a Google Sheet cannot be
      // read by the CSV endpoint — the commonest setup mistake here.
      console.warn(`[drive] ignoring "${f.label}" — not a Google Sheet. Open it and use File → Save as Google Sheets.`)
      continue
    }
    sheets.push(f)
  }

  const map = {}
  for (const source of SOURCES) {
    const exact = sheets.filter((f) => normalizeKey(f.label) === source)
    if (exact.length) {
      map[source] = exact[0].id
      continue
    }
    const partial = sheets.filter((f) => normalizeKey(f.label).includes(source))
    if (partial.length === 1) map[source] = partial[0].id
    else if (partial.length > 1) {
      console.warn(`[drive] "${source}" matches ${partial.length} files (${partial.map((f) => f.label).join(', ')}) — rename so only one matches.`)
    }
  }
  return map
}

let folderCache = null

async function loadFolderMap() {
  if (folderCache) return folderCache

  const { folderId, driveApiKey } = config()
  if (!folderId) {
    folderCache = {}
    return folderCache
  }
  if (!driveApiKey) {
    console.warn('[drive] a folder is configured but no driveApiKey is set, so its contents cannot be listed.')
    folderCache = {}
    return folderCache
  }

  try {
    const id = folderIdOf(folderId) || folderId
    folderCache = matchFolderFiles(await listFolder(id))
  } catch (err) {
    console.warn('[drive] could not read the folder:', err.message)
    folderCache = {}
  }
  return folderCache
}

function localUrl(name) {
  const { csvBase } = config()
  return csvBase ? `${csvBase.replace(/\/$/, '')}/${name}.csv` : null
}

/**
 * Resolution order, most specific first:
 *   1. local CSV fixtures
 *   2. a link the school pasted into the index tab
 *   3. a per-source id in config
 *   4. a spreadsheet discovered in the Drive folder, matched by file name
 *   5. the master spreadsheet, tab addressed by name
 *
 * Returns a list — the first entry is tried, and the rest are fallbacks.
 */
async function urlsFor(name) {
  const local = localUrl(name)
  if (local) return [local]

  const { sheetId, sheetIds, gids } = config()
  const tabName = TAB_NAMES[name]

  const index = await loadIndex()
  const fromIndex = index[name] && parseSheetRef(index[name])
  if (fromIndex) return withFallback(fromIndex.id, fromIndex.gid, tabName)

  const own = sheetIds[name] && parseSheetRef(sheetIds[name])
  if (own) return withFallback(own.id, own.gid, tabName)

  const folder = await loadFolderMap()
  if (folder[name]) return withFallback(folder[name], null, tabName)

  const master = parseSheetRef(sheetId)
  if (!master) {
    throw new Error('No spreadsheet configured. Paste a spreadsheet or Drive folder link into config.json.')
  }
  return withFallback(master.id, gids[name], tabName)
}

/**
 * A file dedicated to one source may have its tab left as "Sheet1", so fall
 * back to the first tab when addressing by name finds nothing.
 */
function withFallback(id, gid, tabName) {
  if (gid) return [csvExportUrl({ id, gid })]
  return [csvExportUrl({ id, tabName }), csvExportUrl({ id, gid: '0' })]
}

async function loadSheet(name) {
  const urls = await urlsFor(name)
  let lastError
  for (const url of urls) {
    try {
      return csvToObjects(await fetchCsv(url, TAB_NAMES[name]))
    } catch (err) {
      lastError = err
    }
  }
  throw lastError
}

export const sheetsAdapter = {
  id: 'sheets',
  label: 'Google Sheets (public CSV)',

  async fetchStudents() {
    return (await loadSheet('students')).map(toStudent)
  },

  async fetchTripSets() {
    const names = SOURCES.filter((n) => n !== 'students')
    const results = await Promise.allSettled(names.map(loadSheet))

    const get = (name) => {
      const r = results[names.indexOf(name)]
      if (r.status === 'fulfilled') return r.value
      // One missing optional tab should not blank the whole trip page.
      console.warn(`[sheets] skipping "${name}":`, r.reason?.message)
      return []
    }

    return {
      trips: get('trips').map(toTrip),
      itinerary: get('itinerary').map(toItineraryRow),
      documents: get('documents').map(toDocument),
      guidelines: get('guidelines').map(toGuideline),
      reminders: get('reminders').map(toReminder),
      travel: get('travel').map(toTravelLeg),
      media: get('media').map(toMedia),
    }
  },
}
