import { useEffect, useState } from 'react'
import { describeDoc } from '../lib/docPreview'
import { parseCsv } from '../data/csv'
import { useAuth } from '../auth/AuthContext'
import { config } from '../config'
import { safeColumns } from '../lib/studentListColumns'

/**
 * A private list, read by OUR server with the school's service account (2026-11-28:
 * "give all persons those are login this app"). The session's `listPass` proves this
 * browser signed in; the server re-checks it, reads the sheet and drops the hidden
 * columns. Same origin as `/api/lookup`, wherever `rosterApiUrl` points.
 */
function readThroughServer(listPass, id, gid) {
  const base = config().rosterApiUrl || '/api/lookup'
  const endpoint = new URL('/api/student-list', new URL(base, window.location.href)).toString()
  return fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pass: listPass, id, gid: gid || '' }),
  }).then(async (res) => {
    if (!res.ok) throw new Error(String(res.status))
    return (await res.json()).rows || []
  })
}

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
/**
 * `onResolved(namesOnPage)` reports upward whether this list actually shows any
 * names, so the card can decide about its "Open the student list" link. The
 * school's point (2026-08-21): *"if names are going to be displayed on web page
 * than no need for link ... either of the the two is needed"*. Called with 0 for
 * a list with no names yet and for a read failure — both are cases where the link
 * IS the answer — and not called at all while loading, so no link flickers in and
 * out under the table.
 */
export function LiveList({ url, onResolved }) {
  const [state, setState] = useState({ status: 'loading' })
  const { session } = useAuth()
  const listPass = session?.listPass || ''

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
        // Google answers a permission failure with an HTML sign-in page, not an error.
        if (/^\s*</.test(text)) throw new Error('not shared')
        return parseCsv(text)
      })
      // Not public: the server reads it for this signed-in family.
      .catch(() => {
        if (!listPass) throw new Error('no pass')
        return readThroughServer(listPass, id, gid)
      })
      // Same hidden columns on both paths, so a public list cannot show more.
      .then((rows) => live && setState({ status: 'ready', rows: safeColumns(rows) }))
      .catch(() => live && setState({ status: 'error' }))

    return () => {
      live = false
    }
  }, [url, listPass])

  /**
   * Must sit above the early returns: a hook cannot run conditionally, and the
   * loading and error branches below return before this line would otherwise be
   * reached.
   */
  useEffect(() => {
    if (!onResolved || state.status === 'loading') return
    onResolved(state.status === 'error' ? 0 : filledCount(state.rows))
  }, [state, onResolved])

  if (state.status === 'loading') return <div className="live-list is-note">Loading the list…</div>
  if (state.status === 'error') {
    return <div className="live-list is-note">The list could not be read here — open it below.</div>
  }

  const [rawHead = [], ...rawBody] = state.rows
  /** A row carrying nothing but its serial number has not been filled in yet. */
  const rawFilled = rawBody.filter((r) => r.slice(1).some((c) => String(c ?? '').trim() !== ''))

  /**
   * Columns with no header AND no value in any filled row are dropped (2026-11-28). The
   * junior lists carry a dozen blank columns to the right of Section; Google's own view
   * drew every one as an empty grid, which is what the school called "ui is not good".
   */
  const keep = rawHead
    .map((_, c) => c)
    .filter((c) => String(rawHead[c] ?? '').trim() || rawFilled.some((r) => String(r[c] ?? '').trim()))
  const head = keep.map((c) => String(rawHead[c] ?? ''))
  const filled = rawFilled.map((r) => keep.map((c) => String(r[c] ?? '')))

  const { first } = splitMergedHeading(head[0])
  const headers = [first, ...head.slice(1)]

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
   * **A list with no names renders NOTHING**, changed 2026-08-21. It used to show
   * every empty row so the list still "previewed", and the school read exactly
   * that as a fault: *"there is blank page on the webpage"*. Fifteen rows of
   * nothing but serial numbers looks broken, and the note that once explained it
   * was removed on 2026-08-20 at their own request — so there was nothing left to
   * tell a reader why. The card's Open link takes over instead; see `onResolved`.
   */
  const shown = filled

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
 * How many rows carry anything but their serial number.
 *
 * Shared by the render and by `onResolved` so the two cannot disagree about
 * whether this list has names — which would show the table and the link together,
 * or neither.
 */
function filledCount(rows) {
  const [, ...body] = rows || []
  return body.filter((r) => r.slice(1).some((c) => String(c ?? '').trim() !== '')).length
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
