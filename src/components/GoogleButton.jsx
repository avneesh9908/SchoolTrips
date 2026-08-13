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
        google.accounts.id.renderButton(slot.current, {
          theme: 'outline',
          size: 'large',
          width: 340,
          text: 'signin_with',
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
