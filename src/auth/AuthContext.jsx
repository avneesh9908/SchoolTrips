import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react'
import { getAdapter } from '../data'
import { classifyIdentifier, normalizeEmail } from '../lib/identity'
import { ALL_GRADE_IDS, isAdminEmailLocally, nameFromEmail } from './roles.js'

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
  const startSession = useCallback((students, { via, identifier, displayName, role }) => {
    // Staff have no child row; their scope is every grade.
    if (role === 'admin') {
      setSession({
        role: 'admin',
        via,
        identifier,
        parentName: displayName || nameFromEmail(identifier),
        students: [],
        grades: ALL_GRADE_IDS,
        activeStudentId: null,
      })
      return
    }

    const valid = students.filter((s) => s.grade)
    if (valid.length === 0) throw new Error(NO_MATCH)

    setSession({
      role: 'parent',
      via,
      identifier,
      parentName: displayName || valid[0].parentName,
      students: valid,
      grades: [...new Set(valid.map((s) => s.grade))],
      activeStudentId: valid.length === 1 ? valid[0].id : null,
    })
  }, [])

  /**
   * The one place a credential becomes {students, role}. Both the typed box and
   * Google Sign-In go through it, so the two paths cannot drift — an adapter
   * returning the `{role, students}` shape used to be mishandled on the Google
   * path only, which crashed the sign-in and lost staff access.
   */
  const resolveIdentity = useCallback(async ({ kind, value }) => {
    const adapter = getAdapter()

    if (adapter.lookup) {
      const result = await adapter.lookup({ kind, value })
      // A bare array is the older adapter shape.
      return Array.isArray(result)
        ? { students: result, role: undefined }
        : { students: result.students || [], role: result.role }
    }

    const roster = await adapter.fetchStudents()
    return {
      students: roster.filter((s) =>
        kind === 'email' ? s.emails.includes(value) : s.phones.includes(value)
      ),
      role: undefined,
    }
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

      // Fallback path (demo data, or no rosterApiUrl) — the server is the
      // authority whenever there is one.
      if (kind === 'email' && !adapter.lookup && isAdminEmailLocally(value)) {
        startSession([], { via: kind, identifier: value, role: 'admin' })
        return
      }

      const { students, role } = await resolveIdentity({ kind, value })
      startSession(students, { via: kind, identifier: value, role })
    } finally {
      setBusy(false)
    }
  }, [startSession, resolveIdentity])

  /**
   * Google has already proved the address, so this skips the typed path — but
   * access still depends on that same address being on the school's records.
   */
  const loginWithGoogle = useCallback(async ({ email, name }) => {
    const value = normalizeEmail(email)
    setBusy(true)
    try {
      const adapter = getAdapter()
      if (!adapter.lookup && isAdminEmailLocally(value)) {
        startSession([], { via: 'google', identifier: value, displayName: name, role: 'admin' })
        return
      }

      const { students, role } = await resolveIdentity({ kind: 'email', value })
      if (role !== 'admin' && students.length === 0) {
        throw new Error(
          `${value} is not on the school's records. Please sign in with the email address the school has on file, or contact the office.`
        )
      }
      startSession(students, { via: 'google', identifier: value, displayName: name, role })
    } finally {
      setBusy(false)
    }
  }, [startSession, resolveIdentity])

  const logout = useCallback(() => {
    // Otherwise One Tap silently signs the same account straight back in and
    // the parent cannot switch to another Google account.
    window.google?.accounts?.id?.disableAutoSelect()
    setSession(null)
  }, [])

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
      isAdmin: session?.role === 'admin',
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
