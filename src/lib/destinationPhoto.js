/**
 * An illustrative photo of the destination, looked up on Wikipedia.
 *
 * The school's own trip photos are smart chips in the sheet and export without
 * their URLs, so the hero had nothing to show but a flat colour. A picture of
 * the place is not the school's picture, so it is always credited and never
 * presented as a trip photo — the parent's real album lives in the Photos tab.
 *
 * Wikipedia's action API is used rather than the REST summary endpoint because
 * `piprop=thumbnail&pithumbsize` returns a hero-sized image, and
 * `generator=search` tolerates the school's spelling ("Panchmarhi" resolves to
 * Pachmarhi). It sends `Access-Control-Allow-Origin: *` with `origin=*`, so the
 * browser can call it directly with no key and no proxy.
 */

const cache = new Map()

/** Words the destination cell carries that are not places. */
const NOISE = /^(grade|class|batch|trip|and|the|to|via|amp)$/i

/**
 * "Jaipur-Abhaneri-Ranthambore" -> ['Jaipur', 'Abhaneri', 'Ranthambore'].
 * Searched in order, first hit wins: the first place named is the one the trip
 * is about.
 */
function placeCandidates(destination) {
  return String(destination || '')
    .split(/[-–—,/&·|]+|\band\b/i)
    .map((s) => s.replace(/\(.*?\)/g, '').trim())
    .filter((s) => s.length > 2 && !/\d/.test(s) && !NOISE.test(s))
}

async function search(place) {
  const url =
    'https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*' +
    '&generator=search&gsrlimit=1&prop=pageimages&piprop=thumbnail' +
    `&pithumbsize=1600&gsrsearch=${encodeURIComponent(place)}`

  const res = await fetch(url)
  if (!res.ok) return null
  const data = await res.json()
  const page = Object.values(data?.query?.pages || {})[0]
  const src = page?.thumbnail?.source
  if (!src) return null
  return {
    url: src,
    title: page.title,
    pageUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
  }
}

/**
 * Resolves to a photo or to null — a lookup that fails is not an error worth
 * showing a parent, the hero just stays plain.
 */
export async function fetchDestinationPhoto(destination) {
  const key = String(destination || '').trim().toLowerCase()
  if (!key) return null
  if (cache.has(key)) return cache.get(key)

  let found = null
  for (const place of placeCandidates(destination)) {
    try {
      found = await search(place)
    } catch {
      found = null
    }
    if (found) break
  }
  cache.set(key, found)
  return found
}
