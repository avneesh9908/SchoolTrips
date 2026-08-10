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
      })
      .catch((err) => { if (!cancelled) setFailed(err.message) })

    return () => { cancelled = true }
  }, [onIdentity, onError])

  if (failed) return <p className="hint" style={{ borderTop: 'none', paddingTop: 0 }}>{failed}</p>

  return <div ref={slot} className={disabled ? 'gsi-slot is-disabled' : 'gsi-slot'} />
}
