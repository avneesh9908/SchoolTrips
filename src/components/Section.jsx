/**
 * One block of the trip page. The id is what the sticky section nav scrolls to,
 * so every section that appears in the nav must render through here.
 *
 * `eyebrow` is the design's small coloured line above the heading; `tone` picks
 * its colour (safety green, carry amber, otherwise grey).
 */
export function Section({ id, title, eyebrow, tone, subtitle, aside, className, children }) {
  // A section can carry no heading at all — the Home tab is a photograph with
  // the sheet's own words on it, and a heading above that would just be one more
  // thing to scroll past. Rendering an empty head left a blank `h3` and 20px of
  // dead space, so it is omitted rather than emptied.
  const head = title || eyebrow || subtitle || aside

  return (
    <section className={className ? `section ${className}` : 'section'} id={id}>
      {head && (
        <div className={aside ? 'section-head with-aside' : 'section-head'}>
          <div>
            {eyebrow && (
              <span className={tone ? `section-eyebrow is-${tone}` : 'section-eyebrow'}>{eyebrow}</span>
            )}
            {title && <h3>{title}</h3>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {aside && <span className="section-aside">{aside}</span>}
        </div>
      )}
      {children}
    </section>
  )
}
