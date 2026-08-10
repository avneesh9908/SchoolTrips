import { useEffect, useState } from 'react'
import { getAdapter, isServerEnforced } from './index'
import { assembleTrip } from './normalize'
import { expandFolderDocuments } from '../lib/drive'

/**
 * Loads the trip for one grade.
 *
 * With the api adapter the backend has already filtered to the grade it
 * authorised. With mock/sheets the whole set arrives and we slice it here —
 * which is why the caller must check `canAccessGrade` before mounting this.
 */
export function useTrip(gradeId, { enabled = true } = {}) {
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
        const trip = isServerEnforced() && sets.trip ? sets.trip : assembleTrip(gradeId, sets)
        if (!trip) return { status: 'ready', trip: null, error: null }

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
  }, [gradeId, enabled, attempt])

  return { ...state, retry: () => setAttempt((n) => n + 1) }
}
