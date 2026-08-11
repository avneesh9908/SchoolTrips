import { csvToObjects } from '../../src/data/csv.js'
import { toStudent } from '../../src/data/normalize.js'
import { classifyIdentifier } from '../../src/lib/identity.js'

/**
 * Resolves a parent's login against the school roster, server-side.
 *
 * Why this exists: the roster feed sends no CORS headers, so a browser cannot
 * read it at all; and it carries addresses, dates of birth, blood groups and
 * Aadhaar names for every student, so it must never reach a browser wholesale.
 * This runs on the server, matches the credential, and returns ONLY the
 * caller's own children with only the three fields the UI needs.
 *
 * It imports the same normalize/csv modules the frontend uses, so column
 * handling cannot drift between the two.
 *
 * Portable by design: the handler is a thin wrapper: `resolveParent()` below is
 * plain JS and moves to Express, Vercel, Azure Functions or an IIS-hosted Node
 * app unchanged. Only the wrapper needs rewriting when hosting changes.
 */

const ROSTER_URL = process.env.ROSTER_CSV_URL
const CACHE_MS = 5 * 60 * 1000

/**
 * Staff who may see every grade, not just their own child's.
 *
 * Deliberately a server environment variable rather than config.json: the
 * client config is public, and while a typed email is the only credential,
 * publishing the admin list would tell anyone exactly which address to type to
 * get full access.
 */
const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
)

/** "vardan.kabra" -> "Vardan Kabra", just for the greeting. */
function nameFromEmail(email) {
  return email
    .split('@')[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}

let cache = { at: 0, students: null }

async function loadRoster() {
  if (!ROSTER_URL) {
    throw new Error('ROSTER_CSV_URL is not configured on the server.')
  }
  if (cache.students && Date.now() - cache.at < CACHE_MS) return cache.students

  const res = await fetch(ROSTER_URL)
  if (!res.ok) throw new Error(`Roster feed returned HTTP ${res.status}.`)

  const students = csvToObjects(await res.text()).map(toStudent)
  cache = { at: Date.now(), students }
  return students
}

/** The portable core. Returns only what the browser is allowed to see. */
export async function resolveParent(rawIdentifier) {
  const { kind, value, valid } = classifyIdentifier(rawIdentifier)
  if (kind === 'empty' || !valid) {
    return { status: 400, body: { error: 'Enter a valid email address or 10-digit mobile number.' } }
  }

  // Staff are checked before the roster is even loaded — they have no child row.
  if (kind === 'email' && ADMIN_EMAILS.has(value)) {
    return {
      status: 200,
      body: { role: 'admin', parentName: nameFromEmail(value), students: [] },
    }
  }

  const roster = await loadRoster()
  const matches = roster.filter((s) =>
    s.grade && (kind === 'email' ? s.emails.includes(value) : s.phones.includes(value))
  )

  if (matches.length === 0) {
    // Same message either way — telling a caller that an address exists but has
    // no children would leak which addresses are on the school's roll.
    return { status: 404, body: { error: 'No student is registered against this.' } }
  }

  return {
    status: 200,
    body: {
      role: 'parent',
      parentName: matches[0].parentName,
      // Deliberately minimal: no emails, phones, addresses, DOB or blood group
      // ever cross this boundary.
      students: matches.map((s) => ({
        id: s.id,
        name: s.name,
        grade: s.grade,
        section: s.section,
      })),
    },
  }
}

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
}

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Use POST.' }), { status: 405, headers: JSON_HEADERS })
  }

  let identifier
  try {
    const body = await request.json()
    identifier = body?.value ?? body?.identifier
  } catch {
    return new Response(JSON.stringify({ error: 'Expected a JSON body.' }), { status: 400, headers: JSON_HEADERS })
  }

  try {
    const { status, body } = await resolveParent(identifier)
    return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
  } catch (err) {
    console.error('[lookup]', err)
    return new Response(
      JSON.stringify({ error: 'Could not reach the school roster right now.' }),
      { status: 502, headers: JSON_HEADERS }
    )
  }
}

export const config = { path: '/api/lookup' }
