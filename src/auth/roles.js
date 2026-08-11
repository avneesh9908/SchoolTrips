import { config } from '../config.js'
import { GRADES } from '../lib/grades.js'

/** Every grade in the school — what staff are allowed to see. */
export const ALL_GRADE_IDS = GRADES.map((g) => g.id)

/**
 * Staff recognition for the fallback path only (mock/demo data, or no
 * rosterApiUrl). In production the server decides, because `config.json` is
 * public and publishing the staff list would hand out the exact addresses that
 * unlock every grade.
 */
export function isAdminEmailLocally(email) {
  const list = config().adminEmails
  if (!Array.isArray(list) || list.length === 0) return false
  return list.map((e) => String(e).trim().toLowerCase()).includes(email)
}

export function nameFromEmail(email) {
  return String(email || '')
    .split('@')[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}
