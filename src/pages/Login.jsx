import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { googleSignInEnabled } from '../auth/googleSignIn'
import { GoogleButton } from '../components/GoogleButton'

const TAGS = ['Educational journeys', 'Verified trip information', 'Parent & student updates']

// Decoration only, and generic on purpose: it is not a photograph of this
// school. The gradient behind it carries the panel if the image never loads.
const ART =
  'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=1600&q=80'

export default function Login() {
  const [identifier, setIdentifier] = useState('')
  const [error, setError] = useState('')
  const { login, loginWithGoogle, busy } = useAuth()
  const navigate = useNavigate()
  const googleEnabled = googleSignInEnabled()

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await login(identifier)
      navigate('/children', { replace: true })
    } catch (err) {
      setError(err.message)
    }
  }

  const onGoogleIdentity = useCallback(
    async (identity) => {
      setError('')
      try {
        await loginWithGoogle(identity)
        navigate('/children', { replace: true })
      } catch (err) {
        setError(err.message)
      }
    },
    [loginWithGoogle, navigate]
  )

  return (
    <div className="login">
      <div className="login-art">
        <img className="art-photo" src={ART} alt="" />
        <div className="login-art-body">
          <div className="brand">
            <span className="mark">ST</span>
            <span className="name">Educational Trips</span>
          </div>

          <div className="login-copy">
            <h2>Explore. Learn.<br />Experience.</h2>
            <p>
              Discover your school's upcoming educational trips, itineraries, safety information
              and travel updates — all in one place.
            </p>
            <div className="login-tags">
              {TAGS.map((t) => <span key={t}>{t}</span>)}
            </div>
          </div>
        </div>
      </div>

      <div className="login-form">
        <div className="auth-card">
          <div className="auth-brand">
            <span className="mark">ST</span>
            <span>
              <span className="t">School Trips</span>
              <span className="s">Parent portal</span>
            </span>
          </div>

          <h2>Welcome to School Trips</h2>

          {error && <div className="form-error">{error}</div>}

          {googleEnabled && (
            <>
              <GoogleButton onIdentity={onGoogleIdentity} onError={setError} disabled={busy} />
              <p className="auth-hint">Sign in securely with your school-linked Google account.</p>
              <div className="auth-badge"><code>No password required</code></div>
              <div className="or-rule"><span>or</span></div>
            </>
          )}

          <form onSubmit={submit}>
            {/* BOTH panels sit ABOVE the field, in the order the school drew on 2026-08-19:
                what to type, then who may type it, then the box. The reader finishes the
                whole instruction before reaching the input rather than typing and then
                finding a rule under their hands — and the two matched panels stay adjacent,
                which is what makes them read as one instruction instead of two.

                The wording is the school's own, rewritten by them on 2026-08-19 (third
                revision that day). This is the only place the grade rule CAN be stated: a
                failed sign-in has to give the same answer whatever the reason, or anyone
                typing addresses could learn which are on the school's roll. "EY" is the
                school's name for the two kindergarten years, which `allowsStudentLogin`
                treats as grade 0, and "email id" is theirs too — do not tidy either. */}
            <p className="field-lede">
              Parents should sign in using the school's email address or mobile number registered
              with the school. You will only have access to the trip details relevant to your
              child's grade.
            </p>
            <ul className="field-note">
              <li>
                <strong>EY to Grade 6:</strong> Parent login is required using school's email id or
                registered mobile number.
              </li>
              <li>
                <strong>Grade 7 onwards:</strong> Students may sign in using their school email
                address, and parents may also sign in using their school's email address or
                registered mobile number.
              </li>
            </ul>
            <div className="field">
              <label htmlFor="identifier">Email address or mobile number</label>
              <input
                id="identifier"
                type="text"
                inputMode="email"
                autoComplete="username"
                placeholder="you@example.com or 98765 43210"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                disabled={busy}
              />
            </div>
            <button className="btn" type="submit" disabled={busy}>
              {busy ? 'Checking…' : 'Continue'}
            </button>
          </form>

          <p className="auth-policy">
            By continuing, you agree to the school's trip communication and information policy.
          </p>
        </div>
      </div>
    </div>
  )
}
