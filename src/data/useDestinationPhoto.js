import { useEffect, useState } from 'react'
import { config } from '../config'
import { fetchDestinationPhoto } from '../lib/destinationPhoto'

/**
 * A credited stand-in photograph of a destination, for a card or banner that has
 * none of the school's own.
 *
 * Shared by the grade picker, the trip picker and the Overview banner so the
 * three cannot drift — and so the in-module cache in `destinationPhoto.js` is
 * hit rather than each place fetching the same place again.
 *
 * `enabled` is the caller's "I have no photograph of my own" — pass `false` when
 * a school photo exists and nothing is fetched at all. A school photo is never
 * replaced.
 *
 * Resolves to null for a destination Wikipedia cannot match, which is the common
 * case for Grade 11's local campsites and is correct: the caller keeps its plain
 * colour rather than showing a photograph of somewhere else.
 */
export function useDestinationPhoto(destination, enabled = true) {
  const [found, setFound] = useState(null)
  const on = enabled && config().autoDestinationPhoto !== false && !!destination

  useEffect(() => {
    if (!on) { setFound(null); return }
    let cancelled = false
    fetchDestinationPhoto(destination)
      .then((r) => { if (!cancelled) setFound(r) })
      // A failed lookup is not worth telling a parent about.
      .catch(() => {})
    return () => { cancelled = true }
  }, [on, destination])

  return on ? found : null
}
