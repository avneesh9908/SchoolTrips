/**
 * Two drawn scenes that sit beside the school's own guideline decks: a child
 * packing a bag next to "Things to carry", and a class walking in line next to
 * "Safety".
 *
 * **They illustrate, they never instruct.** Not one item or rule here is read
 * from the sheet and none is presented as the school's advice — the deck beside
 * them is the content, and these say only "this page is about packing" and
 * "this page is about keeping together". That is why both are `aria-hidden` and
 * why nothing in them is a list a parent could mistake for the packing list.
 *
 * Drawn from elements, gradients and a handful of characters: no image is
 * fetched, nothing is added to the deploy, and there is no licence question
 * over an illustration on a school's site.
 */

/**
 * The items the child packs. Deliberately generic school-trip things — a bottle,
 * a torch, a cap — and deliberately SIX, because the arc each one flies is a
 * per-item delay and six is as many as read as a sequence rather than a swarm.
 */
const PACK_ITEMS = ['\u{1F9F4}', '\u{1F526}', '\u{1F9E2}', '\u{1F45F}', '\u{1FAAA}', '\u{1F34E}']

export function PackingScene() {
  return (
    <div className="scene scene-pack" aria-hidden="true">
      <div className="pack-sky">
        <span className="pack-sun" />
        {[0, 1, 2].map((i) => <span key={i} className={`pack-cloud pc${i}`} />)}
      </div>

      {/* The child: a head, a body and an arm that swings as each item leaves it. */}
      <div className="kid-pack">
        <span className="kid-head" />
        <span className="kid-body" />
        <span className="kid-arm" />
      </div>

      {/* One span per item, each flying its own arc on its own schedule. */}
      <div className="pack-items">
        {PACK_ITEMS.map((ch, i) => (
          <span className={`pack-item pi${i}`} key={i}>{ch}</span>
        ))}
      </div>

      <div className="bag">
        <span className="bag-flap" />
        <span className="bag-pocket" />
        <span className="bag-strap l" />
        <span className="bag-strap r" />
      </div>

      <span className="pack-ground" />
    </div>
  )
}
