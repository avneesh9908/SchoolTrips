import { normalizeKey, LINKS, SOURCE } from './csv.js'
import { canReadXlsx, readSheet, readSheets } from '../lib/xlsx.js'

/**
 * Reads the published spreadsheet as a workbook rather than as CSV, so the
 * school's smart-chip links survive.
 *
 * Why this exists: a smart chip exports to CSV as its display text with the URL
 * dropped, so every orientation deck, itinerary and photo folder in the sheet
 * arrived unopenable. The .xlsx export of the same published document keeps all
 * of them. Measured against the live sheet on 2026-08-13: 22 links, CSV 0.
 *
 * Rows come back in the same shape `csvToObjects` produces, plus a `LINKS`
 * entry holding the URL for any cell that has one, keyed by the same normalized
 * header. Everything downstream keeps reading `row.picfolderlink` for the text
 * and can now ask for its link as well.
 */

export { LINKS }

const cache = new Map()

/** One download per URL per page load; eight sources read the same workbook. */
export function loadWorkbook(url) {
  if (!cache.has(url)) cache.set(url, fetchWorkbook(url))
  return cache.get(url)
}

async function fetchWorkbook(url) {
  if (!canReadXlsx()) throw new Error('This browser cannot read the workbook export.')
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Could not read the spreadsheet (HTTP ${res.status}).`)
  const buffer = await res.arrayBuffer()
  const head = new Uint8Array(buffer, 0, Math.min(2, buffer.byteLength))
  // A sheet that is not published answers with a sign-in page, not a workbook.
  if (head[0] !== 0x50 || head[1] !== 0x4b) {
    throw new Error('The spreadsheet is not published — Google returned a page instead of a workbook.')
  }
  return buffer
}

/** The workbook's first worksheet, as row objects with their links attached. */
export async function xlsxToObjects(url, { sheetIndex = 0 } = {}) {
  return objectsFrom(await readSheet(await loadWorkbook(url), { sheetIndex }), sheetIndex)
}

/**
 * EVERY worksheet, as one array of row objects per tab, in tab order.
 *
 * The school's content sheet is two tabs: "SS" holds Grade 7 upwards and "JS "
 * holds Senior KG to Grade 6, which is why the junior half of the school had no
 * trip on the site — every read path took the first worksheet and stopped. Each
 * tab keeps its OWN header row, because the two do not match (the junior tab has
 * no Student List column and calls Header Text "Starting Text"), and every row
 * is tagged with `SOURCE` so nothing can leak from one tab into the other.
 *
 * A tab with no header row of its own is dropped rather than thrown: a workbook
 * may well carry a scratch or notes tab, and one of those must not take the
 * whole site down. The first tab is the exception — it is the content, so if it
 * cannot be read the caller must hear about it.
 */
export async function xlsxAllToObjects(url) {
  const sheets = await readSheets(await loadWorkbook(url))
  return sheets.map((rows, index) => {
    if (index === 0) return objectsFrom(rows, index)
    try {
      return objectsFrom(rows, index)
    } catch (err) {
      console.warn(`[sheets] skipping worksheet ${index + 1}: ${err.message}`)
      return []
    }
  })
}

/** One worksheet's cells into row objects, keyed by its own header row. */
function objectsFrom(rows, sheetIndex) {
  const headerAt = rows.findIndex((r) => filled(r) >= 2)
  if (headerAt < 0) throw new Error('The spreadsheet has no header row.')
  const keys = rows[headerAt].map((c) => normalizeKey(c?.text || ''))

  return rows
    .slice(headerAt + 1)
    .filter((r) => filled(r) > 0)
    .map((r) => {
      const out = { [LINKS]: {}, [SOURCE]: sheetIndex }
      keys.forEach((key, i) => {
        if (!key) return
        out[key] = String(r[i]?.text ?? '').trim()
        if (r[i]?.url) out[LINKS][key] = r[i].url
      })
      return out
    })
}

function filled(row) {
  return (row || []).filter((c) => c && String(c.text).trim() !== '').length
}

/** The URL behind a cell, for the first alias the row actually carries. */
export function linkFor(row, ...aliases) {
  const links = row?.[LINKS]
  if (!links) return ''
  for (const alias of aliases) {
    const key = normalizeKey(alias)
    if (links[key]) return links[key]
  }
  return ''
}
