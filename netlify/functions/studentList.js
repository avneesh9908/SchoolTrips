import { createHmac, createSign, randomBytes, timingSafeEqual } from 'node:crypto'
import { safeColumns } from '../../src/lib/studentListColumns.js'

/**
 * Reads a PRIVATE student list for a signed-in family (2026-11-28).
 *
 * The school keeps each grade's list private and wants every signed-in person to
 * see it on the page, with no extra click. A browser cannot read a private sheet
 * (Google refuses cookie-based reads, and a per-viewer permission window was
 * rejected), so the server reads it with a Google SERVICE ACCOUNT that the school
 * shares the lists with, and sends back the rows with `safeColumns` applied.
 *
 * Server environment:
 *   GOOGLE_SERVICE_ACCOUNT_JSON  the service account's JSON key, pasted whole.
 *                                Without it every request answers 503 and the
 *                                card falls back to its Open link.
 *   SESSION_SECRET               signs the list pass. Optional: without it a
 *                                random secret is made at boot, so passes stop
 *                                working after a restart and families just
 *                                sign in again.
 *
 * WHO may read: anyone holding a list pass, which `/api/lookup` issues only after
 * verifying their Google sign-in against the roster or the staff list. WHAT they may
 * read: any sheet the service account can open, which is exactly the files the
 * school shares with it. Not checked: that the sheet belongs to the reader's own
 * grade. The trip workbook that maps grade → list is not read on the server.
 */

const PASS_HOURS = 12
const SECRET = process.env.SESSION_SECRET || randomBytes(32).toString('hex')

const b64url = (buf) => Buffer.from(buf).toString('base64url')

/** A signed, expiring pass saying "this address signed in". No grades, no names. */
export function issueListPass(email) {
  const body = b64url(JSON.stringify({ e: email, x: Date.now() + PASS_HOURS * 3600_000 }))
  const sig = b64url(createHmac('sha256', SECRET).update(body).digest())
  return `${body}.${sig}`
}

export function verifyListPass(pass) {
  const [body, sig] = String(pass || '').split('.')
  if (!body || !sig) return null
  const want = createHmac('sha256', SECRET).update(body).digest()
  const got = Buffer.from(sig, 'base64url')
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString())
    return data.x > Date.now() ? data : null
  } catch {
    return null
  }
}

/* ---- service account → access token (no dependency: RS256 JWT by hand) ---- */

let account = null
function serviceAccount() {
  if (account) return account
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!parsed.client_email || !parsed.private_key) return null
    account = parsed
    return account
  } catch {
    console.error('[student-list] GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON.')
    return null
  }
}

let tokenCache = { value: '', exp: 0 }
async function accessToken() {
  if (tokenCache.value && tokenCache.exp > Date.now() + 60_000) return tokenCache.value
  const sa = serviceAccount()
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })
  )
  const signature = createSign('RSA-SHA256').update(`${header}.${claims}`).sign(sa.private_key, 'base64url')
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${signature}`,
    }),
  })
  if (!res.ok) throw new Error(`token ${res.status}`)
  const data = await res.json()
  tokenCache = { value: data.access_token, exp: Date.now() + (data.expires_in || 3600) * 1000 }
  return tokenCache.value
}

/** One tab as rows of displayed text, header first. Picked by gid, else the first tab. */
async function readSheet(id, gid) {
  const auth = { headers: { Authorization: `Bearer ${await accessToken()}` } }
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}`
  const meta = await fetch(`${base}?fields=sheets.properties(sheetId,title)`, auth)
  if (!meta.ok) return { status: meta.status }
  const tabs = (await meta.json()).sheets || []
  const tab = tabs.find((s) => String(s.properties.sheetId) === String(gid)) || tabs[0]
  if (!tab) return { status: 404 }
  const range = encodeURIComponent(`'${tab.properties.title.replace(/'/g, "''")}'`)
  const res = await fetch(`${base}/values/${range}?valueRenderOption=FORMATTED_VALUE`, auth)
  if (!res.ok) return { status: res.status }
  return { status: 200, rows: (await res.json()).values || [] }
}

const SHEET_ID = /^[A-Za-z0-9_-]{20,100}$/

/** The portable core, shared by `server.js` (Railway) and the Netlify handler. */
export async function resolveStudentList({ pass, id, gid } = {}) {
  if (!verifyListPass(pass)) {
    return { status: 401, body: { error: 'Please sign in again to see the student list.' } }
  }
  if (!SHEET_ID.test(String(id || '')) || (gid && !/^\d{1,12}$/.test(String(gid)))) {
    return { status: 400, body: { error: 'Not a student list.' } }
  }
  if (!serviceAccount()) {
    return { status: 503, body: { error: 'Student lists are not set up on the server yet.' } }
  }
  try {
    const { status, rows } = await readSheet(id, gid)
    // 403/404: the school has not shared this file with the service account.
    if (status !== 200) return { status: status === 403 || status === 404 ? 404 : 502, body: { error: 'This list could not be read.' } }
    return { status: 200, body: { rows: safeColumns(rows) } }
  } catch (err) {
    console.error('[student-list]', err.message)
    return { status: 502, body: { error: 'This list could not be read.' } }
  }
}

const JSON_HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Use POST.' }), { status: 405, headers: JSON_HEADERS })
  }
  let body
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Expected a JSON body.' }), { status: 400, headers: JSON_HEADERS })
  }
  const { status, body: out } = await resolveStudentList(body || {})
  return new Response(JSON.stringify(out), { status, headers: JSON_HEADERS })
}

export const config = { path: '/api/student-list' }
