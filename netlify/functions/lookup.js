import { csvToObjects } from '../../src/data/csv.js'
import { toStudent } from '../../src/data/normalize.js'
import { matchStudent } from '../../src/lib/identity.js'
import { verifyGoogleIdToken, SignInError } from './googleToken.js'

/**
 * Resolves a login against the school roster, server-side — a parent's, or from
 * Grade 7 up a student's own.
 *
 * The caller proves who they are with a Google ID token and nothing else. It
 * used to accept a typed email address or mobile number as the whole
 * credential, which meant knowing a parent's address was the same as being
 * them; that was removed on 2026-08-21. The token is verified in
 * `googleToken.js` before the roster is touched, so the email matched below is
 * one Google confirmed the caller owns, never one the caller chose.
 *
 * Why this exists at all: the roster feed sends no CORS headers, so a browser
 * cannot read it; and it carries addresses, dates of birth, blood groups and
 * Aadhaar names for every student, so it must never reach a browser wholesale.
 * This runs on the server, matches the credential, and returns ONLY the
 * caller's own children with only the four fields the UI needs.
 *
 * It imports the same normalize/csv modules the frontend uses, so column
 * handling cannot drift between the two.
 *
 * Portable by design: the handler is a thin wrapper: `resolveSignIn()` below is
 * plain JS and moves to Express, Vercel, Azure Functions or an IIS-hosted Node
 * app unchanged. Only the wrapper needs rewriting when hosting changes.
 */

const ROSTER_URL = process.env.ROSTER_CSV_URL
const CACHE_MS = 5 * 60 * 1000

/**
 * Staff who may see every grade, not just their own child's.
 *
 * Deliberately a server environment variable rather than config.json: the
 * client config is public, so the list would be readable by anyone. It is no
 * longer a credential on its own — a staff address still has to arrive with a
 * verified Google token for that address — but there is no reason to publish
 * which addresses hold full access.
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

/**
 * The portable core. Takes a raw Google credential, returns only what the
 * browser is allowed to see.
 */
export async function resolveSignIn(credential) {
  let identity
  try {
    identity = await verifyGoogleIdToken(credential)
  } catch (err) {
    if (err instanceof SignInError) return { status: err.status, body: { error: err.message } }
    // A missing GOOGLE_CLIENT_ID lands here. Say so plainly in the log; the
    // parent gets the generic outage message, because a misconfigured server is
    // not something they can act on.
    console.error('[lookup] token verification failed:', err.message)
    return { status: 503, body: { error: 'Sign-in is not available right now. Please contact the school office.' } }
  }

  const { email, name } = identity

  // Staff are checked before the roster is even loaded — they have no child row.
  if (ADMIN_EMAILS.has(email)) {
    return {
      status: 200,
      body: { role: 'admin', parentName: name || nameFromEmail(email), students: [] },
    }
  }

  const roster = await loadRoster()
  // `matchStudent` carries the grade rule: a parent contact opens any grade, a
  // student's own address only Grade 7 and above.
  const matched = roster
    .map((s) => ({ student: s, as: matchStudent(s, { kind: 'email', value: email }) }))
    .filter((m) => m.as)

  if (matched.length === 0) {
    // Same reply for an address nobody knows, an address with no children, and a
    // junior student's own address. Less about secrecy than it was — a caller now
    // has to own the account to get any answer at all — but one wording is still
    // the right answer to "why did this not work", and the rule is on the login
    // screen where it can be read before signing in.
    return {
      status: 403,
      body: {
        error:
          'No student is registered against this Google account. Students in Grade 6 and below ' +
          "cannot sign in themselves — please use the parent's school email address.",
      },
    }
  }

  const matches = matched.map((m) => m.student)
  // A student signing in is greeted by their own name; a parent by theirs.
  const signedInAs = matched[0].as

  return {
    status: 200,
    body: {
      role: 'parent',
      signedInAs,
      parentName: signedInAs === 'student' ? matches[0].name : matches[0].parentName,
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

  let credential
  try {
    credential = (await request.json())?.credential
  } catch {
    return new Response(JSON.stringify({ error: 'Expected a JSON body.' }), { status: 400, headers: JSON_HEADERS })
  }

  try {
    const { status, body } = await resolveSignIn(credential)
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
