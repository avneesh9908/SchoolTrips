import { normalizePhone } from './phone.js'
import { allowsStudentLogin } from './grades.js'

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

/**
 * Does this credential reach this student, and AS WHOM? Returns `'parent'`,
 * `'student'`, or `''` for no match.
 *
 * The one place the school's 2026-08-17 rule is applied — "grade 6 only access
 * through the parent id, after grade 6 both parent and student". A parent's email
 * or mobile opens any grade; the student's own address opens Grade 7 and above
 * only. Every path that resolves a credential calls this: the server function, the
 * client fallback in `sheetsAdapter` and `AuthContext`'s last-resort filter, so the
 * rule cannot hold in one of them and not the others.
 *
 * A junior student's own address returns `''` — the same as an address nobody
 * knows. That is deliberate: a distinct "you are too young to sign in" reply would
 * confirm to anyone typing addresses that this one is on the school's roll. The
 * rule is explained on the login screen instead, where it costs nothing to say.
 */
export function matchStudent(student, { kind, value }) {
  if (!student || !student.grade || !value) return ''
  if (kind === 'phone') return student.phones?.includes(value) ? 'parent' : ''
  if (kind !== 'email') return ''
  // A parent contact wins even where it happens to equal the student's own, so a
  // shared family address never loses access to a junior grade.
  if (student.emails?.includes(value)) return 'parent'
  if (student.studentEmails?.includes(value)) {
    return allowsStudentLogin(student.grade) ? 'student' : ''
  }
  return ''
}
