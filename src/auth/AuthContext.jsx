import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react'
import { getAdapter } from '../data'
import { classifyIdentifier, normalizeEmail } from '../lib/identity'

const AuthContext = createContext(null)
const STORAGE_KEY = 'schoolTrips.session'

function readSession() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const NO_MATCH =
  'We could not find a student registered against this. Please check with the school office that your details are on record.'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readSession)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (session) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    else sessionStorage.removeItem(STORAGE_KEY)
  }, [session])

  /**
   * Pins the session to the grades of the matched children. Grade is derived
   * here and nowhere else — no screen ever takes a grade from the URL or from
   * user input.
   */
  const startSession = useCallback((students, { via, identifier, displayName }) => {
    const valid = students.filter((s) => s.grade)
    if (valid.length === 0) throw new Error(NO_MATCH)

    setSession({
      via,
      identifier,
      parentName: displayName || valid[0].parentName,
      students: valid,
      grades: [...new Set(valid.map((s) => s.grade))],
      activeStudentId: valid.length === 1 ? valid[0].id : null,
    })
  }, [])

  /** Email or mobile, typed into the one login box. */
  const login = useCallback(async (raw) => {
    const { kind, value, valid } = classifyIdentifier(raw)
    if (kind === 'empty') throw new Error('Please enter your email address or registered mobile number.')
    if (!valid) {
      throw new Error(
        kind === 'email'
          ? 'That does not look like a valid email address.'
          : 'Please enter the 10-digit mobile number registered with the school.'
      )
    }

    setBusy(true)
    try {
      const adapter = getAdapter()
      let students
      if (adapter.lookup) {
        students = await adapter.lookup({ kind, value })
      } else {
        const roster = await adapter.fetchStudents()
        students =
          kind === 'email'
            ? roster.filter((s) => s.emails.includes(value))
            : roster.filter((s) => s.phones.includes(value))
      }
      startSession(students, { via: kind, identifier: value })
    } finally {
      setBusy(false)
    }
  }, [startSession])

  /**
   * Google has already proved the address, so this skips the typed path — but
   * access still depends on that same address appearing in the sheet.
   */
  const loginWithGoogle = useCallback(async ({ email, name }) => {
    const value = normalizeEmail(email)
    setBusy(true)
    try {
      const adapter = getAdapter()
      const students = adapter.lookup
        ? await adapter.lookup({ kind: 'email', value })
        : (await adapter.fetchStudents()).filter((s) => s.emails.includes(value))

      if (students.length === 0) {
        throw new Error(
          `${value} is not on the school's records. Please sign in with the email address the school has on file, or contact the office.`
        )
      }
      startSession(students, { via: 'google', identifier: value, displayName: name })
    } finally {
      setBusy(false)
    }
  }, [startSession])

  const logout = useCallback(() => setSession(null), [])

  const selectStudent = useCallback((studentId) => {
    setSession((s) => (s ? { ...s, activeStudentId: studentId } : s))
  }, [])

  const value = useMemo(() => {
    const activeStudent = session?.students.find((s) => s.id === session.activeStudentId) || null
    return {
      session,
      busy,
      login,
      loginWithGoogle,
      logout,
      selectStudent,
      isAuthenticated: !!session,
      students: session?.students || [],
      activeStudent,
      /** The single grade this session may read. Null until a child is chosen. */
      activeGrade: activeStudent?.grade || null,
      /** Guards data reads — a grade outside this list is never fetched. */
      canAccessGrade: (gradeId) => !!session?.grades.includes(gradeId),
    }
  }, [session, busy, login, loginWithGoogle, logout, selectStudent])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
