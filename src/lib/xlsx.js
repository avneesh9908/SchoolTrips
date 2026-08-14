/**
 * A very small .xlsx reader, written for one job: getting the school's smart-chip
 * links out of the sheet.
 *
 * A Google Sheets smart chip exports to CSV as its display text alone — the URL
 * is simply not in the file, which is why 0 of 22 filled link cells could be
 * opened. **The .xlsx export of the same published sheet keeps every URL**, in
 * `xl/worksheets/_rels/sheetN.xml.rels`, addressed by cell reference. Measured
 * 2026-08-13 against the live published sheet: 22 hyperlinks, including the two
 * photo folders. So the fix for "the links are in the sheet" is to read the
 * workbook instead of the CSV.
 *
 * No dependency: a .xlsx is a ZIP of XML, the browser inflates with
 * `DecompressionStream` and parses with `DOMParser`. Anything unexpected throws,
 * and the caller falls back to the CSV path.
 */

const SIG_EOCD = 0x06054b50
const SIG_CENTRAL = 0x02014b50

/** True when this browser can inflate — Chrome 103+, Safari 16.4+, Firefox 113+. */
export function canReadXlsx() {
  return typeof DecompressionStream === 'function'
}

/**
 * Reads one worksheet into rows of `{ text, url }`, indexed the way the sheet
 * itself is: `rows[0]` is spreadsheet row 1, and a gap in the sheet is a gap
 * here, so a cell reference like "L3" always lands in the right place.
 */
export async function readSheet(buffer, { sheetIndex = 0 } = {}) {
  const files = await unzip(buffer)
  const xml = (path) => {
    const bytes = files.get(path)
    return bytes ? new DOMParser().parseFromString(new TextDecoder().decode(bytes), 'application/xml') : null
  }

  const sheetPaths = [...files.keys()]
    .filter((p) => /^xl\/worksheets\/sheet\d+\.xml$/.test(p))
    .sort((a, b) => sheetNumber(a) - sheetNumber(b))
  const sheetPath = sheetPaths[sheetIndex]
  if (!sheetPath) throw new Error('No worksheet in the workbook')

  const strings = sharedStrings(xml('xl/sharedStrings.xml'))
  const links = hyperlinks(
    xml(sheetPath),
    xml(sheetPath.replace('xl/worksheets/', 'xl/worksheets/_rels/') + '.rels')
  )

  return cells(xml(sheetPath), strings, links)
}

function sheetNumber(path) {
  return Number(path.match(/sheet(\d+)\.xml$/)[1])
}

/** `<si>` entries; a run-formatted string is several `<t>` that join up. */
function sharedStrings(doc) {
  if (!doc) return []
  return [...doc.getElementsByTagName('si')].map((si) =>
    [...si.getElementsByTagName('t')].map((t) => t.textContent).join('')
  )
}

/** Cell reference → URL, resolved through the worksheet's relationship file. */
function hyperlinks(sheet, rels) {
  const out = new Map()
  if (!sheet || !rels) return out

  const targets = new Map()
  for (const rel of rels.getElementsByTagName('Relationship')) {
    targets.set(rel.getAttribute('Id'), rel.getAttribute('Target'))
  }

  for (const link of sheet.getElementsByTagName('hyperlink')) {
    // The r:id attribute is namespaced; getAttribute with the prefix is what
    // works across parsers here.
    const id = link.getAttribute('r:id') || link.getAttributeNS?.(
      'http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'
    )
    const ref = link.getAttribute('ref')
    const target = id && targets.get(id)
    // A hyperlink can cover a range ("L3:L4"); the first cell carries it, which
    // is also the row a merged cell's value is on.
    if (ref && target) out.set(ref.split(':')[0], target)
  }
  return out
}

function cells(sheet, strings, links) {
  const rows = []
  if (!sheet) return rows

  for (const row of sheet.getElementsByTagName('row')) {
    const r = Number(row.getAttribute('r'))
    if (!r) continue
    const line = rows[r - 1] || (rows[r - 1] = [])

    for (const c of row.getElementsByTagName('c')) {
      const ref = c.getAttribute('r')
      if (!ref) continue
      const col = columnIndex(ref)
      line[col] = {
        text: cellText(c, strings),
        url: links.get(ref) || '',
      }
    }
  }

  // Gaps are real rows in the sheet, so they must stay addressable.
  for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = []
  return rows
}

function cellText(c, strings) {
  const type = c.getAttribute('t')
  if (type === 's') {
    const v = c.getElementsByTagName('v')[0]
    return (v && strings[Number(v.textContent)]) || ''
  }
  if (type === 'inlineStr') {
    return [...c.getElementsByTagName('t')].map((t) => t.textContent).join('')
  }
  const v = c.getElementsByTagName('v')[0]
  return v ? v.textContent : ''
}

/** "L3" → 11, "AA7" → 26. */
export function columnIndex(ref) {
  const letters = ref.match(/^[A-Z]+/)[0]
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

/* ---------------------------------------------------------------- the ZIP */

async function unzip(buffer) {
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)
  const eocd = findEocd(view)
  const count = view.getUint16(eocd + 10, true)
  let offset = view.getUint32(eocd + 16, true)

  const files = new Map()
  for (let i = 0; i < count; i++) {
    if (view.getUint32(offset, true) !== SIG_CENTRAL) throw new Error('Damaged workbook')
    const method = view.getUint16(offset + 10, true)
    const compressed = view.getUint32(offset + 20, true)
    const nameLen = view.getUint16(offset + 28, true)
    const extraLen = view.getUint16(offset + 30, true)
    const commentLen = view.getUint16(offset + 32, true)
    const localAt = view.getUint32(offset + 42, true)
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLen))

    // The local header repeats the name and extra field, and its lengths are
    // the ones that count — the central copies can differ.
    const localNameLen = view.getUint16(localAt + 26, true)
    const localExtraLen = view.getUint16(localAt + 28, true)
    const start = localAt + 30 + localNameLen + localExtraLen
    const raw = bytes.subarray(start, start + compressed)

    if (name.endsWith('.xml') || name.endsWith('.rels')) {
      files.set(name, method === 0 ? raw : await inflate(raw))
    }
    offset += 46 + nameLen + extraLen + commentLen
  }
  return files
}

function findEocd(view) {
  // The comment field is almost always empty, so the record sits at the end;
  // scan back far enough to survive one anyway.
  const min = Math.max(0, view.byteLength - 66000)
  for (let i = view.byteLength - 22; i >= min; i--) {
    if (view.getUint32(i, true) === SIG_EOCD) return i
  }
  throw new Error('Not a workbook')
}

async function inflate(raw) {
  const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}
