/**
 * Talks to a backend that holds the Google service-account credentials, so the
 * spreadsheets stay private and the grade filter is enforced server-side.
 *
 * Contract the backend must implement:
 *
 *   POST /auth/lookup      { kind, value }      -> { token, students: Student[] }
 *                          kind is 'email' | 'phone' | 'google'.
 *                          For 'google', value is the raw ID-token credential and the
 *                          backend MUST verify Google's signature before trusting the
 *                          email inside it — the browser only decodes it.
 *   GET  /trips/:gradeId   Authorization: Bearer <token>
 *                          -> TripSets, already filtered to that grade,
 *                             403 if the token's students do not include it
 *
 * Student  { id, name, grade, section, fatherName, fatherPhone, fatherEmail }
 * TripSets { trips, itinerary, documents, guidelines, reminders, travel, media }
 *          — the same normalized shapes src/data/normalize.js produces.
 *
 * Until that service exists this adapter throws a clear error rather than
 * failing obscurely at fetch time.
 */

import { config } from '../config'

function requireBase() {
  const base = config().apiBaseUrl
  if (!base) {
    throw new Error('dataSource is "api" but no apiBaseUrl is set. See src/data/apiAdapter.js for the contract.')
  }
  return base.replace(/\/$/, '')
}

let token = null

export const apiAdapter = {
  id: 'api',
  label: 'Backend API',

  /**
   * The backend resolves the identifier, so this adapter exposes it directly
   * and the auth layer skips its own client-side matching.
   */
  async lookup({ kind, value }) {
    const res = await fetch(`${requireBase()}/auth/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, value }),
    })
    if (res.status === 404) return []
    if (!res.ok) throw new Error(`Login failed (HTTP ${res.status}).`)
    const data = await res.json()
    token = data.token
    return data.students || []
  },

  async fetchStudents() {
    throw new Error('The api adapter authenticates server-side; use lookup() instead.')
  },

  async fetchTripSets(gradeId) {
    if (!gradeId) throw new Error('The api adapter needs a grade id.')
    const res = await fetch(`${requireBase()}/trips/${encodeURIComponent(gradeId)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (res.status === 403) throw new Error('You do not have access to this grade.')
    if (!res.ok) throw new Error(`Could not load trip details (HTTP ${res.status}).`)
    return res.json()
  },
}
