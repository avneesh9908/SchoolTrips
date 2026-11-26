/**
 * The sounds — a camera shutter — synthesised
 * with the Web Audio API rather than shipped as files.
 *
 * Three reasons it is done this way. No audio asset joins the repo or the deploy,
 * so nothing new has to be hosted or cache-busted; nothing is downloaded on a
 * parent's phone data; and there is no licence question over a sound effect on a
 * school's site, which an mp3 from a free-sounds site would quietly carry.
 *
 * **Sound is off until a parent turns it on.** `isMuted()` defaults to muted and
 * the choice is remembered in `localStorage`, so a phone opened in a corridor, a
 * staffroom or a waiting hall never makes a noise nobody asked for. Every play()
 * is also behind a real click, so the browser's autoplay policy is satisfied and
 * the context resumes on the gesture that needs it.
 */

const KEY = 'trips.sound'

let ctx = null

function audio() {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext || window.webkitAudioContext
  if (!Ctor) return null
  if (!ctx) ctx = new Ctor()
  // Created before a gesture, a context starts suspended; the click that calls
  // this is the gesture, so resuming here is what makes the first sound audible.
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

export function isMuted() {
  if (typeof localStorage === 'undefined') return true
  try {
    return localStorage.getItem(KEY) !== 'on'
  } catch {
    return true
  }
}

export function setMuted(muted) {
  try {
    localStorage.setItem(KEY, muted ? 'off' : 'on')
  } catch {
    /* private mode: the toggle still works for this page, it just won't be remembered */
  }
}

function noiseBuffer(ac, seconds) {
  const frames = Math.max(1, Math.floor(ac.sampleRate * seconds))
  const buf = ac.createBuffer(1, frames, ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1
  return buf
}

/**
 * A shutter is two mechanical snaps a breath apart — the mirror and the blades —
 * not one beep. Each is a very short burst of filtered noise; a tone of any kind
 * reads as a notification, not a camera.
 */
export function shutter() {
  if (isMuted()) return
  const ac = audio()
  if (!ac) return
  const snap = (at, gainPeak, hz) => {
    const src = ac.createBufferSource()
    src.buffer = noiseBuffer(ac, 0.05)
    const bp = ac.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = hz
    bp.Q.value = 0.8
    const g = ac.createGain()
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(gainPeak, at + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.045)
    src.connect(bp).connect(g).connect(ac.destination)
    src.start(at)
    src.stop(at + 0.06)
  }
  const t = ac.currentTime
  snap(t, 0.22, 2400)
  snap(t + 0.075, 0.14, 1500)
}
