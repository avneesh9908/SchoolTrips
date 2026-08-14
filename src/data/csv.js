/**
 * Minimal RFC4180 parser. Google's CSV export quotes any cell containing a
 * comma, newline or quote, and escapes an inner quote by doubling it — so a
 * naive split(',') mangles addresses and multi-line overview text.
 */
function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false

  const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  for (let i = 0; i < src.length; i++) {
    const c = src[i]

    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++ }
        else quoted = false
      } else cell += c
      continue
    }

    if (c === '"') quoted = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else cell += c
  }
  row.push(cell)
  rows.push(row)

  return rows.filter((r) => r.some((v) => v.trim() !== ''))
}

/**
 * Headers are lower-cased and stripped of spaces and punctuation so
 * "Father Name", "father_name" and "FatherName" all land on `fathername` —
 * the school edits these headers freely and we can't stop them.
 */
export function normalizeKey(header) {
  return String(header).trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Where a row carries the URLs behind its cells (see `xlsxSheet.js`). It lives
 * on the row rather than beside it so it survives every rekeying the app does —
 * which is why `normalizeRow` has to pass it through untouched: normalized, the
 * key would become "links" and could collide with a real column of that name.
 */
export const LINKS = '__links'

/** Rekeys an already-parsed object so it matches what csvToObjects produces. */
export function normalizeRow(obj) {
  const o = {}
  for (const [k, v] of Object.entries(obj)) {
    if (k === LINKS) { o[LINKS] = v; continue }
    const key = normalizeKey(k)
    if (key) o[key] = typeof v === 'string' ? v.trim() : v
  }
  return o
}

/** First row becomes the keys. */
export function csvToObjects(text) {
  const rows = parseCsv(text)
  if (rows.length < 2) return []

  const keys = rows[0].map(normalizeKey)

  return rows.slice(1).map((r) => {
    const o = {}
    keys.forEach((k, i) => { if (k) o[k] = (r[i] ?? '').trim() })
    return o
  })
}

/** Reads the first header alias that is actually present. */
export function pick(row, ...aliases) {
  for (const a of aliases) {
    const k = normalizeKey(a)
    if (row[k] !== undefined && row[k] !== '') return row[k]
  }
  return ''
}

/**
 * Reads *every* alias present, de-duplicated. Real rosters carry more than one
 * way to reach a family — a father's mobile and a mother's mobile — and any of
 * them should work as a login.
 */
export function collectAll(row, ...aliases) {
  const out = []
  for (const a of aliases) {
    const v = row[normalizeKey(a)]
    if (v !== undefined && v !== '' && !out.includes(v)) out.push(v)
  }
  return out
}
