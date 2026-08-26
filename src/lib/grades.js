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
  /**
   * MLC is a named programme, not a numbered year, and the school wants its own
   * card at the end of the picker — after Grade 12 (2026-08-21: "grade name is
   * mlc show after grade 12").
   *
   * It was on the content sheet all along, written into the Grades column as
   * `MlC`, which `normalizeGradeId` could not read — so `groupByGrade` discarded
   * the row and the trip was invisible on the site. Adding it here is what makes
   * that row land somewhere.
   *
   * `full` is deliberately just "MLC": the school has not told us what it stands
   * for, and inventing an expansion would put words on a parent's screen that
   * nobody at the school wrote.
   */
  { id: 'mlc', label: 'MLC', full: 'MLC', color: '#D9822B', icon: 'tent' },
]

const FALLBACK = { id: 'unknown', label: '?', full: 'Grade', color: '#767066', icon: 'map' }

/**
 * Which grades have no trip a parent can open — shown as "Coming soon" on a card
 * that does not open, rather than as a card leading to "Nothing published yet",
 * which reads as a broken app rather than as work in progress.
 *
 * **Read from the sheet since 2026-08-26**, not from a list in this file. Junior
 * and middle school used to be hard-coded here because their rows sat on the
 * content sheet's second worksheet ("JS ") and every read path took only the
 * first; now both tabs are read (`xlsxAllToObjects`), so the school publishing a
 * grade's trip is all it takes for that grade to open — no code change, which is
 * the whole point of the sheet being the source.
 *
 * `titles` is `useTripTitles`' grade → destination map, which the picker has
 * already fetched, so nothing extra is downloaded to answer this.
 *
 * The original warning still stands and is what `PRESUMED_SOON` is for: this must
 * never become a bare "is the trip empty" check, or a grade whose content merely
 * FAILED TO LOAD would be labelled as unannounced. So an absent or empty map — the
 * sheet has not landed yet, or the fetch failed — falls back to the grades the
 * sheet has never carried, and Junior KG is the only one of those today (the
 * junior worksheet starts at Senior KG).
 */
const PRESUMED_SOON = new Set(['jk'])

export function isComingSoon(id, titles) {
  if (titles && Object.keys(titles).length) return !titles[id]
  return PRESUMED_SOON.has(id)
}

/**
 * From which grade a student may sign in with their OWN school address.
 *
 * The school's rule, 2026-08-17: "grade 6 only access through the parent id,
 * after grade 6 both parent and student access his and her email id". So a
 * junior or middle-school child's trip is reachable only through a parent's
 * credential, and from Grade 7 up the student's own address opens it as well.
 *
 * Deliberately NOT `isComingSoon`. That one is about whether the sheet has
 * published a trip yet and now moves with the sheet itself; this one is about who
 * may sign in, and it must not move with it — the junior worksheet being read
 * (2026-08-26) opened six grades on the site and changed nobody's login.
 */
export const STUDENT_LOGIN_FROM_GRADE = 7

/**
 * 0 for the two kindergartens, 1-12 for the numbered grades, -1 for anything
 * else — which includes `mlc`, because a named programme has no year number.
 *
 * The consequence is deliberate: `allowsStudentLogin('mlc')` is false, so if the
 * roster ever files a student under MLC their own address will not open it and a
 * parent's will. That is the fail-closed side, and the school should be asked
 * before it is loosened. It is moot while every roster row carries a numbered
 * grade, which is the case today.
 */
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
  /**
   * "SR.KG" and "JR.KG", which is how the junior-school worksheet writes the two
   * kindergartens (measured 2026-08-26: its first row is "SR.KG"). Neither of the
   * checks around this one reads them — "sr.kg" contains neither "senior" nor
   * "kinder" and has no digit — so Senior KG's whole trip was dropped from the
   * site with nothing but a console warning to say so.
   */
  if (/^sr[\s.\-_]*k/.test(s)) return 'sk'
  if (/^jr[\s.\-_]*k/.test(s)) return 'jk'
  if (s === 'jk' || s.includes('junior') || s.includes('kinder')) return 'jk'
  /**
   * MLC, the named programme. Tested before the numeric parse because a cell
   * like "MLC-Manali (2026-27)" would otherwise match the year and be read as a
   * grade number.
   *
   * `mic` is accepted as the same thing on purpose. The sheet already carries
   * both spellings — a capital I for a lowercase L is invisible in the school's
   * font — and the failure it causes is the silent one this whole entry exists
   * to fix: an unreadable grade drops the row off the site with no error a
   * parent or a member of staff would ever see.
   */
  if (/^m[li]c/.test(s) || s.startsWith('mlc') || s.startsWith('mic')) return 'mlc'
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
