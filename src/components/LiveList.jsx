import { useEffect, useState } from 'react'
import { describeDoc } from '../lib/docPreview'
import { parseCsv } from '../data/csv'

/**
 * A spreadsheet tab rendered as a table by this app, rather than framed from Google.
 *
 * Why not an iframe: the school's list carries a merged title cell across the top, so
 * Google's own rendering gave column A the width of "Final List of students for G7
 * Educational trip to Rajasthan (Batch 1)" and left Student Name, Section and Gender
 * squeezed into what was left (their screenshot, 2026-08-20). A cross-origin frame cannot
 * be styled from here — no CSS, no column widths, nothing — so the only way to control the
 * layout is to hold the data.
 *
 * `gviz/tq?tqx=out:csv&gid=…` is the source: it honours the tab, and it answers with
 * `Access-Control-Allow-Origin` echoing the caller, so a browser fetch works from any
 * origin (verified against localhost). The same endpoint family the sheets adapter already
 * reads, so this adds no new dependency on Google.
 *
 * The file must be shared "anyone with the link", exactly as for every other document on
 * this page. When it is not, the fetch fails and the card falls back to its link.
 */
export function LiveList({ url }) {
  const [state, setState] = useState({ status: 'loading' })

  useEffect(() => {
    const { kind, id } = describeDoc(url)
    const gid = (String(url || '').match(/[?#&]gid=(\d+)/) || [])[1]
    if (kind !== 'sheet' || !id) {
      setState({ status: 'error' })
      return
    }

    const src =
      `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv` +
      (gid ? `&gid=${gid}` : '')

    let live = true
    fetch(src)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status))
        return res.text()
      })
      .then((text) => {
        if (!live) return
        // Google answers a permission failure with an HTML sign-in page, not an error.
        if (/^\s*</.test(text)) throw new Error('not shared')
        setState({ status: 'ready', rows: parseCsv(text) })
      })
      .catch(() => live && setState({ status: 'error' }))

    return () => {
      live = false
    }
  }, [url])

  if (state.status === 'loading') return <div className="live-list is-note">Loading the list…</div>
  if (state.status === 'error') {
    return <div className="live-list is-note">The list could not be read here — open it below.</div>
  }

  const [head = [], ...body] = state.rows
  const { title, first } = splitMergedHeading(head[0])
  const headers = [first, ...head.slice(1)]

  /** A row carrying nothing but its serial number has not been filled in yet. */
  const filled = body.filter((r) => r.slice(1).some((c) => c.trim() !== ''))

  /**
   * **The table, and nothing but the table** (2026-08-20: the school removed both the
   * sheet's own title line and the "names have not been added yet" note). The card already
   * says which batch and which dates this list is for, so the title repeated it at greater
   * length, and the note told a reader something the empty rows show them anyway.
   *
   * The title is still SPLIT off the first header — see `splitMergedHeading` — it is simply
   * discarded now rather than displayed. That split is what keeps the serial column narrow,
   * so it must not be removed along with the caption.
   *
   * All rows are shown while none are filled, so the empty list still previews; once names
   * arrive the unfilled tail is dropped, because by then the blanks carry nothing.
   */
  const shown = filled.length ? filled : body

  return (
    <div className="live-list">
      {shown.length > 0 && (
        <div className="live-list-scroll">
          <table>
            <thead>
              <tr>
                {headers.map((h, i) => (
                  <th key={i} className={i === 0 ? 'is-sr' : undefined}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => (
                <tr key={i}>
                  {headers.map((_, c) => (
                    <td key={c} className={c === 0 ? 'is-sr' : undefined}>{r[c] || ''}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/**
 * A merged title above the header row arrives glued to the first column's name:
 * "Final List of students … (Batch 1) Sr.No". Split it so the long half becomes the
 * table's caption and the short half stays the column heading — which is the whole reason
 * column A was three times wider than it needed to be.
 *
 * Only a recognised serial heading is split off. Anything else is left exactly as typed,
 * so a sheet without a merged title is untouched.
 */
function splitMergedHeading(raw) {
  const text = String(raw || '').trim()
  const m = text.match(/^(.*\S)\s+(sr\.?\s*no\.?|s\.?\s*no\.?|serial\s*no\.?|#)$/i)
  if (!m) return { title: '', first: text }
  return { title: m[1], first: m[2] }
}
