import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { googleSignInEnabled } from '../auth/googleSignIn'
import { GoogleButton } from '../components/GoogleButton'

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
    <div className="auth-wrap">
      <div className="auth-card">
        <h2 className="display">Parent sign in</h2>
        <p className="lede">
          Use the email address or mobile number the school has on record for you. You will
          only see the trip details for your own child's grade.
        </p>

        {error && <div className="form-error">{error}</div>}

        {googleEnabled && (
          <>
            <GoogleButton onIdentity={onGoogleIdentity} onError={setError} disabled={busy} />
            <div className="or-rule"><span>or</span></div>
          </>
        )}

        <form onSubmit={submit}>
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
      </div>
    </div>
  )
}
