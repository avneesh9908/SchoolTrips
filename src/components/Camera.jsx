import { useCallback, useRef, useState } from 'react'
import { isMuted, setMuted, shutter } from '../lib/sfx'
import { reducedMotion } from '../lib/journey'

/**
 * The camera on the photos tab: a shutter that fires on the click that opens a
 * picture, and the one switch in the app that can make it audible.
 *
 * Both halves are strictly decorative. The flash is `pointer-events: none` and
 * mounted *beside* the link rather than over it, so it can never swallow the tap
 * it is reacting to; the sound is off until a parent turns it on, and `sfx.js`
 * refuses to make a noise until they do.
 */

const FLASH_MS = 420

/**
 * Returns the overlay to render and the handler to pass to each tile. Held in one
 * place per tab rather than per tile, so two quick taps re-fire one flash instead
 * of stacking two over each other.
 *
 * `seq` is what makes the re-fire work at all: React will not replay a CSS
 * animation on an element it considers unchanged, so each snap mounts a *new* one.
 */
export function useShutter() {
  const [seq, setSeq] = useState(0)
  const timer = useRef(null)

  const snap = useCallback(() => {
    shutter()
    if (reducedMotion()) return
    setSeq((n) => n + 1)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setSeq(0), FLASH_MS)
  }, [])

  const flash = seq ? <span className="shutter-flash" key={seq} aria-hidden="true" /> : null
  return { flash, snap }
}

export function SoundToggle() {
  // Read once at mount. The value only ever changes through this button, so there
  // is nothing else to stay in step with.
  const [on, setOn] = useState(() => !isMuted())

  const toggle = () => {
    const next = !on
    setMuted(!next)
    setOn(next)
    // The turn-on is itself the gesture the browser wants before any audio plays,
    // so the confirming click doubles as the unlock.
    if (next) shutter()
  }

  return (
    <button
      type="button"
      className={on ? 'sound-toggle is-on' : 'sound-toggle'}
      onClick={toggle}
      aria-pressed={on}
    >
      <span className="wave" aria-hidden="true"><i /><i /><i /></span>
      {on ? 'Sound on' : 'Sound off'}
    </button>
  )
}
