import { useEffect, useState } from 'react'
import { getAdapter } from './index'
import { groupByGrade, looksLikeTripApp } from './tripApp'
import { normalizeGradeId } from '../lib/grades'
import { pick } from './csv'

/**
 * Every grade's trip name, for the picker cards — the school asked for the
 * destination there instead of the words "Trip plan", so a parent recognises
 * their child's trip before opening anything.
 *
 * One fetch covers every card: the content sheet is a single tab holding all
 * grades, and `loadWorkbook` caches it by URL, so this shares the download the
 * trip page would make anyway. A failure is not an error state — the cards fall
 * back to a neutral line, because a name is a nicety and the card must still
 * open the trip.
 */
export function useTripTitles() {
  const [titles, setTitles] = useState(null)

  useEffect(() => {
    let cancelled = false

    Promise.resolve()
      .then(() => getAdapter().fetchTripSets())
      .then((sets) => {
        if (!cancelled) setTitles(titlesFrom(sets))
      })
      .catch((err) => {
        console.warn('[trip titles] could not read trip names for the picker:', err.message)
        if (!cancelled) setTitles({})
      })

    return () => { cancelled = true }
  }, [])

  return titles
}

/** Grade id -> trip name, from either sheet shape. */
export function titlesFrom(sets) {
  const out = {}

  // The school's own shape: one flat tab, the destination on the group's first
  // row (the grade cell is merged, so the rest of the group inherits it).
  if (sets?.flat && looksLikeTripApp(sets.flat)) {
    for (const [gradeId, rows] of groupByGrade(sets.flat)) {
      // EVERY destination, not the first: a grade can travel to more than one
      // place — Grade 11 goes batch-wise to different destinations — and naming
      // only the first would put one group's trip on the card both groups read.
      const names = []
      for (const row of rows) {
        const name = String(pick(row, 'destination', 'place', 'location') || '').trim()
        if (name && !names.includes(name)) names.push(name)
      }
      if (names.length) out[gradeId] = names.join('  ·  ')
    }
    return out
  }

  for (const trip of sets?.trips || []) {
    const gradeId = normalizeGradeId(trip.grade)
    if (gradeId && trip.title && !out[gradeId]) out[gradeId] = trip.title
  }
  return out
}
