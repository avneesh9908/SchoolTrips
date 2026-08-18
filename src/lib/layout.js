/**
 * Which trip-page layout to render.
 *
 *   'stage'      — the current design: ONE page. Overview is a full-bleed cover
 *                  photograph, every other section is stacked under it in a centred
 *                  column, and the pill bar is a jump nav rather than a tablist.
 *                  Asked for 2026-08-17: "remove tabs like different page make single
 *                  page with header".
 *   'stage-tabs' — the same design as tabs, one section at a time, page scrolling and
 *                  a tab click scrolling to the top of the panel.
 *   'stage-fit'  — the same design as tabs, locked to the window: nothing scrolls, and
 *                  a list too long for its card scrolls inside the card.
 *   'flow'       — the FIRST one-page attempt, in the pre-Fraunces styling: sections
 *                  stacked in `.sections.is-flow` with left-aligned heads. Superseded
 *                  by 'stage' — same shape, older design — and kept only because it is
 *                  what the school was shown that morning.
 *   'fixed'      — the 2026-08-14 view: left-aligned underline tabs, one panel filling
 *                  the window, window never scrolls.
 *
 * Five values because the school changed its mind five times in one day — tabs, then
 * one page, then tabs again, then scrolling, then one page. Each costs a line to
 * restore, so none of them has been thrown away. It lives in its own module because
 * `App` and `TripPage` both read it, and putting it in either one makes them import
 * each other.
 */
export const TRIP_LAYOUT = 'stage'
