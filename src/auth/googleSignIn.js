import { config } from '../config'

const GIS_SRC = 'https://accounts.google.com/gsi/client'

export const googleClientId = () => config().googleClientId
export const googleSignInEnabled = () => !!config().googleClientId

let loader = null

/** Loads Google Identity Services once, shared across mounts. */
export function loadGis() {
  if (!googleSignInEnabled()) return Promise.reject(new Error('Google Sign-In is not configured.'))
  if (window.google?.accounts?.id) return Promise.resolve(window.google)
  if (loader) return loader

  loader = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.defer = true
    script.onload = () => {
      if (window.google?.accounts?.id) resolve(window.google)
      else reject(new Error('Google Sign-In loaded but did not initialise.'))
    }
    script.onerror = () => {
      loader = null
      reject(new Error('Could not reach Google Sign-In. Check your connection and try again.'))
    }
    document.head.appendChild(script)
  })
  return loader
}

/**
 * Reads the email out of the ID token.
 *
 * This is a decode, NOT a verification — the browser cannot check Google's
 * signature safely, and anyone can hand-write a token whose payload says
 * whatever they like. So the raw `credential` is returned alongside the
 * claims and it is the credential, never the email, that goes to the server:
 * `netlify/functions/googleToken.js` verifies the signature and the audience
 * there, and reads the address out of the verified token itself.
 *
 * The decoded email is used for two cosmetic things only — greeting the parent
 * before the server answers, and the demo adapter that runs against local CSV
 * fixtures. Never trust it for a real access decision.
 */
export function readEmailFromCredential(credential) {
  const payload = credential?.split('.')[1]
  if (!payload) throw new Error('Google returned an unreadable sign-in token.')
  const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
  const claims = JSON.parse(decodeURIComponent(escape(json)))
  if (!claims.email) throw new Error('Google did not share an email address with us.')
  if (claims.email_verified === false) throw new Error('That Google account has an unverified email address.')
  return { email: String(claims.email).toLowerCase(), name: claims.name || '', credential }
}
