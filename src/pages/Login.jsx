import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { googleSignInEnabled } from '../auth/googleSignIn'
import { GoogleButton, GoogleButtonPlaceholder } from '../components/GoogleButton'

const TAGS = ['Educational journeys', 'Verified trip information', 'Parent & student updates']

// Decoration only, and generic on purpose: it is not a photograph of this
// school. The gradient behind it carries the panel if the image never loads.
const ART =
  'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=1600&q=80'

const NOT_CONFIGURED =
  'Sign-in is not set up for this site yet, so nobody can sign in. Please contact the school office.'

/**
 * The journey, running behind the whole sign-in page on a loop.
 *
 * The photograph is the DESTINATION: the train crosses the page towards it and
 * passes the marker at the right-hand end of the track, then comes round again.
 * A plane crosses higher up on a longer cycle, so the two are rarely in step.
 *
 * It loops rather than playing once because this is a page a parent sits on
 * while Google decides whether it knows them — an animation that finishes
 * leaves a still picture behind for the rest of that wait.
 *
 * Decoration only, so the whole thing is `aria-hidden`, and it costs no request:
 * every piece here is an element and a gradient over the one photograph that
 * was already being loaded.
 */
function LoginScene() {
  return (
    <div className="login-scene">
      <div className="ls-clouds">
        {[0, 1, 2, 3].map((i) => <span key={i} className={`ls-cloud lc${i}`} />)}
      </div>
      <div className="ls-birds">
        {[0, 1, 2].map((i) => <span key={i} className={`ls-bird lb${i}`} />)}
      </div>

      {/* Higher up, and on its own slower cycle. */}
      <div className="ls-plane"><span className="trail" /><span className="body"><span className="wing" /><span className="fin" /></span></div>

      <div className="ls-rail" />

      {/* The end of the line, sitting over the destination in the photograph. */}
      <div className="ls-marker"><span className="post" /><span className="sign" /></div>

      <div className="ls-train">
        <span className="l"><span className="smoke s0" /><span className="smoke s1" /></span>
        {[0, 1, 2].map((i) => (
          <span className="coach" key={i}>
            <span className="w" /><span className="w" />
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * Google Sign-In is the only way in.
 *
 * The typed "email address or mobile number" box was removed on 2026-08-21. It
 * asked for an identifier, not a secret: anyone who knew a parent's address —
 * a class WhatsApp group is enough — could sign in as them and read that
 * family's trip details. Google proves the account belongs to the person at
 * the keyboard, and the server checks that same address against the school's
 * roster, so both halves must agree before a session exists.
 *
 * Nothing here decides access. If this page were bypassed entirely,
 * `/api/lookup` would still refuse every request that arrives without a
 * verified token.
 */
export default function Login() {
  const [error, setError] = useState('')
  const { loginWithGoogle, busy } = useAuth()
  const navigate = useNavigate()
  const googleEnabled = googleSignInEnabled()

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
    <div className={busy ? 'login is-busy' : 'login'}>
      {/* The journey runs behind the WHOLE page — both columns — so the train
          and the sign-in card are on one screen rather than one after the
          other. The school, 2026-10-17: "I want a login page on same animation
          … not add extra pages". */}
      <div className="login-bg" aria-hidden="true">
        <img className="art-photo" src={ART} alt="" />
        <LoginScene />
      </div>

      <div className="login-art">
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

          {/* Both panels sit ABOVE the button, in the order the school drew on
              2026-08-19: what to sign in with, then who may do it. The reader
              finishes the whole instruction before reaching the control.

              The wording is the school's own, amended here only where it named
              the mobile-number route that no longer exists. This is the only
              place the grade rule CAN be stated: a failed sign-in has to give
              the same answer whatever the reason, or someone could learn which
              addresses are on the school's roll. "EY" is the school's name for
              the two kindergarten years, which `allowsStudentLogin` treats as
              grade 0, and "email id" is theirs too — do not tidy either. */}
          <p className="field-lede">
            Parents should sign in with the Google account on the school's email address
            registered against their child. You will only have access to the trip details
            relevant to your child's grade.
          </p>
          <ul className="field-note">
            <li>
              <strong>EY to Grade 6:</strong> Parent login is required, using the school's email
              id registered for the child.
            </li>
            <li>
              <strong>Grade 7 onwards:</strong> Students may sign in with their own school email
              address, and parents may also sign in with theirs.
            </li>
          </ul>

          {googleEnabled ? (
            <>
              <GoogleButton onIdentity={onGoogleIdentity} onError={setError} disabled={busy} />
              <p className="auth-hint">
                {busy
                  ? 'Checking the school records…'
                  : 'Already signed in to Google in this browser? You will be signed in automatically.'}
              </p>
              <div className="auth-badge"><code>No password to remember</code></div>
            </>
          ) : (
            /* The control still occupies its place, so the page reads the way it
               will once the client id is set — but it is a stand-in, and saying
               so is the point. Before this, an unset client id simply hid the
               Google button and left the typed box as the only way in, which is
               how a site meant to be behind a login shipped open. */
            <>
              <GoogleButtonPlaceholder />
              {/* Directly under the control it explains, and said ONCE. It was
                  briefly both a standing line here and an error box at the top
                  of the card, which read as two different problems. */}
              <div className="form-error is-under-control">{NOT_CONFIGURED}</div>
            </>
          )}

          <p className="auth-policy">
            By continuing, you agree to the school's trip communication and information policy.
          </p>
        </div>
      </div>
    </div>
  )
}
