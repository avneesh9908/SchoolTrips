import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react'
import { getAdapter } from '../data'
import { normalizeEmail, matchStudent } from '../lib/identity'
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
  'We could not find a student registered against this Google account. Students in Grade 6 and below ' +
  "cannot sign in themselves — please use the parent's school email address. If your details should " +
  'be on record, please check with the school office.'

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
  const startSession = useCallback((students, { via, identifier, displayName, role, signedInAs }) => {
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
      // Who is holding the credential, not what they may see: a student signing in
      // with their own address (Grade 7 and above) gets exactly the access their
      // parent would. It is recorded so the top bar can say whose account this is.
      signedInAs: signedInAs === 'student' ? 'student' : 'parent',
      via,
      identifier,
      parentName: displayName || valid[0].parentName,
      students: valid,
      grades: [...new Set(valid.map((s) => s.grade))],
      activeStudentId: valid.length === 1 ? valid[0].id : null,
    })
  }, [])

  /**
   * The one place a credential becomes {students, role}. Every sign-in goes
   * through it, so there is exactly one path into a session — the typed
   * email/mobile box that used to sit beside it was removed on 2026-08-21,
   * because knowing an address was the whole credential and anyone who knew a
   * parent's could open that family's trip details.
   *
   * `credential` is the raw Google ID token and is the only thing sent onward.
   * `email` is the browser's decode of it, passed for the demo adapter alone.
   */
  const resolveIdentity = useCallback(async ({ credential, email }) => {
    const adapter = getAdapter()

    if (adapter.lookup) {
      const result = await adapter.lookup({ credential, email })
      // A bare array is the older adapter shape.
      return Array.isArray(result)
        ? { students: result, role: undefined, signedInAs: 'parent' }
        : { students: result.students || [], role: result.role, signedInAs: result.signedInAs }
    }

    // Last resort, for an adapter with no `lookup` of its own. Same matcher as
    // the server, so the grade rule holds here too.
    const roster = await adapter.fetchStudents()
    const matched = roster
      .map((s) => ({ student: s, as: matchStudent(s, { kind: 'email', value: email }) }))
      .filter((m) => m.as)
    return {
      students: matched.map((m) => m.student),
      role: undefined,
      signedInAs: matched[0]?.as || 'parent',
    }
  }, [])

  /**
   * The only way to start a session. Google has proved the address belongs to
   * whoever is at the keyboard; the server then proves the school has that
   * address on record. Neither half is sufficient alone, and the browser
   * decides neither.
   */
  const loginWithGoogle = useCallback(async ({ email, name, credential }) => {
    const value = normalizeEmail(email)
    setBusy(true)
    try {
      const adapter = getAdapter()
      if (!adapter.lookup && isAdminEmailLocally(value)) {
        startSession([], { via: 'google', identifier: value, displayName: name, role: 'admin' })
        return
      }

      const { students, role, signedInAs } = await resolveIdentity({ credential, email: value })
      if (role !== 'admin' && students.length === 0) {
        throw new Error(NO_MATCH)
      }
      startSession(students, { via: 'google', identifier: value, displayName: name, role, signedInAs })
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
      loginWithGoogle,
      logout,
      selectStudent,
      isAuthenticated: !!session,
      isAdmin: session?.role === 'admin',
      isStudent: session?.signedInAs === 'student',
      students: session?.students || [],
      activeStudent,
      /** The single grade this session may read. Null until a child is chosen. */
      activeGrade: activeStudent?.grade || null,
      /** Guards data reads — a grade outside this list is never fetched. */
      canAccessGrade: (gradeId) => !!session?.grades.includes(gradeId),
    }
  }, [session, busy, loginWithGoogle, logout, selectStudent])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
