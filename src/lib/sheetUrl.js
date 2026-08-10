/**
 * Accepts whatever the school pastes: a full spreadsheet URL, a URL with a
 * #gid, or a bare file id. Everything downstream deals in {id, gid}.
 */
export function parseSheetRef(input) {
  if (!input) return null
  const s = String(input).trim()
  if (!s) return null

  const idMatch = s.match(/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  if (idMatch) {
    const gid = s.match(/[#&?]gid=(\d+)/)
    return { id: idMatch[1], gid: gid ? gid[1] : null }
  }

  // A bare id has no slashes; anything else is a URL we don't recognise.
  if (!s.includes('/')) return { id: s, gid: null }
  return null
}

const GVIZ = (id) => `https://docs.google.com/spreadsheets/d/${id}/gviz/tq`

/**
 * A tab can be addressed by name, which is why the school never has to hunt
 * for gid numbers. A gid still wins when one is given, since a renamed tab
 * keeps its gid.
 */
export function csvExportUrl({ id, gid, tabName }) {
  // Built by hand rather than with URLSearchParams, which would percent-encode
  // the colon in "out:csv".
  const parts = ['tqx=out:csv']
  if (gid) parts.push(`gid=${encodeURIComponent(gid)}`)
  else if (tabName) parts.push(`sheet=${encodeURIComponent(tabName)}`)
  return `${GVIZ(id)}?${parts.join('&')}`
}
