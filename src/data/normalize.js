import { pick, collectAll } from './csv'
import { normalizeGradeId } from '../lib/grades'
import { normalizePhone } from '../lib/phone'

/**
 * Every sheet row passes through here on its way into the app. Column names are
 * matched against a list of aliases rather than one exact header, because the
 * school owns those sheets and renames columns without telling anyone.
 */

/**
 * A student may be reachable by several credentials — a parent email, a
 * father's mobile, a mother's mobile — and any one of them should let that
 * parent in. Hence lists rather than single fields; it is also what lets
 * mothers log in with their own number.
 *
 * A student's OWN email is deliberately not collected: it is not a parent
 * credential. `pick`/`collectAll` match whole normalized header names, so a
 * column called `StudentEmailID` can never be mistaken for `Email`.
 *
 * An emergency contact is also excluded on purpose — it is often a neighbour or
 * relative, and should not grant access to a child's trip details.
 */
export function toStudent(row, i) {
  const emails = collectAll(row,
    'parentsemailid', 'parentsemail', 'parentemail', 'parentsemailaddress',
    'fatheremail', 'motheremail', 'guardianemail', 'email',
  ).map((e) => e.trim().toLowerCase())

  const phones = collectAll(row,
    'fathersmobileno', 'fathermobileno', 'fathersmobile', 'fatherphone',
    'mothersmobileno', 'mothermobileno', 'mothersmobile', 'motherphone',
    'parentphone', 'parentsmobileno', 'guardianphone', 'mobile', 'phone', 'contact',
  ).map(normalizePhone).filter((p) => p.length === 10)

  return {
    id: pick(row, 'studentid', 'fskid', 'id', 'admissionno', 'rollno') || `s${i}`,
    name: pick(row, 'studentname', 'name', 'student'),
    grade: normalizeGradeId(pick(row, 'grade', 'class', 'standard')),
    section: pick(row, 'section', 'division'),
    parentName: pick(row, 'fathername', 'father', 'mothername', 'guardianname', 'parentname'),
    emails: [...new Set(emails)],
    phones: [...new Set(phones)],
  }
}

export function toTrip(row) {
  const status = pick(row, 'status', 'tripstatus').toLowerCase()
  return {
    grade: normalizeGradeId(pick(row, 'grade', 'class')),
    title: pick(row, 'triptitle', 'title', 'trip'),
    dates: pick(row, 'tripdates', 'dates', 'date'),
    status: status === 'confirmed' ? 'confirmed' : 'pending',
    coverImage: pick(row, 'coverimage', 'cover', 'image'),
    overview: pick(row, 'overview', 'description', 'about'),
    coordinator: pick(row, 'coordinator', 'coordinatorname', 'tripcoordinator'),
    coordinatorPhone: pick(row, 'coordinatorphone', 'phone'),
    coordinatorEmail: pick(row, 'coordinatoremail', 'email'),
    emergency: pick(row, 'emergency', 'emergencycontact'),
  }
}

export function toItineraryRow(row) {
  return {
    grade: normalizeGradeId(pick(row, 'grade', 'class')),
    day: pick(row, 'day'),
    time: pick(row, 'time'),
    activity: pick(row, 'activity', 'details', 'description'),
    location: pick(row, 'location', 'place'),
  }
}

export function toDocument(row) {
  return {
    grade: normalizeGradeId(pick(row, 'grade', 'class')),
    label: pick(row, 'label', 'title', 'name', 'document'),
    url: pick(row, 'url', 'link', 'driveurl'),
    category: pick(row, 'category', 'type', 'section'),
  }
}

const GUIDELINE_TYPES = { safety: 'safety', do: 'do', dos: 'do', dont: 'dont', donts: 'dont', carry: 'carry' }

export function toGuideline(row) {
  const raw = pick(row, 'type', 'kind', 'category').toLowerCase().replace(/[^a-z]/g, '')
  return {
    grade: normalizeGradeId(pick(row, 'grade', 'class')),
    type: GUIDELINE_TYPES[raw] || 'safety',
    text: pick(row, 'text', 'point', 'item', 'description'),
  }
}

export function toReminder(row) {
  return {
    grade: normalizeGradeId(pick(row, 'grade', 'class')),
    date: pick(row, 'date', 'due', 'deadline'),
    text: pick(row, 'text', 'reminder', 'task', 'description'),
  }
}

export function toTravelLeg(row) {
  return {
    grade: normalizeGradeId(pick(row, 'grade', 'class')),
    leg: pick(row, 'leg', 'direction', 'journey') || 'Journey',
    trainNo: pick(row, 'trainno', 'train', 'trainnumber'),
    departure: pick(row, 'departure', 'departuretime', 'time'),
    platform: pick(row, 'platform'),
    coachSeat: pick(row, 'coachseat', 'coach', 'seat'),
    notes: pick(row, 'notes', 'note', 'remarks'),
  }
}

export function toMedia(row) {
  const type = pick(row, 'type', 'kind').toLowerCase()
  return {
    grade: normalizeGradeId(pick(row, 'grade', 'class')),
    type: type === 'video' ? 'video' : 'photo',
    url: pick(row, 'url', 'link'),
    caption: pick(row, 'caption', 'title', 'label'),
  }
}

/** Folds the flat, per-grade sheet rows into the shape a trip page renders. */
export function assembleTrip(gradeId, sets) {
  const forGrade = (rows) => (rows || []).filter((r) => r.grade === gradeId)
  const trip = (sets.trips || []).find((t) => t.grade === gradeId) || null
  if (!trip) return null

  const guidelines = forGrade(sets.guidelines)
  return {
    ...trip,
    itinerary: forGrade(sets.itinerary),
    documents: forGrade(sets.documents),
    safety: guidelines.filter((g) => g.type === 'safety').map((g) => g.text),
    dos: guidelines.filter((g) => g.type === 'do').map((g) => g.text),
    donts: guidelines.filter((g) => g.type === 'dont').map((g) => g.text),
    carry: guidelines.filter((g) => g.type === 'carry').map((g) => g.text),
    reminders: forGrade(sets.reminders),
    travel: forGrade(sets.travel),
    media: forGrade(sets.media),
  }
}
