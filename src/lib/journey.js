/**
 * Which vehicle a grade travels in, and whether this reader wants motion at all.
 *
 * It was the engine of a full-screen ride between the grade card and the trip
 * page; that overlay was removed on 2026-10-17 ("I want the animation on the
 * pages, not between them"). What survives is the vehicle choice — still used by
 * the badge on the pick card — and the one reduced-motion gate the whole layer
 * reads.
 *
 * Nothing here invents trip content. The vehicle is a *decoration* chosen from
 * words the school has already typed into the sheet — "flight", "train", "bus" —
 * and where they have typed none, from the grade's age, which is the school's own
 * pattern (the little ones go by road, the seniors by rail). It is never shown as
 * a fact: no screen says "you are travelling by train" on the strength of this.
 * The Travel tab, which reads the sheet, remains the only place that says how a
 * child actually gets there.
 */

export const VEHICLES = ['train', 'bus', 'plane', 'boat']

const HINTS = [
  [/\b(flight|flights|air\s*india|indigo|aeroplane|airplane|airport|by\s*air|plane)\b/i, 'plane'],
  [/\b(train|rail|railway|express|superfast|sf|junction|platform|coach\s*\/\s*seat)\b/i, 'train'],
  [/\b(ferry|boat|cruise|jetty|houseboat)\b/i, 'boat'],
  [/\b(bus|coach|volvo|by\s*road|road\s*journey)\b/i, 'bus'],
]

/**
 * `text` is anything the sheet gave us for this trip — the travel cell, the trip
 * name, the itinerary. First hint wins, in the order above: a trip that flies out
 * and takes a coach to the hotel is a flight, which is how a parent would describe it.
 */
export function vehicleFor(gradeId, text = '') {
  const s = String(text || '')
  for (const [re, v] of HINTS) if (re.test(s)) return v
  return juniorGrade(gradeId) ? 'bus' : 'train'
}

function juniorGrade(id) {
  if (id === 'jk' || id === 'sk') return true
  const m = /^g(\d{1,2})$/.exec(String(id || ''))
  return m ? Number(m[1]) <= 5 : false
}

/**
 * Asked once per render rather than subscribed — the same call `TripPage` already
 * makes, and for the same reason: a listener per animated element on a page that
 * may hold dozens of them is not worth the one setting change it would catch.
 *
 * Every animation in this layer is gated on it. With motion reduced the journey
 * overlay does not play at all — it resolves immediately — so nobody waits on a
 * screen they cannot tolerate.
 */
export function reducedMotion() {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )
}
