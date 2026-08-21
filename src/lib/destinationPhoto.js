/**
 * An illustrative photo of the destination, looked up on Wikipedia.
 *
 * REINSTATED 2026-08-21, restored from the commit that deleted it. It was
 * removed on 2026-08-14 at the school's instruction, when they said they would
 * supply real photographs; a term later only Grade 7 has one, and they asked for
 * this back: "grade 7 have picture other grade not have picture on overview i
 * want to like not have any picture to take on the internet releate to trip
 * area".
 *
 * The reason it was removed still holds, so it is contained rather than
 * reverted wholesale:
 *   - it NEVER replaces a school photo. `config.tripPhotos` wins outright.
 *   - it is always CREDITED on the image, and the credit says the picture is of
 *     the place and not of the trip. A parent must not read a stock photo of
 *     Pachmarhi as a picture of their child standing in it.
 *   - `config.autoDestinationPhoto` turns the whole thing off from a deployed
 *     JSON file, with no rebuild, if the school changes its mind again.
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

/**
 * Scores how well a page title answers the place we searched for.
 *
 * This guard is the difference between a useful stand-in and a wrong one.
 * Wikipedia's search always returns *something*: "Kevdi" came back as "Mandvi,
 * Surat district" and "Kilad" as "Vansda National Park" — neither is the place,
 * and a photograph of the wrong town on a trip page is worse than the plain
 * grade colour it replaces. So a title that does not contain the searched word
 * scores 0 and is refused.
 *
 * Above that, an exact title beats a leading one beats a mention: for "Manali"
 * that prefers "Manali, Himachal Pradesh" over "Leh-Manali Highway", which is a
 * road rather than the valley the trip is about.
 */
function titleScore(title, place) {
  const t = String(title || '').toLowerCase()
  const p = String(place || '').toLowerCase()
  if (!t.includes(p)) return 0
  if (t === p) return 3
  if (t.startsWith(p)) return 2
  return 1
}

/**
 * Forces a Wikimedia file URL down to a bounded-width thumbnail.
 *
 * `pithumbsize` is a REQUEST, not a promise: when the original is narrower than
 * the size asked for, the API hands back the original file and marks it
 * `thumbnail_unscaled`. Jabalpur's lead image came back that way at **2.25 MB**
 * — for a banner, from a US-West origin, to parents on phones in India. That is
 * the same bandwidth reasoning that made `server.js` gzip its responses.
 *
 * Commons serves any file at a given width by path:
 *   /commons/4/48/FILE.jpg  ->  /commons/thumb/4/48/FILE.jpg/1200px-FILE.jpg
 * so the bound can be imposed here rather than hoped for. A URL already under
 * /thumb/ is left alone — the API already sized it — and anything not on
 * upload.wikimedia.org passes through.
 *
 * **Never ask for more than the original's width.** Commons refuses to upscale
 * and answers 400 with an HTML error, which is what a naive fixed 1400 did to
 * Jabalpur and Jodhpur: both were unscaled precisely BECAUSE they are narrower
 * than that, so the rewrite asked for a size that cannot exist and the banner
 * broke. The caller passes `min(1400, original.width)`.
 */
function boundedThumb(raw, width) {
  try {
    const u = new URL(raw)
    // The API appends utm_* tracking params that are no use in an <img>.
    u.search = ''
    if (u.hostname !== 'upload.wikimedia.org') return u.toString()
    if (u.pathname.includes('/thumb/')) return u.toString()

    const m = u.pathname.match(/^\/wikipedia\/([^/]+)\/([0-9a-f])\/([0-9a-f]{2})\/(.+)$/)
    if (!m) return u.toString()
    const [, project, a, b, file] = m
    // An SVG has no raster original, so Commons names its thumbnail ".svg.png".
    const name = /\.svg$/i.test(file) ? `${file}.png` : file
    u.pathname = `/wikipedia/${project}/thumb/${a}/${b}/${file}/${width}px-${name}`
    return u.toString()
  } catch {
    return raw
  }
}

async function search(place) {
  const url =
    'https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*' +
    // Six, not one. The response is an OBJECT KEYED BY PAGE ID, so its key order
    // is not search rank — reading the first value took whichever page the id
    // happened to sort to, and for "Manali" that was the one page of the six with
    // no image at all, so the lookup gave up on a place Wikipedia illustrates
    // well. Rank comes from each page's own `index`.
    '&generator=search&gsrlimit=6&gsrnamespace=0&prop=pageimages&piprop=thumbnail|original' +
    // 1400, not 1600: the band is wide but short, and these are illustrative
    // stand-ins rather than the school's own photograph. `original` comes along
    // because its width is needed to bound an unscaled reply — see below.
    `&pithumbsize=1400&gsrsearch=${encodeURIComponent(place)}`

  const res = await fetch(url)
  if (!res.ok) return null
  const data = await res.json()
  const pages = Object.values(data?.query?.pages || {})

  const best = pages
    .filter((page) => page?.thumbnail?.source)
    .map((page) => ({ page, score: titleScore(page.title, place) }))
    .filter((c) => c.score > 0)
    // Relevance first, then Wikipedia's own ranking among equally relevant ones.
    .sort((a, b) => b.score - a.score || (a.page.index ?? 99) - (b.page.index ?? 99))[0]

  if (!best) return null
  const page = best.page
  const cap = Math.min(1400, page.original?.width || 1400)
  return {
    url: boundedThumb(page.thumbnail.source, cap),
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
