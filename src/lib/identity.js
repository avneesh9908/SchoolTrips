import { normalizePhone } from './phone.js'

export function normalizeEmail(raw) {
  return String(raw ?? '').trim().toLowerCase()
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function isValidEmail(raw) {
  return EMAIL_RE.test(normalizeEmail(raw))
}

/**
 * The login box takes either an email or a mobile number. An "@" is the only
 * signal needed — no real phone number contains one, and no real address omits
 * it — so we branch on that rather than guessing from digits.
 */
export function classifyIdentifier(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return { kind: 'empty', value: '' }
  if (s.includes('@')) return { kind: 'email', value: normalizeEmail(s), valid: isValidEmail(s) }
  const phone = normalizePhone(s)
  return { kind: 'phone', value: phone, valid: phone.length === 10 }
}
