export const GRADES = [
  { id: 'jk', label: 'JK', full: 'Junior KG', color: '#FF6B5B', icon: 'map' },
  { id: 'sk', label: 'SK', full: 'Senior KG', color: '#2E6F95', icon: 'pencil' },
  { id: 'g1', label: 'G1', full: 'Grade 1', color: '#FFB100', icon: 'compass' },
  { id: 'g2', label: 'G2', full: 'Grade 2', color: '#4CAF6D', icon: 'camera' },
  { id: 'g3', label: 'G3', full: 'Grade 3', color: '#2AA8DE', icon: 'backpack' },
  { id: 'g4', label: 'G4', full: 'Grade 4', color: '#8C6BE0', icon: 'tent' },
  { id: 'g5', label: 'G5', full: 'Grade 5', color: '#EF5DA8', icon: 'binoculars' },
  { id: 'g6', label: 'G6', full: 'Grade 6', color: '#FF8A3D', icon: 'kite' },
  { id: 'g7', label: 'G7', full: 'Grade 7', color: '#26C0B0', icon: 'train' },
  { id: 'g8', label: 'G8', full: 'Grade 8', color: '#5B7FFF', icon: 'sun' },
  { id: 'g9', label: 'G9', full: 'Grade 9', color: '#E0566B', icon: 'leaf' },
  { id: 'g10', label: 'G10', full: 'Grade 10', color: '#7BB92B', icon: 'globe' },
  { id: 'g11', label: 'G11', full: 'Grade 11', color: '#B45BD4', icon: 'flag' },
  { id: 'g12', label: 'G12', full: 'Grade 12', color: '#1E9E8C', icon: 'star' },
]

const FALLBACK = { id: 'unknown', label: '?', full: 'Grade', color: '#767066', icon: 'map' }

/**
 * Junior and middle school, up to Grade 6, have no trip a parent can open yet:
 * their rows live on the content sheet's second worksheet ("JS "), which every
 * read path skips because it only ever takes the first one. Until that is read,
 * a card for one of these grades leads to "Nothing published yet" — a dead end
 * that reads as a broken app rather than as work in progress.
 *
 * So they are labelled "Coming soon" and are not openable. This is a deliberate
 * statement about the grade, not about the fetch: it must not be replaced by an
 * "is the trip object empty" check, which would also silence a grade whose
 * content simply failed to load.
 */
const COMING_SOON = new Set(['jk', 'sk', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6'])

export function isComingSoon(id) {
  return COMING_SOON.has(id)
}

/**
 * From which grade a student may sign in with their OWN school address.
 *
 * The school's rule, 2026-08-17: "grade 6 only access through the parent id,
 * after grade 6 both parent and student access his and her email id". So a
 * junior or middle-school child's trip is reachable only through a parent's
 * credential, and from Grade 7 up the student's own address opens it as well.
 *
 * Deliberately NOT `isComingSoon`, even though that set happens to hold the same
 * eight grades today. That one is about content not being published yet and will
 * shrink the moment the sheet's junior worksheet is read; this one is about who
 * may sign in, and it must not move with it.
 */
export const STUDENT_LOGIN_FROM_GRADE = 7

/** 0 for the two kindergartens, 1-12 for the numbered grades, -1 for anything else. */
export function gradeNumber(id) {
  if (id === 'jk' || id === 'sk') return 0
  const m = /^g(\d{1,2})$/.exec(String(id || ''))
  return m ? Number(m[1]) : -1
}

/**
 * Fails closed: a row whose grade could not be read (`normalizeGradeId` returned
 * '') scores -1 and never grants a student login.
 */
export function allowsStudentLogin(id) {
  return gradeNumber(id) >= STUDENT_LOGIN_FROM_GRADE
}

/**
 * Sheets are filled in by humans, so grade arrives in every shape imaginable:
 * "7", "Grade 7", "grade-7", "VII", "JK". Everything funnels through here so the
 * rest of the app only ever deals with a canonical id.
 */
export function normalizeGradeId(raw) {
  if (raw === null || raw === undefined) return ''
  const s = String(raw).trim().toLowerCase()
  if (!s) return ''
  // Senior must be tested before the generic kindergarten check, or "Senior KG"
  // falls through to jk. Getting this wrong silently drops a whole year group.
  if (s === 'sk' || (s.includes('senior') && (s.includes('kg') || s.includes('kinder')))) return 'sk'
  if (s === 'jk' || s.includes('junior') || s.includes('kinder')) return 'jk'
  const roman = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12 }
  const bare = s.replace(/grade|class|std\.?|standard|-|_/g, '').trim()
  if (roman[bare]) return `g${roman[bare]}`
  const num = bare.match(/\d{1,2}/)
  if (num) {
    const n = parseInt(num[0], 10)
    if (n >= 1 && n <= 12) return `g${n}`
  }
  return ''
}

export function gradeById(id) {
  return GRADES.find((g) => g.id === id) || FALLBACK
}
