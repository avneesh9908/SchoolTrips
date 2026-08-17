import { useEffect, useState } from 'react'
import { getAdapter, isServerEnforced } from './index'
import { assembleTrip } from './normalize'
import { assembleTripApp } from './tripApp'
import { expandFolderDocuments } from '../lib/drive'

/**
 * Loads the trip for one grade.
 *
 * With the api adapter the backend has already filtered to the grade it
 * authorised. With mock/sheets the whole set arrives and we slice it here —
 * which is why the caller must check `canAccessGrade` before mounting this.
 */
export function useTrip(gradeId, { enabled = true, section = '' } = {}) {
  const [state, setState] = useState({ status: 'idle', trip: null, error: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!enabled || !gradeId) return
    let cancelled = false

    setState({ status: 'loading', trip: null, error: null })

    getAdapter()
      .fetchTripSets(gradeId)
      .then(async (sets) => {
        if (cancelled) return
        const assembled =
          isServerEnforced() && sets.trip
            ? sets.trip
            : sets.flat
              ? assembleTripApp(gradeId, sets.flat, { section })
              : assembleTrip(gradeId, sets)
        if (!assembled) return { status: 'ready', trip: null, error: null }

        /**
         * The guideline text fallback is NOT applied. Turned off 2026-08-14 on the
         * school's instruction — "in sheet have links and links have chips, show
         * the chips … don't write according to you".
         *
         * It was doing the opposite of that: for a chip-only cell it injected
         * `public/trip-guidelines.json`'s text *and dropped that column's poster
         * card*, so production printed text nobody in the sheet had written and
         * hid the school's own poster. `guidelineFallback.js` and
         * `public/trip-guidelines.json` are left in place, unused, so the decision
         * can be reversed by restoring this one call.
         */
        const trip = assembled

        // A Documents row may point at a whole folder; turn it into one card
        // per file. No-ops without a Drive key, and never fails the page.
        const documents = await expandFolderDocuments(trip.documents)
        return { status: 'ready', trip: { ...trip, documents }, error: null }
      })
      .then((next) => { if (!cancelled && next) setState(next) })
      .catch((err) => {
        if (cancelled) return
        setState({ status: 'error', trip: null, error: err.message || String(err) })
      })

    return () => { cancelled = true }
  }, [gradeId, enabled, section, attempt])

  return { ...state, retry: () => setAttempt((n) => n + 1) }
}
