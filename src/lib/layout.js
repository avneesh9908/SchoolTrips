/**
 * Which trip-page layout to render.
 *
 *   'stage-tabs' — the CURRENT one: the stage design as tabs, one section at a time,
 *                  the page free to scroll when a section needs it, and a tab click
 *                  scrolling back to the top of the panel. Asked for 2026-08-17
 *                  ("now first convert this tabs wise").
 *   'stage'      — the same design as ONE page: Overview a full-bleed cover, every
 *                  other section stacked under it, the pill bar a jump nav rather than
 *                  a tablist. Asked for earlier the same day ("remove tabs like
 *                  different page make single page with header").
 *   'stage-fit'  — the same design as tabs, locked to the window: nothing scrolls, and
 *                  a list too long for its card scrolls inside the card.
 *   'flow'       — the FIRST one-page attempt, in the pre-Fraunces styling: sections
 *                  stacked in `.sections.is-flow` with left-aligned heads. Superseded
 *                  by 'stage' — same shape, older design — and kept only because it is
 *                  what the school was shown that morning.
 *   'fixed'      — the 2026-08-14 view: left-aligned underline tabs, one panel filling
 *                  the window, window never scrolls.
 *
 * Both stage shapes share one nav (`StageNav`), which is a row of pills on a wide window
 * and a menu on a phone — so switching between them cannot lose the phone menu, which is
 * exactly what happened the first time tabs came back.
 *
 * Five values because the school changed its mind five times in one day — tabs, then
 * one page, then tabs again, then scrolling, then one page. Each costs a line to
 * restore, so none of them has been thrown away. It lives in its own module because
 * `App` and `TripPage` both read it, and putting it in either one makes them import
 * each other.
 */
export const TRIP_LAYOUT = 'stage-tabs'
