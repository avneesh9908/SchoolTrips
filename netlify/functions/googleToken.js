/**
 * Verifies a Google ID token server-side.
 *
 * Why this exists: until 2026-08-21 the only credential this app asked for was
 * a typed email address or mobile number. Anyone who knew a parent's address
 * could sign in as them, and `POST /api/lookup` would hand back that family's
 * children to a bare curl. The browser-side decode in
 * `src/auth/googleSignIn.js` cannot fix that — it reads the claims without
 * checking Google's signature, and its own comment says never to trust it for
 * an access decision. Forging one is a base64 edit.
 *
 * So the browser now sends the raw credential and nothing else, and this
 * module is the only thing that turns it into an email address. No caller can
 * name the account it wants to be.
 *
 * Verification goes through Google's own tokeninfo endpoint rather than a
 * local JWKS check. That costs one HTTPS round trip per sign-in, which is the
 * right trade here — sign-ins are a handful per parent per term, and the
 * alternative is hand-rolled RSA verification and key-rotation caching in a
 * file that must stay dependency-free. If login volume ever makes the round
 * trip hurt, swap the body of `verifyGoogleIdToken` for a JWKS check; nothing
 * else needs to change.
 */

const TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo'
const VALID_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com'])
const TIMEOUT_MS = 8000

/**
 * The audience the token must be minted for. A token is only proof of anything
 * for the site it was issued to: without this check, a token any other Google
 * site issued to the same parent would be accepted here.
 */
function requiredAudience() {
  const id = (process.env.GOOGLE_CLIENT_ID || '').trim()
  if (!id) {
    // Fail closed. An unset client id must never mean "skip the check" — that
    // is exactly the open door this module was written to shut.
    throw new Error('GOOGLE_CLIENT_ID is not configured on the server.')
  }
  return id
}

/** Thrown for a token that is absent, malformed, expired or not ours. */
export class SignInError extends Error {
  constructor(message, status = 401) {
    super(message)
    this.name = 'SignInError'
    this.status = status
  }
}

/**
 * Returns { email, name } for a valid token, or throws SignInError.
 * The email is lowercased here so every caller compares the same string.
 */
export async function verifyGoogleIdToken(credential) {
  const audience = requiredAudience()

  if (typeof credential !== 'string' || credential.split('.').length !== 3) {
    throw new SignInError('Sign in with Google to continue.')
  }

  let res
  try {
    res = await fetch(`${TOKENINFO_URL}?id_token=${encodeURIComponent(credential)}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    // Google unreachable is an outage, not a bad credential — a 401 here would
    // tell the parent their account is wrong when it is not.
    throw new SignInError('Could not reach Google to confirm your sign-in. Please try again.', 503)
  }

  if (!res.ok) {
    // tokeninfo answers 400 for a bad signature and for an expired token alike.
    throw new SignInError('That sign-in has expired or is not valid. Please sign in again.')
  }

  const claims = await res.json().catch(() => null)
  if (!claims) throw new SignInError('Google returned an unreadable sign-in token.')

  if (claims.aud !== audience) {
    throw new SignInError('That sign-in was not issued for this site.')
  }
  if (!VALID_ISSUERS.has(claims.iss)) {
    throw new SignInError('That sign-in did not come from Google.')
  }
  // tokeninfo rejects an expired token itself, but exp is checked again here so
  // this function stays correct if the verification method is ever swapped.
  if (Number(claims.exp) * 1000 <= Date.now()) {
    throw new SignInError('That sign-in has expired. Please sign in again.')
  }
  if (!claims.email) {
    throw new SignInError('Google did not share an email address with us.')
  }
  // The string 'false' — tokeninfo returns claim values as strings.
  if (String(claims.email_verified) !== 'true') {
    throw new SignInError('That Google account has an unverified email address.')
  }

  return { email: String(claims.email).trim().toLowerCase(), name: claims.name || '' }
}
