import { config } from '../config'
import { csvToObjects } from './csv'
import { parseSheetRef, csvExportUrl, parsePublishedRef, publishedCsvUrl, publishedXlsxUrl } from '../lib/sheetUrl'
import { xlsxToObjects } from './xlsxSheet'
import { isAdminEmailLocally } from '../auth/roles.js'
import { looksLikeTripApp } from './tripApp'
import {
  toStudent, toTrip, toItineraryRow, toDocument,
  toGuideline, toReminder, toTravelLeg, toMedia,
} from './normalize'
import { matchStudent } from '../lib/identity.js'

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

function localUrl(name) {
  const { csvBase, csvUrls } = config()
  // A per-source URL wins, so one source can come from a proxied live feed
  // while the rest stay on local files.
  if (csvUrls && csvUrls[name]) return csvUrls[name]
  return csvBase ? `${csvBase.replace(/\/$/, '')}/${name}.csv` : null
}

/**
 * There are exactly two sources in this app: the roster behind /api/lookup for
 * login, and ONE spreadsheet for everything a parent reads. Tabs inside that
 * spreadsheet are addressed by name.
 *
 * The old per-source spreadsheet ids, the Settings index tab and Drive-folder
 * discovery were removed on 2026-08-12 — five ways to point at content meant
 * five ways for it to go quietly missing.
 *
 * Returns a list: the first entry is tried, the rest are fallbacks.
 */
async function urlsFor(name) {
  const local = localUrl(name)
  if (local) return [local]

  const { sheetId, publishedId, gids } = config()

  // A published snapshot wins: choosing it is a deliberate decision to keep the
  // document itself Restricted, so it must not silently fall back to gviz —
  // that would 401 and read as "the sheet is broken".
  const published = parsePublishedRef(publishedId)
  if (published) {
    return [publishedCsvUrl({ id: published.id, gid: gids[name] || published.gid })]
  }

  const master = parseSheetRef(sheetId)
  if (!master) {
    throw new Error('No spreadsheet configured. Paste the trip spreadsheet link into config.json.')
  }
  return withFallback(master.id, gids[name], TAB_NAMES[name])
}

/**
 * A file dedicated to one source may have its tab left as "Sheet1", so fall
 * back to the first tab when addressing by name finds nothing.
 */
function withFallback(id, gid, tabName) {
  if (gid) return [csvExportUrl({ id, gid })]
  return [csvExportUrl({ id, tabName }), csvExportUrl({ id, gid: '0' })]
}

/**
 * The workbook export of a published sheet, which is the only export that keeps
 * the school's smart-chip links. Read in preference to the CSV, and only for a
 * published document — a local CSV fixture or a gviz URL has no workbook.
 */
function workbookUrlFor(name) {
  if (localUrl(name)) return null
  const published = parsePublishedRef(config().publishedId)
  return published ? publishedXlsxUrl({ id: published.id }) : null
}

async function loadSheet(name) {
  const workbook = workbookUrlFor(name)
  if (workbook) {
    try {
      return await xlsxToObjects(workbook)
    } catch (err) {
      // Never fatal: an old browser, a withdrawn publish or a shape this reader
      // does not understand must still leave the page working off the CSV — it
      // only costs the links, which is where this started.
      console.warn(`[sheets] workbook read failed for "${name}", falling back to CSV:`, err.message)
    }
  }

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

  /**
   * Resolves a login. With `rosterApiUrl` set this happens server-side and the
   * roster never enters the browser — the only safe arrangement for a feed
   * carrying addresses and dates of birth. Without it, falls back to matching a
   * client-side roster, which is fine for demo data and wrong for real data.
   */
  async lookup({ kind, value }) {
    const { rosterApiUrl } = config()
    if (!rosterApiUrl) {
      if (kind === 'email' && isAdminEmailLocally(value)) {
        return { role: 'admin', students: [] }
      }
      const roster = await this.fetchStudents()
      // Same matcher as the server, so the grade rule cannot differ between the
      // two paths (a parent contact opens any grade; a student's own address only
      // Grade 7 and above).
      const matched = roster
        .map((s) => ({ student: s, as: matchStudent(s, { kind, value }) }))
        .filter((m) => m.as)
      return {
        role: 'parent',
        signedInAs: matched[0]?.as || 'parent',
        students: matched.map((m) => m.student),
      }
    }

    const res = await fetch(rosterApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, value }),
    })
    if (res.status === 404) return { role: 'parent', students: [] }
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}))
      throw new Error(detail.error || `Sign-in service returned HTTP ${res.status}.`)
    }
    const data = await res.json()
    return {
      role: data.role || 'parent',
      signedInAs: data.signedInAs || 'parent',
      // The server sends only id/name/grade/section; fill the shape the app expects.
      students: (data.students || []).map((s) => ({
        ...s,
        parentName: data.parentName || '',
        emails: [],
        phones: [],
      })),
    }
  },

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

    // The school's own "Trip app" sheet is one flat tab, not eight. Detected by
    // its headers rather than by a config flag, so pointing at either shape
    // just works.
    const first = get('trips')
    if (looksLikeTripApp(first)) {
      return { flat: first }
    }

    return {
      trips: first.map(toTrip),
      itinerary: get('itinerary').map(toItineraryRow),
      documents: get('documents').map(toDocument),
      guidelines: get('guidelines').map(toGuideline),
      reminders: get('reminders').map(toReminder),
      travel: get('travel').map(toTravelLeg),
      media: get('media').map(toMedia),
    }
  },
}
