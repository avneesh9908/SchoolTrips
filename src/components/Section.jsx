/**
 * One block of the trip page. The id is what the sticky section nav scrolls to,
 * so every section that appears in the nav must render through here.
 *
 * `eyebrow` is the design's small coloured line above the heading; `tone` picks
 * its colour (safety green, carry amber, otherwise grey).
 */
export function Section({ id, title, eyebrow, tone, subtitle, aside, children }) {
  return (
    <section className="section" id={id}>
      <div className={aside ? 'section-head with-aside' : 'section-head'}>
        <div>
          {eyebrow && (
            <span className={tone ? `section-eyebrow is-${tone}` : 'section-eyebrow'}>{eyebrow}</span>
          )}
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {aside && <span className="section-aside">{aside}</span>}
      </div>
      {children}
    </section>
  )
}
