import { useEffect, useRef, useState } from 'react'
import { loadGis, googleClientId, readEmailFromCredential } from '../auth/googleSignIn'

export function GoogleButton({ onIdentity, onError, disabled }) {
  const slot = useRef(null)
  const [failed, setFailed] = useState('')

  useEffect(() => {
    let cancelled = false

    loadGis()
      .then((google) => {
        if (cancelled || !slot.current) return
        google.accounts.id.initialize({
          client_id: googleClientId(),
          // Signs a returning parent in without a click. Combined with the One
          // Tap prompt below this is the whole point: nobody types an address.
          auto_select: true,
          cancel_on_tap_outside: false,
          callback: ({ credential }) => {
            try {
              onIdentity(readEmailFromCredential(credential))
            } catch (err) {
              onError(err.message)
            }
          },
        })
        // `shape: 'pill'` and the outline theme are what make this the white
        // rounded button the school asked for. It is still Google's own rendered
        // button in an iframe, not a lookalike: a custom button cannot return an
        // ID token, and the ID token is the entire credential this app verifies.
        google.accounts.id.renderButton(slot.current, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          width: 340,
          text: 'signin_with',
          logo_alignment: 'left',
        })
        // The button stays as the fallback for anyone the prompt skips — not
        // signed in to Google, several accounts, or One Tap dismissed before.
        google.accounts.id.prompt()
      })
      .catch((err) => { if (!cancelled) setFailed(err.message) })

    return () => { cancelled = true }
  }, [onIdentity, onError])

  if (failed) return <p className="hint" style={{ borderTop: 'none', paddingTop: 0 }}>{failed}</p>

  return <div ref={slot} className={disabled ? 'gsi-slot is-disabled' : 'gsi-slot'} />
}

/**
 * What the sign-in control looks like before a client id is configured.
 *
 * It is deliberately NOT wired to anything: Google's real button cannot be
 * rendered without a client id, and a lookalike that opened a working sign-in
 * cannot exist — the token has to be minted for a registered client. So this
 * shows the school the control in its place, in the state a parent will see it,
 * and says plainly why it does nothing. Clicking it repeats that.
 *
 * It disappears the moment `googleClientId` is set; nothing in production
 * should ever show it.
 */
export function GoogleButtonPlaceholder() {
  return (
    <div className="gsi-slot">
      {/* `aria-disabled` rather than `disabled`: the button must keep Google's
          exact colours to show the school what will be there, and `disabled`
          greys it out. Nothing is wired to it, so a click does nothing — the
          reason sits immediately below it. */}
      <button type="button" className="gsi-placeholder" aria-disabled="true">
        <svg viewBox="0 0 18 18" aria-hidden="true" focusable="false">
          <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
          <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
          <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
          <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
        </svg>
        <span>Sign in with Google</span>
      </button>
    </div>
  )
}
