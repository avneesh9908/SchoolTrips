---
name: school-trips
description: Source of truth for the schoolTrips "Trip Explorer" React app — a parent-facing, grade-gated educational-trip site fed by Google Sheets. Read at the start of every session and every turn; curate after each exchange.
---

# schoolTrips — Trip Explorer

## What this is
A **React (Vite) single-page app** for parents. A parent signs in with the email address or
mobile number the school has on file and sees the trip plan for **their own child's grade
only**. All content
is authored by school management in Google Sheets — nothing is hard-coded.

Superseded the original single-file HTML prototype, which is kept unmodified at
`legacy/trip-explorer.html` for design reference. Its Artifact lives at
`https://claude.ai/public/artifacts/4e6c7575-5375-4976-ab4b-8feb1dd6ffed`.

Stack: React 18, react-router-dom 6, Vite 5, plain CSS with custom properties. No UI
library, no state library, no TypeScript.

## Layout
```
index.html            Vite entry
.env.example          adapter + sheet id configuration
docs/SHEET-SCHEMA.md  the tab/column contract, written for a developer
docs/DATA-HANDOVER.md the same contract written for school staff, plus the open
                      decisions management must settle — use this in meetings
docs/ARCHITECTURE.md   three diagrams + the reasoning; docs/diagrams/*.svg are
                      hand-written, self-contained, no build step
docs/WHERE-TO-CONNECT.md the one-field answer: public/config.json → sheetId
docs/CONNECT-SHEET.md step-by-step: upload the workbook, share it, paste the link
scripts/             generate_template.py (empty workbooks), generate_setup_deck.py
sample-data/         EMPTY template workbook + the setup-guide deck for management
sample-data/split/   the master-links-to-separate-sheets layout: Trip Master.xlsx
                      (Settings only) plus one workbook per source
public/config.json    the live pointer; there is deliberately no committed .env
public/trip-guidelines.json  committed fallback guideline TEXT, per grade (see below)
legacy/               original single-file prototype (reference only)
src/
  main.jsx            BrowserRouter > AuthProvider > App
  App.jsx             routes + footer
  auth/               AuthContext, RequireAuth / RequireStudent
  components/         Icon, Section, DocCard, TopBar, States
  data/               index (adapter pick), sheetsAdapter, apiAdapter, csv,
                      normalize, useTrip, useTripTitles, guidelineFallback
  lib/                grades, phone, docPreview, tripPhoto
  pages/              Login, ChildPicker, TripPage
  styles/             tokens.css, global.css
```

## Routes
| Path | Guard | Renders |
|---|---|---|
| `/login` | none | email-or-mobile entry, plus Google button when configured |
| `/children` | `RequireAuth` | child picker — **always shown, even for a single child** |
| `/trip/:gradeId` | `RequireStudent` | the trip page |
| `*` | — | redirect to `/children` |

## Access control — the important part
One login box takes **either an email address or a mobile number**;
`classifyIdentifier()` branches on the presence of `@`.

- **Email** → matched case-insensitively against `FatherEmail`.
- **Mobile** → matched on the **last 10 digits** of `FatherPhone`. Handles `+91`, leading
  `0`, spaces, dashes, Excel-numeric cells.
- **A student row is reachable by whichever of the two columns is filled in.** Both blank
  → the child is reachable by nobody. This is the answer to "why can't this parent log in".
- The session holds `students`, `grades` (derived from the matched rows), `activeStudentId`,
  plus `via` (`email` | `phone` | `google`) and `identifier`. **Grade is derived in
  `AuthContext` and nowhere else** — no screen reads a grade from the URL or user input.
- `TripPage` calls `canAccessGrade(gradeId)` before mounting; `useTrip` is passed
  `enabled: false` when it fails, so an unauthorised grade **never triggers a fetch**.
  Verified: `/trip/g5` as a G7 parent shows "Not your child's grade" and issues no request.
- Session lives in `sessionStorage`, keyed `schoolTrips.session`; ends with the tab.

### Google Sign-In — the no-typing path
Reworked 2026-08-12 so a parent never types anything. `GoogleButton` initialises GIS with
`auto_select: true` and calls `google.accounts.id.prompt()`, so **One Tap signs a returning
parent in with no click at all**; the rendered button stays as the fallback for anyone the
prompt skips (not signed in to Google, several accounts, previously dismissed). `logout` calls
`disableAutoSelect()` — without it One Tap re-signs the same account instantly and nobody can
switch.

Both credential paths now go through one `resolveIdentity({kind, value})` in `AuthContext`.
Before that, `loginWithGoogle` treated the adapter's `{role, students}` object as an array:
`students.length` was `undefined`, the empty check never fired, and `startSession` crashed on
`students.filter` — so **Google sign-in was broken for the whole server path, and staff signing
in with Google lost admin**. Keep the two paths sharing that resolver.

**Still needs a client id.** `googleClientId` is blank in `config.local.json`, so the button is
hidden and none of the above has run against real Google. Local origin to authorise:
`http://localhost:5180`.

### Google Sign-In (configuration)
Set `VITE_GOOGLE_CLIENT_ID` and the login page renders a Google button above the typed box;
blank and it is hidden entirely. `googleSignIn.js` lazy-loads Google Identity Services once,
and `loginWithGoogle` matches the returned address against `FatherEmail` — access still
depends on the sheet, Google only proves the address is really theirs.

**`readEmailFromCredential` decodes the ID token, it does not verify it** — the browser
cannot check Google's signature safely. Fine while the sheets are world-readable anyway;
once the `api` adapter is live the backend must verify the raw credential itself. The
`api` contract carries `kind: 'google'` with the raw credential for exactly this.

Without a client id there is **no verification at all** — anyone who knows a registered
email or number can sign in as that parent. `login` / `loginWithGoogle` are the seams.

### The standing security caveat
With `VITE_DATA_SOURCE=sheets` the spreadsheet must be world-readable and its id ships in
the JS bundle — any parent can open the raw sheet and read every family's row. The grade
filter is then **UI convenience, not a security boundary**. Real per-grade control needs the
`api` adapter backed by a service that holds a service-account key. Restate this whenever
someone proposes going live on the sheets adapter.

## Data layer
`src/data/index.js` picks an adapter from `VITE_DATA_SOURCE`, defaulting to `mock`.

| id | Source | Notes |
|---|---|---|
| `mock` | `src/data/mock/rows.js` | default; ~250ms simulated latency; UI shows a "Sample data" tag |
| `sheets` | **`pub?output=xlsx` when a `publishedId` is set** (the only export keeping chip links), else `gviz/tq?tqx=out:csv` per tab, **or local CSVs when `VITE_SHEET_CSV_BASE` is set** | tolerates missing optional tabs via `Promise.allSettled`; detects Google's sign-in HTML; the workbook read falls back to CSV on any failure (see below) |

**A private sheet answers `401` with an HTML sign-in page**, measured 2026-08-12 against the
Grade 7 vendor sheet — not the 200-with-HTML that was assumed. `fetchCsv` catches it either
way: `!res.ok` throws "Check the spreadsheet is shared publicly", and the `<` sniff catches the
200 case. Both messages are right; the fix is always "Anyone with the link → Viewer".
`curl -s -o /dev/null -w "%{http_code}" "<gviz url>"` is the fastest way to tell a sharing
problem from a schema problem.
| `api` | your backend | contract documented at the top of `apiAdapter.js`; exposes `lookup()`, which `AuthContext` prefers when present |

Adapters expose `fetchStudents()` and `fetchTripSets(gradeId)`. An adapter may also expose
`lookup({kind, value})`; when present `AuthContext` delegates the whole credential match to
it instead of filtering a roster client-side. Only `apiAdapter` does today.

### The content sheet is "Trip app", and it stays Restricted
`docs.google.com/spreadsheets/d/1PCCOY90IM_6sgdx8fOH5kgxyHtkYN8tfIsUc5n_TIT4` — owned by
Falguni Jariwala, six named editors, **General access: Restricted**. Measured 2026-08-12: gviz
CSV → 401, `export?format=csv` → 401, published URL → 404. Editor access granted to a person
does nothing for the app, which fetches anonymously.

The user chose **Publish to web** over link-sharing (2026-08-12), so the document itself must
stay Restricted — do not propose "Anyone with the link" again as the fix.

`publishedId` in config takes the `File → Share → Publish to web` link. Its id is the long
`2PACX-…` in `/spreadsheets/d/e/<id>/pub` and **cannot be derived from the file id**, which is
why it is a separate value. `parsePublishedRef` deliberately returns `null` for a normal `/d/<id>/edit`
link so a mis-paste fails loudly instead of building a broken URL, and `urlsFor` never falls
back from a published id to gviz — that fallback would 401 and look like a broken sheet.

**Published tabs are addressed by gid only** — there is no `sheet=` parameter on `/pub`. Put
each tab's gid in `gids`; with none set Google serves the first tab, which is correct for a
single-tab workbook. Choose **Entire document** when publishing, or other tabs stay unreachable.

### The school's real schema — ONE flat tab, not eight
`src/data/tripApp.js` reads the "Trip app" sheet, whose columns are:

`Grades | Destination | Dates | Starting Text | Parent Orientation | Student Orientation |
Itinerary (nucleus) (link) | Travel details | Safety`

One **row-group per grade, one row per batch**. `looksLikeTripApp(rows)` picks the shape from
its headers — never a config flag — and `useTrip` routes to `assembleTripApp` instead of
`assembleTrip`. The eight-tab schema still works for the other shape.

- **The Grades cell is merged**, so CSV carries it only on the group's first row.
  `groupByGrade` carries it forward; without that every batch after the first silently vanishes.
- The `Dates` cell holds the batch dates on line 1 and its sections below. Line 1 goes in the
  hero, the rest into a **Batches and sections** block — that block is how a parent knows which
  batch their child is in.
- `Travel details` is prose per batch, not structured legs: it renders as one block per batch
  with `white-space: pre-wrap`, and the Train/Departure grid is hidden when those fields are
  empty rather than printing a row of em dashes.
- Verified against a CSV transcribed from the real sheet: G7 → title, both batch date lines,
  full starting text, both travel blocks with line breaks intact.

### SOLVED 2026-08-13: the chip links are in the WORKBOOK export
**The long-standing "nothing can recover a chip's URL" conclusion was wrong, and is corrected
here.** It was true of the CSV and only of the CSV.

| Export of the same published sheet | Chip URLs |
|---|---|
| `…/pub?output=csv` | **0** — display text only ("Pics for trips", "safety-guidelines-poster") |
| `…/pubhtml` | **0** — the only `href` in the page is Google's favicon |
| **`…/pub?output=xlsx`** | **22** — every one, in `xl/worksheets/_rels/sheet1.xml.rels` |

A `.xlsx` is a ZIP of XML: the worksheet lists `<hyperlink ref="L3" r:id="rId7"/>` and the rels
file resolves `rId7` to the Drive URL. `src/lib/xlsx.js` reads it with **no dependency** —
`DecompressionStream('deflate-raw')` inflates, `DOMParser` parses — and `src/data/xlsxSheet.js`
turns a worksheet into the same row objects `csvToObjects` produces plus a `LINKS` map of
cell → URL. `sheetsAdapter.loadSheet` reads the workbook whenever the source is a published
document and **falls back to the CSV on any failure**, so an old browser or a withdrawn publish
costs the links and nothing else. Verified by deleting `window.DecompressionStream`: the page
still rendered, with the pending cards back.

`LINKS` (`'__links'`) lives on the row and `normalizeRow` passes it through **unnormalized on
purpose** — normalized it would become `links` and could collide with a real column. Anything
that iterates a row's entries must skip it; `groupByGrade`'s empty-row check does, or an object
value makes every blank row look filled.

The workbook is fetched **once per page load** (`loadWorkbook` caches by URL) — the seven trip
sources share one download, confirmed as a single request in the browser.

**Chip links are resolved in EVERY column, including the three text ones (2026-08-14).** This
reverses the rule set on 2026-08-13, which held them back for `TEXT_COLUMNS` on the argument that
a working poster link makes Safety / Do-Don't's / Things to carry look finished while the text a
parent actually needs is still missing. That argument lost to reality: the sheet's text cells have
stayed chips, so the real choice was a link a parent can open versus a dashed card they cannot.
The `chipLinks` option is **deleted**, not just flipped — `documentsFrom` has no such parameter
now. `fileNamesOnly` still stands, so prose in a text column is printed rather than carded, and a
cell that later receives real text stops being a chip and prints as text with no code change.

Result on the live sheet (re-measured 2026-08-14, after chip links were switched on everywhere):
Grade 7 has **zero pending cards on any tab**. Documents shows 5 links (both batches' parent and
student decks + the itinerary), Photos 2 folders, **Safety 2 posters and Things to carry 1** —
the last three being the ones that used to be dashed. The hero's "View itinerary" button appears
because the itinerary has a URL. `readableName` (slug → "Safety guidelines poster") supplies the
label for all of them.

**The next blocker is sharing, not export.** Of the 18 distinct files linked from the sheet,
**3 answer 200 and 15 redirect to `accounts.google.com/ServiceLogin`** (measured 2026-08-13) — a
parent clicking those gets a sign-in or request-access page. Open: the G7 B1 parent deck, one G7
B2 deck, and the `Grade 7-Rajasthan` folder. Everything else, including the **G7 pic folder and
the itinerary doc**, is private. The school must set each to "Anyone with the link → Viewer".
This is the same shape as the thumbnail finding below, and it is now the only thing between a
parent and the files.

**Historical (2026-08-12), kept because it explains the pending-card design:** the CSV read
showed `0 of 22` filled link cells carrying a URL, and the conclusion drawn was that nothing in
the app could be opened. That was right about the CSV and wrong as a general statement.

**Reversed 2026-08-12 at the user's request ("I want all things sheet here"):** dropping chip
cells hid Orientation, Itinerary, Photos and Guidelines completely — Grade 7 showed only Overview
and Travel, and a parent could not tell an orientation deck existed at all. `documentsFrom` now
emits a **pending card** for a chip cell: `{label: <the chip's own name>, url: '', pending: true}`.
`DocCard` renders `pending` as a dashed, non-clickable `<div>` (never an `<a>` — there is nothing
to open) with the meta "<category> · link not added yet", and its icon comes from `PENDING_KIND`
since no URL means no readable kind. One `PendingNote` per panel, not per section or per card,
explains it and points at the grade coordinator. The `console.warn` listing the exact cells to fix
is unchanged.

For the three **text** columns this is gated by `fileNamesOnly`: only a leftover chip slug
(`looksLikeFileName`) becomes a card there, because prose in those cells is guidance to print, not
a lost link.

The full published column list (13): `Grades | Destination | Dates | Starting Text | Parent
Orientation | Student Orientation | Itinerary (nucleus) (link) | Travel details | Safety
guidelines | Do/Dont's | Things to carry | Pic folder (link) | last years pic for adding in page`.
Safety, do's/don'ts and packing are **posters, not text**, so they map to document cards, and
`assembleTripApp` returns empty `safety`/`dos`/`donts`/`carry` arrays.

**An unreadable grade cell ends the group, it does not inherit.** The sheet's last row is `MlC`
(Manali). Carrying the previous grade forward filed it under Grade 11, which would have shown
one group's trip to another group's parents. A non-empty unreadable cell now clears the current
grade and warns.

Live state per grade: g7 Jaipur-Abhaneri-Ranthambore (2 batches, 2 travel blocks), g8
Jabalpur-Panchmarhi (2/2), g10 Jodhpur & Jaisalmer (2 batches, no travel), g9 and g11 hold only
the shared boilerplate `Starting Text`, g12 has no row at all.

### Two sources, and only two
**Login → the roster behind `rosterApiUrl`. Everything else → one spreadsheet in `sheetId`.**
Set by the user on 2026-08-12; the per-source `sheetIds`, the `Settings` index tab and
Drive-folder discovery were deleted that day. Five ways to point at content meant five ways for
it to go quietly missing. Do not reintroduce a second content source without being asked.

`expandFolderDocuments` survives — a Drive **folder link inside a Documents row** still becomes
one card per file when `driveApiKey` is set. That is content enrichment inside the one sheet,
not a source of its own.

Tab names are the address and live in `TAB_NAMES` (`sheetsAdapter.js`). **File names are never
read** — only tab names. A renamed tab silently empties that section; `gids` is the escape
hatch, since a gid survives renames.

`Students`, `Trips`, `Itinerary`, `Documents`, `Guidelines`, `Reminders`, `Travel`, `Media`.
Every tab except Students carries a `Grade` column. `assembleTrip(gradeId, sets)` folds the
flat rows into the object `TripPage` renders. Full contract in `docs/SHEET-SCHEMA.md`.

`Guidelines` is one tab holding four list types discriminated by a `Type` column
(`Safety` / `Do` / `Dont` / `Carry`) — deliberately, so the school manages one sheet.

### No dummy data — real sources only
All invented content was deleted on 2026-08-11: the demo roster and trip CSVs, `mockAdapter`
and `mock/rows.js`, the fake Drive listing fixture, and the fabricated orientation deck.
**There is no mock adapter and no demo mode**; `dataSource` defaults to `sheets` and
`ADAPTERS` holds only `sheets` and `api`. `isMock()` is gone.

`scripts/generate_template.py` (replacing `generate_sample_data.py`) emits an **empty**
workbook — headers, widths, freeze pane and validation dropdowns on `Grade`, `Type` and
`Status`, no rows except the fixed `Settings` keys. Do not add example rows back: shipping
them is how invented trips would reach parents.

**Current state (corrected 2026-08-13):** login works against the real roster, and the school's
published "Trip app" sheet **is** the content source — `publishedId` is set in the committed
`config.json`, and grades 7, 8, 9 and 10 render real content with working document and photo
links. Grades with no row still read "Nothing published yet", which is correct behaviour, not a
bug — do not "fix" it by reintroducing sample data. (The paragraph that used to sit here said no
content source existed; that was true before 2026-08-12.)

`folderId` is deliberately blank; see the warning about the school's real folder below.

### Header and value tolerance — do not weaken this
The school owns the sheets and renames things without warning, so:
- `normalizeKey()` lowercases and strips all non-alphanumerics, making `Father Name`,
  `father_name` and `FatherName` the same key. **Mock rows keep human casing, so
  `mockAdapter` must run them through `normalizeRow` first** — skipping that was a real bug
  that silently broke login.
- `pick(row, ...aliases)` reads the first alias actually present.
- `normalizeGradeId()` accepts `7`, `Grade 7`, `grade-7`, `Class 7`, `VII`, `JK`. Anything
  unreadable yields `''` and the row is dropped — a grade typo makes a row vanish silently.
- `parseCsv()` is a real RFC4180 parser; Google quotes any cell with a comma or newline, so
  `split(',')` mangles multi-line overview text.

## Document previews
Requirement was **image preview, click through to the real doc** — not live iframes (the
prototype used iframes; that was deliberately dropped).

`describeDoc(url)` classifies a Google URL into `slides | doc | sheet | form | folder |
file | link` and returns `thumb` = `drive.google.com/thumbnail?id={id}&sz=w1000`, which
serves Docs, Slides, Sheets, PDFs and images from one URL shape.

`thumb` is null for **folders and Forms** — neither has a single renderable page.
`DocCard` tracks a `broken` flag and swaps to a typed placeholder tile on `onError`, so a
non-public file degrades gracefully and still opens on click.

**Confirmed behaviour:** the thumbnail endpoint only answers for files shared "anyone with
the link → Viewer". The five sample Grade-7 documents are private, so they all render the
fallback tile locally. External images are not blocked in general (a Google favicon loads
fine) — it is specifically the private Drive files that 403. Do not chase this as a bug.

## Cards vs text — the school's rule for the trip page
Set 2026-08-12 and it drives the whole layout. **Four columns are files → clickable cards**
(`DocCard`, opens in a new tab): Parent Orientation, Student Orientation, Pic folder,
Itinerary (nucleus). **Five are text → printed on the page**, so a parent never opens a
document to read them: Header Text, Travel details, Safety guidelines, Do/Dont's, Things to
carry.

**Page order, final for 2026-08-14: the tab bar is the first thing under the header, then one
panel.** Nothing sits above the tabs. The hero's "View photos" / "View itinerary" buttons and
`openTab()` were **deleted** — nothing on this page scrolls the window any more.

Three things above the tabs were removed across two passes that day, each crossed out on a
screenshot by the user. Do not rebuild any of them:
- **`TripHero`** and `.trip-hero` / `.th-*` — its grade, trip name and dates are on the Overview image.
- **`FactBar`** and `.factbar` / `.fact` — same.
- **`TopLine`** and `.trip-topline` — the back link and grade name. The top bar already carries
  "All grades" for staff and names the grade beside the account, so the row was pure repetition.

**Removing `TopLine` needed a matching change in `TopBar`:** its "Switch child" button used to appear
only for `students.length > 1`, so a one-child parent lost their only route back and was stranded on
the trip page. It now shows for any parent with an active student, labelled "Switch child" or
**"My child"**. Verified: a one-child parent gets "My child" and it reaches `/children`.

`PhotosSection` renders a `photo-masonry` of `PhotoTile`s when the sheet holds image URLs, plus a
`DocCard` block for album folder links; with neither, `buildSections` never creates the section.
`PhotoTile` swaps to a typed tile on `onError`, since a Drive image that is not link-shared 403s
and would otherwise leave a white gap.

### The trip page is a FIXED-HEIGHT view — the window never scrolls
Set 2026-08-14: *"I don't want scrollbar anywhere."* `App.jsx` puts `is-fixed` on `.app` for any
`/trip/` path, which makes the route fill the window exactly, and **drops the site footer** — ~117px
of chrome was the difference between fitting and not, and its one line of copy points at the trip
page the reader is already on. `/children` and `/login` are unaffected: the picker still scrolls and
still has its footer.

Three things in that CSS are load-bearing:
- **`100dvh`, never `100vh`.** On a phone `100vh` is the address bar's tallest state, so a vh-sized
  page overflows by the bar's height and scrolls — the exact thing being removed.
- **`min-height: 0` down the whole chain** (`.app.is-fixed` → `.page` → `.shell` → `.sections`). A
  flex child refuses to shrink below its content without it, and the overflow pops back out at the
  window.
- **`.sections` is `display: block` when it scrolls, and `flex` only for Overview.** See the trap
  below — this one silently hid content.

`heroBatch` / `heroDates` survive as the Overview image's meta line. `heroBatch` says `Batch 1` only
when `trip.batchMatched`; otherwise "All N batches", because naming one batch would be wrong when
every batch is shown. `heroDates` strips the `Batch N:` prefix from **both** the matched and the
all-batches case — the sheet's headlines carry it verbatim and Grade 7 has it wrong on both rows, so
staff were reading "Batch 1: 12-19 December · Batch 1: 13-20 December".

#### The trap: `overflow: hidden` hides overflow from `scrollWidth`, so measure element rects
`.app.is-fixed { overflow: hidden }` means content wider or taller than the window is **clipped, not
scrolled** — so `documentElement.scrollWidth - innerWidth` reads **0 whether the layout fits or not**.
A whole round of "zero horizontal overflow" measurements was worthless for that reason, and the user
had to send screenshots of cards sliced off at the right edge and headings sliced by the tab bar.

Verify the fixed layout by walking `.sections *` and comparing each `getBoundingClientRect()` against
`innerWidth` / `innerHeight`, skipping anything inside `.chip-lines` (its own scroller, legitimately
clipping its own content). Zero is the pass. Also assert `secnav.bottom <= sections.top` — the two
must not overlap — and check the gap under the header is the page padding (18px) and nothing more.

#### The trap: `position: sticky` still applies inside an `overflow: hidden` box
`.secnav` kept `position: sticky; top: var(--header-h)` after the page became fixed-height. Because
`overflow: hidden` makes `.app.is-fixed` a **scrollport**, the `top: 66px` offset was still honoured:
the bar was pushed 66px **down out of its flow slot**, which simultaneously
- left an **84px empty band** under the header (its vacated flow slot), and
- laid the bar **on top of the panel**, slicing the first heading ("Orientation") and the first batch
  row — exactly what the screenshots showed.

`.app.is-fixed .secnav { position: static; }` fixes both. Nothing needs to stick any more: the panel
is the scroller and the bar sits outside it. Measured after: gap 84 → **18**, `navOverlapsPanel`
false on all five tabs, at 1280×720 **and** 1920×1080, on both data paths.

#### The trap: a flex panel cannot be scrolled, and fails silently
Caught by measurement 2026-08-14 and worth the paragraph. With `.sections` as a flex column and its
section allowed to shrink (`min-height: 0`), the section's box settled at the container height while
its content painted *outside* it — so `scrollHeight === clientHeight`, the panel reported nothing to
scroll, and **Safety's last four measures were unreachable**. Nothing looked broken; the content was
just gone.

`.sections` is therefore `display: block` in the fixed layout, which measures its content honestly,
and `.sections.is-fill` (flex, `overflow: hidden`) is used only for Overview. `is-fill` is a **class
set in `TripPage`, not a `:has(#home)` rule** — the distinction decides whether a tall panel can be
scrolled at all, so it should be explicit. `.sections` only ever has one child, so the flex `gap` it
used to rely on was doing nothing.

Verify this the same way if it is ever touched: per tab, assert `scrollHeight > clientHeight` **and**
that the last `.acc-item` / `.doc-card` / `.check-item` is reachable after `panel.scrollTop =
panel.scrollHeight`. Measured at 1280×720 — Overview 538/538 (no scroll), Safety 917, Itinerary
1649, all last children reachable, `window` scroll 0 on every tab.

**Scrollbars are hidden on the panels** (`scrollbar-width: none`, matching `.secnav-inner`), per the
instruction.

**On desktop nothing scrolls at all any more** — after the Travel split, the compact Orientation cards
and the 90px chip previews, every tab's panel fits. Re-measured 2026-08-14 at 1280×720, both data
paths: window scroll 0 **and panel scroll 0** on all five tabs.

**On a phone the panels still scroll**, and that is unavoidable: at 375px the three side-by-side
guideline columns stack into three, so Itinerary runs ~694px past the panel (Orientation 229, Travel
196). The window still never scrolls. Do not try to "fix" this by shrinking the columns further — at
375px wide three columns abreast would be illegible.

**The Confirmed / "Details coming soon" pill is gone.** `assembleTripApp` sets
`status: 'confirmed'` unconditionally, so the pill never said anything true. Do not reintroduce it
without a real status column.

### The photograph — the school's own, one per page, and one only
`lib/tripPhoto.js` reads `config().tripPhotos`, a **grade id → image URL** map. That is the whole
mechanism: nothing is searched for, nothing is inferred from the destination, and a grade with no
entry shows no photograph at all.

It replaced `lib/destinationPhoto.js` (Wikipedia search, **deleted** 2026-08-14) at the user's
instruction — they supply the real photograph of the real trip. The old module's credit chip
(`th-credit`) went with it. Do not reintroduce a photo lookup: an illustrative picture of a place
reads to a parent as a picture of their child's trip, which is why the credit was mandatory before
and why no photo is now preferable to a found one.

The photo lives on the **Overview tab and nowhere else** — `HomeSection`'s `.home-banner`. There is
**exactly one image on the page** (asserted in verification); the old Overview block's second copy of
it was the "remove second image" instruction. It is **not** `loading="lazy"`: it is the first thing on
the first tab, and a lazy image never loads at all while the preview pane is hidden.

The banner is `flex: 1` and takes whatever height the fixed layout leaves, rather than setting a
height of its own — that is what makes Overview fill the window on any screen without scrolling.
Measured: 494px tall at 1280×720, 564px at 375×812, both inside the viewport.

**The Grade 7 photograph IS published, decided 2026-08-17.** It is a group photo of ~50 identifiable
students at Chand Baori, Abhaneri, supplied 2026-08-14. It now sits at `public/trip-photos/g7.jpg`
(1920×1080, 346KB) with `"tripPhotos": {"g7": "/trip-photos/g7.jpg"}` in the **committed**
`config.json`; the `tripPhotos` override was removed from `config.local.json` so local and production
render the same image. Verified: the file is in `dist`, `/trip-photos/g7.jpg` answers 200 as
`image/jpeg`, and the Overview banner renders it at 1220×563 with `has-photo` set.

This **reverses** the 2026-08-14 position, which held the file under the gitignored
`public/local-roster/` precisely so `stripLocalOnlyFiles()` would keep it out of every build. That
paragraph called publishing it the school's decision and not a developer's — and the school made it.
Both facts were put to them before the move and neither is undone by a later deletion:
- **`avneesh9908/SchoolTrips` is a public repo** (GitHub API answers 200 unauthenticated), so the
  image is in public git history permanently.
- **`public/` is not behind the parent login**, so the file is fetchable by URL by anyone.

They confirmed **parental consent is on file**. Do not re-litigate this or quietly move the file
back; if it ever has to come down, the file and the `config.json` entry are only half the job — the
git history is the other half.

`Do/Dont's` is one column holding both sides, so it renders as a **single list**, not the
eight-tab schema's Do/Don't pair — hence the extra `doDonts` field alongside the legacy
`dos`/`donts`.

The card/text split is decided **per cell, not per column**: a URL in a text column still becomes
a card (a "Posters" block), and text in a link column is ignored. That is what lets the sheet be
half-converted from chips to URLs without the page breaking either way.

**Text is what the school wants on the page, not links — a pending card is the fallback, never
the goal.** Asked 2026-08-12 for guideline *text* rather than poster links. Nothing can be
extracted from the sheet's chips: they carry no URL to follow, and the posters behind them are
images in Drive, so even with a link there is no text to read without OCR. The only route is
**text typed into the three columns**, which the app already prints — `sample-data/grade-7-guidelines-to-paste.md`
holds the exact blocks to paste, lifted from `legacy/trip-explorer.html` (the school's own
prototype content: 11 safety points, 2 do's, 2 don'ts, 13 packing items, matching the live trip's
train and dates). It is a year old, so the school must confirm it before it reaches parents.

The one Do/Dont's column splits into the **two-column Do / Don't layout** when lines start
`Do:` / `Don't:`; unprefixed lines stay a single list, so a school that just types sentences is
still right. The prefix convention is documented in the paste file — it is the only thing telling
the two sides apart in a single-column sheet.

### Sheet edits reach parents by themselves — with three exceptions
Asked directly on 2026-08-13: does a correction made by management show up automatically? **Yes.**
Nothing is baked in at build time — `public/config.json` and the sheet are both fetched at page
load, and Google serves the published export with `Cache-Control: no-cache, no-store,
must-revalidate` (measured). Edit the cell, reload the page, it is there. No rebuild, no
redeploy, no developer. The one nuance is that the workbook is fetched **once per page load**
(`loadWorkbook`'s cache), so a tab left open all day keeps the copy it started with — a refresh
is what picks up a correction.

What does **not** flow through automatically:
1. **Anything on a second worksheet** — see the JS-tab finding below.
2. **A renamed column** whose new name is not in the alias list — that column silently empties.
   `normalizeKey` absorbs case and punctuation, and `DATE_ALIASES`/`OVERVIEW_ALIASES` cover the
   renames seen so far, but "Safety guidelines" → "Safety instructions" would drop.
3. **A grade cell the app cannot read** — the row group is dropped with a console warning rather
   than being filed under the previous grade.

### The "JS" tab is invisible to the app — Senior KG and Grades 1–6 are stranded there
Found 2026-08-13 while answering the question above. The published workbook has **two**
worksheets: `SS` (senior school) and `JS ` (junior school, note the trailing space). Every read
path takes the **first** worksheet only — `xlsxToObjects` defaults to `sheetIndex: 0`, and the
published CSV URL without a `gid` likewise serves the first tab. So the JS tab has never been
read.

It is not empty. It carries the same 13 columns and real trips: `SR.KG` Kevdi, `Grade 1` Kilad,
`Grade 2` Mahal, `Grade 3` Saputara, `Grade 4` Jambughoda, `Grade 5` SOU with hotel, `Grade 6`
Purna River Resort — each with batch/section lines and the standard Header Text. Confirmed on
production the same day: `/trip/g3` renders "Nothing published yet". **This is the answer to
"why do the junior grades have no content", and it is not the school's fault.**

Two things are needed to fix it, and they are separate:
- Read **both** worksheets and merge their grade groups (or address the JS tab by its gid).
- `normalizeGradeId` does not understand the junior tab's spellings: measured, **`SR.KG` → `''`
  and `JR.KG` → `''`**, so those two rows would be dropped even after the tab is read. Only the
  spelled-out "Senior KG" / "Junior KG" resolve today.

### "Local shows it, Netlify doesn't" — it has never been the deploy
Measured panel by panel on 2026-08-13, staff signed in on both, Grade 7: identical tab list, tab
order, headings, 5 document links and 2 photo links. **The only difference was Safety (15 text
items local, 2 pending cards live) and Things to carry (13 vs 1).** Both differences are data,
not code, and neither is fixed by redeploying:

| Symptom | Cause | Fix |
|---|---|---|
| Guideline text missing live | dev reads the local fixture, production reads the school's sheet, which holds poster chips in those columns | paste the text into the sheet — takes effect on the next page load, **no redeploy**. Since 2026-08-14 those chips at least render as poster links rather than dashed cards, but that is a consolation, not the fix |
| A new staff address is refused live | `ADMIN_EMAILS` in Netlify still holds the older list | set the variable **and redeploy** |

Diagnose it that way round: run the same probe on both, compare panel by panel, and only then
look at the bundle. Verified the bundle hash matches the local build, so a stale-cache theory
needs evidence before it is worth chasing.

### Guideline text now ships as a committed FALLBACK — recorded 2026-08-14, built earlier
This was missing from the skill entirely; found while reading the tree, and it **supersedes the
"only in the local fixture" claim below**, which was true until commit `32f9ddc` ("Print guideline
text from a fallback file when the sheet cell has none").

`src/data/guidelineFallback.js` + the **committed, shipping** `public/trip-guidelines.json` supply
Safety / Do-Dont's / Things-to-carry text per grade (`g7` is the only entry today). `useTrip` calls
`applyGuidelineFallback(assembled, gradeId)` after assembly. Two rules make it a fallback rather
than content:
- a column is filled **only** when the sheet gave no text for it, so the moment management types
  into the cell their words win with no code change;
- filling a column also **drops that column's poster card**, because the page must not offer a link
  to what it is already printing.

Loaded from `public/` rather than bundled — same reasoning as `config.json`: the text can be
corrected by editing one deployed file. Confirmed present in `dist`. So **production shows Grade 7's
guideline text today without the school pasting anything**, which is the opposite of what the next
two sections say; they describe the situation before that commit and are kept for the reasoning.
The school should still fill the cells — the `_confirm` key in the JSON says the text is a year old
and needs their sign-off.

### Historical: the guideline text existed ONLY in the local fixture
`public/local-roster/trip-app.csv` (gitignored) is the published sheet with Grade 7's three chip
cells replaced by that text, wired up via `csvUrls.trips` in `config.local.json`. **The live
sheet has never had guideline text**: its Safety / Do-Dont's / Things-to-carry cells hold poster
chips, re-checked 2026-08-13.

This is a trap, and it caught this session. Removing the `csvUrls.trips` line to read the live
workbook made the Safety and Things-to-carry tabs lose their text and fall back to poster cards,
which reads as "the app deleted my text and replaced it with links". It did not — the sheet
those two tabs were now being read from simply has no text in them. **Check which source
`csvUrls.trips` points at before believing text has gone missing.**

Since 2026-08-13 the fixture carries **both**: the guideline text *and* real pasted URLs in the
five file columns (taken from the workbook's hyperlinks), so local work demonstrates the finished
state — text on the page for Safety and Things to carry, working cards for Documents and Photos.
A bare URL has no name, so those cards label from the column ("Parent orientation — Batch 1")
rather than the chip's own file name; production, reading the workbook, keeps the chip names.
Verified with it: 11 safety points, 2+2 Do/Don't, a 13-item packing checklist, 3 document links
and 2 photo folder links, no pending cards anywhere.

Each guideline type keeps **its own place, with its text lines *and* its poster card together**,
instead of pooling every poster into one "Posters" block: safety and do's/don'ts in the Safety
section, packing in its own **Things to carry** section (since 2026-08-13 — `GuidelinesPanel` is
gone). "Things to carry" must stay findable under that name whichever form the school used.

`looksLikeFileName()` drops a leftover chip name from a text column — a single
hyphen-or-underscore token with no spaces, like `safety-guidelines-poster`. Printing it as a
safety guideline read like a broken attachment. Real guidance is a sentence and has spaces.
Verified: with the live sheet those three columns now yield nothing at all rather than three
slugs, and with a fixture carrying real URLs and text all six tabs render correctly.

## The trip page is TABS again — one panel at a time
**Reverted 2026-08-13 at the user's request** ("after click on tabs any tab dont scroll, I want
to switch on the tab look like different pages"). It had been one scrolling page with a
scroll-spy for part of that day; before that it was tabs. It is tabs now, and clicking a tab
**must never scroll the page** — only the panel swaps.

- `TripPage` owns the tab state, not `TripBody`. State is held **by section id, never by index**:
  the tab list is derived from the data, so a remembered index lands on a different tab in another
  grade. `active` is derived —
  `sections.some(s => s.id === chosen) ? chosen : sections[0]?.id` — so a tab that does not exist
  in the newly opened grade silently falls back to the first instead of rendering nothing.
- Only the active panel is mounted, keyed on the tab id so the `fade-in` replays per switch.
- `useActiveSection` (the scroll listener) is **deleted**. Do not reintroduce it.
- `openTab()` is **deleted too** (2026-08-14), along with the hero buttons that were its only
  caller. It existed to scroll the tab bar into view from under a 520px hero; the hero is 232px
  now, so there is nothing to scroll to and **no code path on this page scrolls the window**.
  Verified: clicking every tab leaves `window.scrollY` unchanged.
- `revealTab()` scrolls the **strip**, never the page. `.secnav-inner` is a horizontal scroller
  with its scrollbar hidden, so on a phone the selected tab can sit off the right edge with
  nothing on screen looking selected — `focus({preventScroll: true})` alone suppresses that
  correction too. Found by review and fixed; verified at 375px that End moves the strip to
  `scrollLeft 314` while `window.scrollY` stays 0.
- Roving `tabIndex`, `role=tablist/tab/tabpanel`, `aria-selected/controls/labelledby`, and
  Arrow/Home/End with wrap-around.

### Nine tabs became FOUR (2026-08-14) — the school's own grouping
`buildSections(trip, photo)` derives the list **from the data**, and it must stay that way. A
section with nothing behind it is never rendered, so a half-filled sheet reads as a finished page
rather than a row of empty shelves. Order:

The tab's **id is `home` but its label is "Overview"** — renamed 2026-08-14. Do not "tidy" the id to
match: `is-fill` and the fixed-layout CSS key off `#home`.

| Tab | Holds |
|---|---|
| **Overview** (id `home`) | the photograph and **nothing else**. Grade · Batch · Dates, the trip name, and the whole Header Text sit *on* the image. It never scrolls |
| **Itinerary** | the batch block and the itinerary chip **beside each other** (`.itin-top`), then **Safety and Do's and don'ts side by side** (see below). No section heading: the tab label already says "Itinerary", and the 86px it cost was the difference between fitting and scrolling |
| **Things to carry** | its own tab since 2026-08-17 — one 1080px card holding the packing checklist, two grid tracks on a wide window |
| **Orientation** | Parent Orientation and Student Orientation, one row each, the batches beside each other, **compact cards** |
| **Travel** | a card per batch. Its own tab again (it was briefly folded into Itinerary) |
| Photos | only when the sheet holds photo URLs or album folders |
| Reminders | only when the sheet holds coordinator details — unreachable from today's sheet, since `tripApp.js` always returns `reminders: []` |

The **Safety** tab is gone: safety is now one of the three columns inside Itinerary. So are the
**Student**, standalone **Things to carry** and **Documents** tabs. Student details were dropped
rather than moved — the Overview image's meta line answers "is this my child's page".

### The three guideline columns — the sheet's chips, side by side
The school's instruction, verbatim: *"in sheet have links and links have chips show the chips
parrally dont write according to you … take the chips show here preview parrally after itnary."*

`.chip-row` puts **Safety · Do's and don'ts · Things to carry** in one row under the itinerary
(`grid-template-columns: repeat(auto-fit, …)`, verified all three sharing the same `top`). Each
column prefers **the sheet's own chip**, rendered as a `DocCard` with its Drive preview and the
chip's own name as the label — "Safety guidelines poster", "Do and donts poster", "Things to carry
poster". Nothing is written on the school's behalf.

A column prints text (`.chip-lines`) **only when it has no chip at all**, so a school that pastes
real guidance into a cell still gets it printed, per cell, with no code change. Those lists scroll
inside their own column — one long list must not stretch the row past the window — capped at
`clamp(150px, 26vh, 430px)`. The cap is **viewport-relative on purpose**: a flat 180px sliced
sentences in half on a 1080px-tall window while leaving ~300px of the panel empty underneath, which
is what the user photographed.

The chip cards keep their preview but at **90px, not 150px**, with tighter padding: three full-size
preview cards put this tab 83px past the window, and the page must not scroll.

**Second pass, 2026-08-17: TWO columns here, packing on its own tab.** The school's instruction was
"parally show safty and do and donts / things to carry new tab / do and donts make vertically cards /
all things fit on screen / things to carry show in list form". So:
- `.chip-row` now carries **Safety and Do's and don'ts only**, half the row each (915px on a
  full-screen window). Packing was the longest of the three lists and none of the three fitted while
  they shared a row.
- **Things to carry is its own tab** (`CarrySection`, id `carry`, placed straight after Itinerary),
  one card capped at **1080px** — given the full 1847px the thirteen items flowed into four columns
  of three and stopped reading as a list at all.
- **Do's and don'ts is `RuleStack`**: one card per rule, stacked vertically, under a DO or DON'T
  label printed only where the side changes (so an unprefixed sheet gets no labels rather than a
  heading it did not earn). Green `--green-bg` cards for do's, amber `--red-bg` for don'ts.
- **A stray grey bullet sat beside every number** in the first pass. `.chip-lines > li::before` and
  `ul.plain li::before` are equally specific and `ul.plain` is declared later, so it won on source
  order; `ul.plain.chip-lines` is what actually kills it. The same trap hid `display: block` — a flex
  container ignores column properties, so the two-column flow silently did nothing.

**Never use CSS multicol inside these lists.** Inside a scroller with a definite height the browser
keeps adding *overflow columns* until the content fits, sideways: measured at 1280 with
`column-width: 400px` on a 601px Safety card it produced **three 180px columns and 1226px of
horizontal scroll**, every sentence wrapped to bits. `column-count` with `column-fill: balance` did
the same — the definite height wins either way. Two **grid tracks** behind a media query
(`min-width: 1600px` for Safety, `1100px` for packing) is the fix; a grid has a fixed number of tracks
and grows downwards, which is what the list's own scrollbar is for.

Measured at 1907×878 (the school's window), Grade 7, staff: Safety **11/11 in two tracks**, Do's and
don'ts **4/4**, Things to carry **13/13 in two tracks**, `vHidden 0` on all three, and panel scroll 0 /
window scroll 0 on every tab. At 1280×720 Safety and the rules scroll inside their own cards; at 375px
everything is single-column and the panel scrolls, window still 0.

**First pass, same day — redesigned to fill the panel** ("take full breath and lenth of screen"). Each column is
one card: a tinted head (icon square, title, item count) over a plain white list. The colour lives in
the head, not the body, so the longest column stays legible. Markers are `.chip-mark`: a numbered
disc for safety, a tick or cross for do's/don'ts (from `splitRule()`, which reads and then strips the
sheet's `Do:` / `Don't:` prefix), a tick for packing; `.chip-lines > li::before { content: none }`
kills the inherited `ul.plain` dot or every line carries two markers.

The row **stretches** rather than sitting at a fixed cap: `Section` takes a `className`, the Itinerary
section gets `is-stretch` (`min-height: 100%`) and `.chip-row` is `flex: 1 1 0`. The list inside must
also be `flex: 1 1 0` — with `auto` it hands its content height up the chain and the panel overflowed
by 843px. Height for it was bought by putting the batch block and the itinerary card **beside** each
other (`.itin-top`) and the batches side by side (`.batch-grid`): 306 → 167px at 1280×720, so the
columns went 217 → 356px, and 758px at 1920×1080. Below 980px the columns stack, take their natural
height and let the panel scroll — sharing one row's height between three stacked columns left each a
69px head and no list at all.

**The poster is shown WHOLE, not as a strip** (2026-08-17: "i want hole preview i dont want like i
click then show the poster"). In the chip columns `.doc-card` is `flex: 1 1 0` and `.doc-thumb` takes
every px the label does not, at **`object-fit: contain`** — the posters are landscape and the column
is portrait, so the old `cover` + `height: 90px` cropped away everything but the title and left the
guidance reachable only by opening the file. Measured at 1907×878 with a 1320×740 stand-in: drawn
**669×375**, whole poster visible, no panel or window scroll. The cards are `eager` (a new `DocCard`
prop): the card only mounts when its tab opens, so it is on screen the instant it exists and a lazy
load is pure delay. Clicking still opens the full-resolution file, which is the readable version —
375px of a 740px poster is half scale.

**Whether a parent sees any of this is still the sharing question, and it is easy to be fooled by
your own browser.** Re-measured 2026-08-17 anonymously from localhost: both the Safety and the
Do/Dont's thumbnails **error**, while a control image (Google's favicon) loads 32×32 — so it is those
files, not images in general. Staff see the posters render on production because **their browser is
signed in to a Google account that has access**; that is not what a signed-out parent gets. Check this
with a detached `new Image()` against the `drive.google.com/thumbnail?id=…` URL plus a public control,
never by looking at your own screen.

**The previews are blank today, and that is the sharing blocker, not a bug.** All three poster files
answer 401 anonymously, so `drive.google.com/thumbnail?id=…` cannot render them; the card shows an
empty tile (or `DocCard`'s icon fallback once `onError` fires) and its link leads a parent to a Google
sign-in page. Measured 2026-08-14: `naturalWidth === 0` on all three. Nothing in the code will fix
this — the school must set those files to "Anyone with the link → Viewer".

### The guideline text fallback is switched OFF
`useTrip` no longer calls `applyGuidelineFallback`. Turned off 2026-08-14 for "**dont write according
to you**": for a chip-only cell it injected `public/trip-guidelines.json`'s text *and dropped that
column's poster card*, so production printed guidance nobody in the sheet had written and hid the
school's own poster — the exact opposite of what was asked.

**This reverses the 2026-08-12/13 position that "text is what the school wants on the page, not
links".** Both instructions are real; the later one wins. `guidelineFallback.js` and
`public/trip-guidelines.json` are left in place, unused, so restoring one call in `useTrip` undoes
it. They are dead code until that decision is settled — flag them, do not silently delete them.

**Known dead code, held deliberately (2026-08-14).** Folding safety into a chip column removed
`SafetySection`, `RulePanel`, `CarryBlock`, `TravelBlock` and `splitGuideline`, which orphaned their
CSS: `.acc*` (the numbered safety accordion), `.rule-panel` / `.rule-head` (green/amber Do–Don't
panels), `.check-grid` / `.check-item` (the packing checklist), `.sub-block` / `.sub-head`,
`.two-col`. About 60 lines, ~2.5KB, still shipping. It is kept because it is exactly what a
text-first layout would need if the guideline decision above is reversed, and because deleting it
would mean re-verifying a page that currently measures clean. **Delete it once the school confirms
chips-not-text is final** — `git show HEAD:src/styles/global.css` recovers it either way, the repo
is tracked.

**The batches block moved off Overview** into Itinerary, per the school's notes. And the 2026-08-13
rule "do not put the Header Text back on the hero" is now moot rather than reversed: **there is no
page hero at all.** The Header Text lives on the Overview tab's photograph, headline *and*
paragraphs, and there is no panel of body copy beneath it — that panel is what used to make this tab
scroll.

Each entry carries the `id` the tab selects. `Section` now **omits its whole head** when given no
title/eyebrow/subtitle/aside — Home is a photograph with the school's own words on it, and an empty
`h3` above that was 20px of dead space. `.section` gained `gap: 24px` because a tab is now several
blocks rather than one.

Section pieces, all fed from the existing trip object:
- **Orientation** — `OrientationSection` groups by category and renders one `.orient-row` per kind,
  so B1 and B2 sit side by side (verified: equal `getBoundingClientRect().top`). `DocCard` takes
  `batchTag` and shows "B1"/"B2" as an absolutely-positioned chip, which is why `.doc-card` is
  `position: relative` — positioned rather than in the flow so it sits over a Drive thumbnail as
  readily as over the icon tile. The card's label stays the chip's own name from the sheet.

  These cards are **`compact`** (2026-08-14, "orintation cards make small dont make ui scroolable"):
  `DocCard`'s `compact` prop drops the 150px Drive preview and tightens the box to an icon plus two
  lines. That preview was what pushed this tab 234px past the window; it now fits with none.
  `hideMeta` drops the category line, which the group heading above already states.

  **`.orient-row` is flex with a fixed basis, never `auto-fit` + `1fr`.** With `1fr` tracks, `auto-fit`
  collapses the empty ones and hands the whole row to the survivors: measured at 1920, a lone card was
  **1860px wide** and a pair were 930px each — the widest things on the page, in the tab where the ask
  was to make them small. `flex: 0 1 270px; max-width: 320px` keeps them small and left-aligned
  (measured 270px). `.chip-row` is capped the same way at 520px, so a grade with only one guideline
  filled does not get one card spanning the window.
- **Safety** as the design's numbered accordion. `splitGuideline()` opens a line only when it names
  its measure first ("Adult supervision: a ratio of…"); a line that is one plain sentence renders as
  a `div`, not a button, so nothing pretends to expand. The regex demands whitespace after the
  separator and no digits in the head, which is what stops it splitting "a ratio of 1:12". The
  school's live text is all plain sentences, so **the expanding path is currently unexercised**.
- **Do / Don't** as the two coloured panels; **Things to carry** as a tappable checklist with an
  "N of M packed" aside (local state only, nothing is stored).
- **Travel** as a card per batch; the train/departure route strip appears only when those fields
  exist, so the school's prose-only cells stay prose.
- **Reminders** as day/month cards — `splitDate()` peels a leading day number, and anything it
  cannot parse stays one line. Coordinator phone/email become `tel:`/`mailto:` links.
- **Photos** as a CSS-columns masonry; `PhotoTile` still swaps to a typed tile on `onError`, and
  videos get a round play badge instead of a broken `<img>`.

`DocCard` now matches the design: 44px tinted icon square, 18px title, coloured action line. The
Drive thumbnail is still shown when it loads, so the preview capability was not dropped.

## Design system — the "School Trips Portal" navy/amber kit (2026-08-13, current)
The white/coral kit below was itself replaced the same day by the design the user supplied at
`claude.ai/design/p/e7a8d8f0-3527-4ab7-91a4-1b9de8cb47aa` ("School Trips Portal", file
`School Trips Portal.dc.html`). **Read that file with `DesignSync get_file` — it is the
reference, not a screenshot**; `list_files` on the project id from the URL, then `get_file`.
Everything lives in `src/styles/tokens.css`.
```
--bg #FAFBFD  --card #FFF  --ink #0F172A  --body #475069  --muted #5A6478  --soft #8A93A6
--line #E9ECF3  --line-2 #E6E9F0  --rule #EDF0F6  --wash #F4F6FC  --warm #F0F3FD
--navy #1B2560 (buttons, headings on colour)  --accent/--link #2B3A8F (active nav, CTAs)
--green #157F4B (safety, "Do")  --amber #E08707 (eyebrows, "Don't", avatar)
```
**Two families:** Plus Jakarta Sans for everything, and **Instrument Serif** (`--font-display`,
weight 400) for the display headings only — login headline, dashboard title, trip hero title,
overview title. Everything else is 700, not 800, with gentler tracking (-0.01 to -0.02em).
Radii 24/22/20/18/16/15/13, hairline `#E9ECF3` borders, long cool shadows
(`0 22px 48px -22px rgba(19,28,62,.34)`), and a 4px lift on card hover.

Signature pieces: the **"ST" monogram** (36–40px, 11–12px radius, navy gradient) as the brand
mark in the top bar, login art panel, auth card and footer; the **circular amber monogram
avatar** beside the signed-in name; `--r-hero: 0` because the trip hero is now **full-bleed**
(`margin: -34px calc(-1 * var(--shell-pad)) 0`), running edge to edge under the sticky bar.
`Section.jsx` takes an optional **`eyebrow`** (small uppercase line above the heading) plus
`tone` — `safety` turns it green, `carry` amber. Grade colours and icons still live on `GRADES`
in `lib/grades.js` — **icons are a property of each grade, not positional** — and now paint the
pick card's gradient head (`grade.color → #1B2560`) with the icon over it. Breakpoints
1080 (photo masonry 3→2), 900 (login split stacks), 720 (mobile). Light theme only.

**No photograph is ever invented for a grade or a trip.** The design's cards carry Unsplash
imagery; the real cards carry the grade's colour gradient and its icon instead. The one stock
image kept is the login art panel (`ART` in `Login.jsx`) — decorative, generic, with the gradient
behind it if it fails to load. The hero photo remains the credited Wikipedia destination photo.

The dashboard head (`DashHead` in `ChildPicker.jsx`) is the design's breadcrumb + serif title +
lede + account card; the old gradient `.welcome` banner and the `.pick-foot`/`.pick-icon` card
internals are gone. `initials()` is exported from `TopBar.jsx` and reused there.

**The design's search box and notification bell were deliberately not built** — neither has
anything behind it, and a search field that does nothing is worse than no search field.

### Superseded: the white/coral kit (earlier on 2026-08-13)
`claude.ai/design/p/f7ca652f-d89f-4e2e-a83d-8feca92f8187` ("Grade 7 trip interface", file
`Trip Explorer.dc.html`) — cream/coral, Plus Jakarta Sans only, weight 800 headings, radii
28/26/24/22/18/16. Kept here only so a reference to "the coral kit" resolves. Do not restore it.

**The page runs the full width of the window** (changed 2026-08-13 at the user's request — the
design's 1160px centred column left two ~380px empty margins on a 1920px screen). `--shell-w: 100%`
and `--shell-pad` (40px, 18px on mobile) are the only two values controlling it, and `.shell`, the
top bar, the section nav and the footer all read them, so the gutters stay aligned. The section nav
bleeds edge-to-edge with `margin: 26px calc(-1 * var(--shell-pad)) 0`. Grids are `auto-fit`, so they
add columns rather than stretch — **`.kv-list` must stay `auto-fit`**: pinned at two columns it put
860px of dead space between each label and its value at full width.

`--header-h: 66px` is the measured height of the sticky top bar and the `top:` of the sticky
section nav. It was briefly 67px after the navy redesign, which left a 1px strip; measured back
to 66 (`topbarBottom === navTop === 66`). Both bars are `position: sticky` and translucent with `backdrop-filter`, so if the
header's padding or font size changes, **re-measure it** — a stale value leaves a strip of content
visible in the gap.

`App.jsx` owns the frame: sticky `TopBar`, `<main class="page"><div class="shell">`, then the
site footer. `/login` renders **bare** — no top bar, no footer — because the split-screen art panel
carries its own brand mark; that is why `App` reads `useLocation()`.

The login screen is the design's two-up split: a gradient art panel (headline, lede, four pills)
beside the white sign-in card. **The design shows Google only; the typed email/mobile field stays**,
because no OAuth client id has ever been set and typing is the only path that works today.

## The Header Text column, and where it renders
`Header Text` / `Starting Text` reaches the app as `trip.overview` (aliases in
`OVERVIEW_ALIASES`, `tripApp.js`). `splitHeader()` in `TripPage.jsx` cuts it at the first
newline: the headline ("A Journey Beyond the Classroom") renders as `.home-lead` and the paragraphs
as `.home-body-text` — **both on the photograph**, inside `.home-banner-text`, on the Overview tab.
A first line over 200 characters is not treated as a headline: the whole cell renders as body text,
so a school that types one long paragraph is still right.

**All of it goes over the image, and there is no panel beneath.** That panel existed for half of
2026-08-14 and was removed the same day — it was what made this tab scroll, and the instruction was
"overview have only images". The scrim (`.home-banner.has-photo::after`) was deepened to 0.93 at the
foot to carry the full text; if the Header Text ever grows much beyond the ~450 characters measured
today, this is the thing that will need re-checking.

Where the text has lived, in order: the page hero (2026-08-13) → an Overview panel beside a second
copy of the photo (2026-08-13) → on the single photograph, hero deleted (2026-08-14). The rule that
survived all three: **it is never in two places, and the page never grows a bare-text hero.**

## Junior and middle school say "Coming soon" — they are not openable
`isComingSoon(id)` in `lib/grades.js` holds a hard set: **jk, sk, g1…g6**. Set 2026-08-14 ("Grade
cards show coming soon till Grade 6"). Those cards render as a plain `div`, never a disabled
`<button>` — there is nothing behind them, so they must not take focus or invite a click. `.pick-cta`
reads "Coming soon", the line reads "Trip not announced yet", and `.pick-card.is-soon` desaturates
the colour head.

`TripPage` honours it too: `useTrip` is passed `enabled: allowed && !soon`, so one of these grades
reached by URL shows a "Coming soon" empty state and **issues no fetch** — verified by wrapping
`window.fetch` on `/trip/g3`: zero calls. Same rule as an unauthorised grade.

**It is a hard list on purpose, not an "is the trip empty" check.** The reason these grades are
empty is the unread `JS` worksheet (see above), and an emptiness test would equally silence a grade
whose content merely failed to load. When the JS tab is finally read, shrink this set — do not
replace it with a data probe.

## The picker cards carry the trip's NAME, not the words "Trip plan"
Set 2026-08-14. `useTripTitles()` calls `fetchTripSets()` **once** for the whole picker and maps
grade → `Destination`; `loadWorkbook` caches by URL, so this shares the download the trip page
would make anyway. It reads either sheet shape (`titlesFrom`).

`titles` is `null` until it lands and the line renders as a single space, not "Loading…", so the
grid does not change height when the names arrive. A failure is **not** an error state — it warns
and returns `{}`, and the cards fall back to "Not published yet" while still opening the trip. A
name is a nicety; the card must work without it. Live: g7 Jaipur-Abhaneri-Ranthambore, g8
Jabalpur-Panchmarhi, g10 Jodhpur & Jaisalmer; g9/g11/g12 read "Not published yet".

## Both Grade 7 rows say "Batch 1" in the sheet — the app now compensates
Measured 2026-08-14: the content sheet's two Grade 7 rows **both** begin `Batch 1:` (12-19 December
and 13-20 December). The second should say Batch 2. Taking the sheet at face value did two visible
kinds of damage: the Orientation tab showed two identically-labelled cards, and because the label is
part of `documentsFrom`'s de-duplication key (`category|cell|batch`), two batches that also shared a
file name would collapse into one card and **a whole batch's deck would vanish**.

`batchLabels(rows)` is now the single source of batch names — used by `documentsFrom`, `batches` and
`travel` alike, replacing three separate `batchLabel` calls. It trusts the sheet's text unless that
text **repeats within the grade**, in which case position wins (`Batch ${i + 1}`). A single-row
group is left alone: nothing can collide, and renumbering would invent a batch. `batchLabelsCollided`
reports it **once** per assembly, naming the fix — the warn used to sit inside `batchLabels` and
said the same thing four times.

This is a workaround for a sheet typo, not a replacement for fixing it. **The school should still
correct the cell**; a parent whose section matches only the mislabelled row still sees "Batch 1",
because one row carries no collision to detect.

## Grades are named, never coded, on screen
"Grade 7", not "G7". `gradeById(id).full` is the only thing a parent should read — in the top
bar, the student-details row, the hero eyebrow, the picker cards and the "Not your child's grade"
message. `g.label` ("G7") survives **only** as the small code pill on a picker card's colour
head, where it is a badge rather than a sentence. `student.grade.toUpperCase()` was the old
pattern; it is gone, and it should not come back.

## Verified working — the navy "School Trips Portal" conversion (2026-08-13)
Exercised on the dev server at 1440×900 and 375×812 against the local Grade 7 fixture:
- login → child card → Grade 7: full-bleed hero (`left 0`, width = viewport, `top === 66`,
  i.e. flush under the sticky bar), Wikipedia Jaipur photo at 1920px with its credit chip, back
  pill inside the hero, Confirmed pill, serif title, batch line, fact cards, 7 nav entries
- sticky pair stays flush after a programmatic scroll (`navTop === topbarBottom === 66`, gap 0),
  the target heading lands at 130px, and scroll-spy moved the highlight to Safety
- every section in the new language: hairline student grid, serif overview beside the photo,
  dashed pending doc cards, numbered safety rows, green/amber Do–Don't panels, prose travel card,
  packing checklist ("0 of 13 packed"), pending album cards
- a staff address → 14 grade cards with the gradient head, code pill and grade icon
- 375px: **zero horizontal overflow** on trip page and login; the only elements past the viewport
  edge are the section-nav buttons inside their own scroller, which is intended
- `npm run build` clean; no app console errors (the one error in the log came from a test snippet
  calling `getComputedStyle(null)`, not the app)
- **Screenshots worked this session** — the preview pane composited frames, unlike the earlier
  redesign. Smooth `scrollIntoView` still does not move the page there; scroll with
  `behavior: 'instant'` and dispatch a `scroll` event to check the spy.

`RemindersSection` could not be exercised from data: `tripApp.js` always returns
`reminders: []`, and both local trip fixtures are the one-tab shape. Its new day/month timeline
was verified instead by serving the built CSS with hand-written markup from `public/`, then
**deleting both files immediately** — nothing may be left in `public/`, it ships.

## Verified working — the coral redesign, earlier on 2026-08-13
Exercised on the dev server at 1280×800 and 375×812, reading the local Grade 7 fixture:
- parent login → child card → Grade 7 trip: hero photo (Wikipedia Jaipur, 1920×1440, credit
  present), 3 fact cards, and all 9 nav entries down to Photos
- section nav: click scrolls the heading to 130px, i.e. 18px clear of the sticky bars, and
  `navTop === topbarBottom === 66` so there is no gap between them; the highlight follows the scroll
- packing checklist toggles and the aside counted "2 of 13 packed"
- Grade 8 as staff → 2 travel cards, 4 sections, no Student section (staff have no child row)
- Grade 12 (no rows) → hero plus "Nothing published yet", no nav and no fact bar
- `/trip/g5` as a Grade 7 parent → still blocked, and **no fetch was issued** (checked by wrapping
  `window.fetch`)
- 375px: zero horizontal overflow on the trip page *and* on login, nav scrolls sideways, every grid
  collapses to one column. The login grid needed `minmax(min(430px, 100%), 1fr)` — a bare
  `minmax(430px, 1fr)` overflowed a phone.
- `npm run build` clean, no console errors on any screen
- **full-width pass at 1920×960:** content spans 40 → 1880, the brand starts at 40 and Sign out ends
  at 1880, the footer aligns to both, the section nav bleeds 0 → viewport, and `.kv-list` reflows to
  four 411px columns. Mobile re-checked afterwards: 18px gutters, nav still full-bleed, no overflow.

**Screenshots were impossible** — the preview pane was never displayed, so the browser composited no
frames: `computer{screenshot}` timed out every time, smooth `scrollIntoView` never moved the page
(instant scrolling did), and `IntersectionObserver` never fired at all. Verify layout there through
`read_page` and measured `getBoundingClientRect()` values, not pictures.

## Verified working (earlier, pre-redesign)
Exercised in the browser on the dev server, sample data:
- two-child login by **email** (`rakesh.mehta@example.com`) → picker → G7 trip
- one-child login by **email** (`nilesh.shah@example.com`) → picker auto-skipped
- login by **mobile** `9876543210`; `+91 98765 43210` in the sheet matched it
- one-child mobile login where grade is stored as `VII` → resolved to G7
- **`9900112233`, a row with an empty `FatherEmail`** → mobile still works
- unknown email `stranger@example.com` → "could not find a student", stays on `/login`
- malformed `not-an-email@@x` → "does not look like a valid email address"
- `/trip/g5` as a G7 parent → blocked, no fetch
- all ten sections render; mobile 375px reflows cleanly
- `npm run build` clean, no console errors

Then re-verified against the **real sheets adapter reading CSV fixtures** — this closed the
"sheets adapter never tested" gap for everything except the Google URL itself:
- email login resolved from `students.csv`; two-child picker correct
- G7 → 9 sections, 7 itinerary rows, 5 doc cards, 13 packing items, 2 travel legs
- the quoted multi-line `Overview` survived parsing with its blank line intact, which is
  the whole reason `parseCsv` exists
- `Class 5` → g5 → Sundarbans trip; Grade 9 `Pending` → "Details coming soon" pill and only
  the two sections it has data for

Runtime config and folder expansion, against the local fixtures:
- app renders with all pointers coming from `config.json`, none from `.env`
- with `driveApiKey` set, one folder row became **4 cards**, each inheriting the row's grade
  and category, labels stripped of file extensions
- with `driveApiKey` blank, the same row stayed **1 link card** — the graceful default

Folder file-name matching (`matchFolderFiles`, pure-function check):
- exact names matched; `Grade 7 Itinerary 2026` → itinerary via unique substring
- `Media` exact beat `Old Media backup`, so no false ambiguity
- an unconverted `.xlsx` and a Slides file were skipped with warnings naming them
- `Winter Trips` + `Summer Trips` → **no match at all** plus an ambiguity warning

Sheet-link handling (pure-function check, plus local mode still rendering):
- share link with `#gid=`, share link with `?usp=sharing`, bare id → all parse correctly
- a Drive **folder** URL correctly yields `null` rather than a bogus sheet id
- `?tqx=out:csv&sheet=Students` by name, `&gid=…` when a gid is given

**Vite gotcha:** after the `adapter` → `getAdapter()` refactor the dev server served a stale
module and the app rendered nothing, while `npm run build` passed. HMR reported
"does not provide an export named getAdapter". Restart the server and `rm -rf node_modules/.vite`
before believing a runtime error that the build does not reproduce.

**Testing note:** the browser tool's synthetic clicks do not reliably reach React's
handlers on this login form. Drive it with `element.click()` and set inputs through the
native value setter plus a bubbling `input` event, or React state stays empty and the form
looks silently broken. Also clear the AuthProvider state with a real reload between cases —
`sessionStorage.clear()` alone leaves the in-memory session and masks failures.

## Known gaps
Observations, not a to-do list — do not act without a request.
- No verification on a typed email or phone; Google Sign-In is optional and unconfigured.
- Google Sign-In is untested end-to-end — no client id has ever been set, so the button,
  the GIS load and the credential decode have not run against real Google.
- `sheets` adapter cannot enforce access control (see caveat above).
- The adapter has still **never run against a real Google URL** — only local CSVs and a local
  Drive fixture. The `gviz/tq` URL shape, **tab-addressing by `sheet=` name**, the `Settings`
  index lookup, the sign-in-HTML detection, and the real `files.list` call with an API key are
  all unproven in the wild. URL construction is unit-checked; the round trip is not.
- **Trip history is undecided.** Today a new trip overwrites the old rows and nothing is
  kept. Adding a year/season column later means migrating a sheet the school has already
  filled — raised with them in `DATA-HANDOVER.md §4b`, unanswered.
- Both decks in `sample-data/` were generated but **never visually rendered** — no
  LibreOffice on this machine. Shape geometry is confirmed inside the canvas; text could
  still overflow its own box. Open them once before showing them to anyone.
- Of the five SVGs in `docs/diagrams/`, only `pipeline` and `sheet-map` have been seen
  rendered. The rest use identical constructs but are unviewed.
- No backend exists yet; `apiAdapter` is a documented stub that throws if selected.
- No admin UI; the school edits sheets directly.
- No caching between navigations — switching child refetches the whole set.
- Media section is wired but the sample data has no rows, so it is unexercised.
- No tests.
- Accessibility beyond semantic buttons/labels has not been audited.

## Keeping it dynamic — built, and why it is shaped this way
The user's pain was reconfiguring for every trip. Their proposal: point the app at one Drive
folder and let it discover everything. What shipped instead, and the reasoning:

1. **The spreadsheet id is permanent.** The schema was always grade-keyed and multi-trip —
   the dummy workbook holds three trips. A new trip is *new rows*, needing no developer at
   all. This removes most of the pain on its own; state it before proposing anything else.
2. **`public/config.json`, read at page load** (`src/config.js` → `loadConfig()` awaited in
   `main.jsx` before render). `.env` remains the fallback for blank values. Previously every
   pointer was baked in at build time, so any change meant a rebuild and redeploy — that was
   the real structural flaw, independent of folders.
3. **Folder links inside the `Documents` tab** (`src/lib/drive.js`). One row holding a Drive
   folder URL expands into one card per file, inheriting that row's grade and category, label
   from the filename with the extension stripped.
4. **One pasted link is the entire configuration.** `gviz/tq` addresses a tab **by name**
   (`?sheet=Students`), so the eight gids are gone — `sheetId` accepts a full share link or a
   bare id (`parseSheetRef` in `src/lib/sheetUrl.js`). Cost of this: **renaming a tab silently
   empties that section**, since the name is the address. A `gid` still wins when supplied,
   because a gid survives renames — that is the documented escape hatch, keep it.
5. **Everything else was deleted on 2026-08-12** at the user's instruction — the `Settings`
   index tab (`loadIndex`/`indexCache`), the per-source `sheetIds`, and `folderId` folder
   discovery (`loadFolderMap`/`matchFolderFiles`). One spreadsheet, addressed by tab name.

Resolution order in `urlsFor` is now just: **csvBase (dev) → the `sheetId` spreadsheet**.
`urlsFor` returns a **list**; `withFallback` appends a `gid=0` URL so a file whose tab is still
`Sheet1` resolves. `loadSheet` walks the list and rethrows the last error only if all fail.

`csvExportUrl` builds its query **by hand, not with `URLSearchParams`**, which would encode
the colon in `out:csv` as `%3A`. Do not "tidy" that back.

**A folder can never replace the spreadsheet** — itinerary, safety points, packing list and
travel legs are structured rows; a folder yields filenames only, with no grade, label,
category or order. This is why folder mode went rather than becoming the primary source.

Because adapters now read `config()` synchronously, `src/data/index.js` exports **`getAdapter()`
/ `isMock()` / `isServerEnforced()` as functions**, not constants — resolving at import time
would capture the pre-config values.

`driveApiKey` blank is the safe default: `expandFolderDocuments` returns its input untouched
and folder rows stay a single link card. A folder that errors is also left as a link, so the
section never breaks.

## Config layering — `''` vs `null`
Three layers, each overriding the last: `.env` → `public/config.json` → `public/config.local.json`.

**`readJson` must resolve against `import.meta.env.BASE_URL`, never relatively.** Fixed
2026-08-12: a relative `fetch('config.json')` from `/trip/g7` asks for `/trip/config.json`, which
the SPA fallback answers with index.html, so *every* pointer read as unset and the page said
"Nothing published yet". `/children` worked, which is why this was mistaken for a config race —
refreshing or bookmarking a trip page always failed.

In `merge()`, **`''` means "not set here, fall through"** — which is what lets a mostly empty
`config.json` defer to `.env`. **`null` means "explicitly clear"**. Without `null` an override
could set a value but never unset one, so a local override could not switch off a URL that
`config.json` had switched on. That was a real bug: `"rosterApiUrl": ""` was silently ignored
and the app kept POSTing to `/api/lookup`, which does not exist under plain `vite`.

## The public/ directory ships — a real PII leak happened here
**2026-08-12: `netlify deploy --dir=dist` published `public/local-roster/students.csv` — 2,619
students with names, grades, sections, parent emails and both parents' mobile numbers — to the
open internet, plus `config.local.json`.** Vite copies *everything* in `public/` into `dist`;
`.gitignore` governs git, not the bundle. Gitignoring a file is **not** protection from
deployment. That is the lesson; assume nothing in `public/` is private.

Second-order effect, worth remembering: the deployed `config.local.json` also *overrode* the
live config — it clears `rosterApiUrl` — so for ~3 hours the production site bypassed
`/api/lookup` entirely and matched logins against the client-side roster instead.

Guard in place: `stripLocalOnlyFiles()` in `vite.config.js` deletes `local-roster/` and
`config.local.json` from `dist` on every build, Netlify's included. **Do not remove it, and add
to `LOCAL_ONLY` any new local-only file put in `public/`.**

Remediation, in case it is ever needed again: the live URL is fixed by rebuilding and
redeploying, but **Netlify keeps every past deploy at `https://<deploy-id>--<site>.netlify.app`,
serving the old snapshot forever** — the affected deploy must be deleted with
`netlify api deleteDeploy --data '{"deploy_id":"…"}'`. One deploy leaked; it was deleted and all
16 were swept clean.

**Check bodies, not status codes**, when verifying this: the SPA rule `/* → /index.html 200`
means a deleted file still answers `200`, just with HTML. A status-only check reads as "still
leaking" when it is fixed, and would read as "fine" for a file that never existed.

## Local development against the real roster
Two gitignored pieces make this work without ever committing PII or breaking the deploy:
- **`public/config.local.json`** merges on top of `config.json` (see `loadConfig`). Needed
  because `config.json` is committed and Netlify auto-deploys, so pointing *it* at a local
  path ships a broken site — and reverting it each time silently sent local testing back to
  demo data. Logs `[config] config.local.json applied` when active.
- **`public/local-roster/`** holds a column-reduced copy of the roster (19 PII columns
  stripped) for offline work.
- **The Vite dev proxy** `/roster → nucleus.fountainheadschools.org/CSVDATA` (vite.config.js)
  re-serves the live feed same-origin, which is the only way a browser can read it.
  `csvUrls: { students: "/roster/StudentData.csv" }` points one source at it while the rest
  stay local. **Restart the dev server after touching vite.config.js.**

`csvUrls` (per-source URL) beats `csvBase` in `localUrl`.

**The proxy is dev-only** — `npm run build` emits static files with no proxy — and it hands
the *entire* roster to the browser. Never present it as the production pattern.

## The parent flow — one card, then everything
Login → **the child card is always rendered**, one child or several (the single-child
auto-redirect was removed on 2026-08-12 at the user's request) → tap it → the grade page with
every section: overview, documents, itinerary, safety, do's/don'ts, travel, reminders, media,
communication, packing list.

**Trip content is grade-common by design** — every Grade 4 family sees the same itinerary and
the same photos. The child's **name is the only personal value on either screen**
(`activeStudent.name`, one pill on the trip hero); no screen ever lists another family's child,
and the server returns only the caller's own children. When someone asks "can a parent see
other students", that is the answer. Keep it true: do not add a roster, class list or
attendance view to the parent side.

## Staff role — sees every grade
A signed-in email on the staff list gets `role: 'admin'`: scope over `ALL_GRADE_IDS`, a
**grade picker** (all 14, including Senior KG) instead of a child picker, a "Staff" chip in
the top bar, and `RequireStudent` waives its child requirement since staff have no child row.
`canAccessGrade` passes for every grade.

**Eight named staff as of 2026-08-13** — three `@fountainheadschools.org` and five
`@fsksurat.in`, two of them role accounts rather than people. This replaced the three designated
on 2026-08-12: one address moved from `@protego.services` to `@fountainheadschools.org`, and one
`@fsksurat.in` address dropped out of the list entirely.

**The addresses themselves are written only into the gitignored `.env` (and mirrored into the
gitignored `public/config.local.json` for the no-server dev path), and must be set by hand in
Netlify's environment** — this repo is public, so they are deliberately absent from every
committed file, **including this one**. Never paste the list into the skill, `config.json`, or
any committed file; record only counts and domains here. Matching is case-insensitive;
a mixed-case spelling of a staff address was verified to work.

Changing the list is three places, and **the third is the one that matters in production**:
`.env` (local `netlify dev`), `public/config.local.json` → `adminEmails` (local no-server path),
and `ADMIN_EMAILS` in Netlify — **which needs a redeploy to take effect**. There is no Netlify
CLI installed on this machine as of 2026-08-13 (`netlify` is not on PATH), so the production
step is the user's to do, from the Netlify UI or after `npm i -g netlify-cli` + `netlify login`.

**The list lives in `ADMIN_EMAILS` on the server, never in `config.json`.** The client config
is public, and while a typed email is the only credential, publishing the staff list would
hand out the exact addresses that unlock every grade. `config.adminEmails` +
`isAdminEmailLocally()` exist only for the demo/no-server path — do not promote them.

Staff are matched **before the roster is loaded**, so they need no student row.
`sheetsAdapter.lookup` returns `{role, students}`; the no-server fallback returns the same
shape, and `AuthContext` also accepts a bare array for `mockAdapter`.

Verified: staff see 14 grade cards and can open `/trip/g12` directly; a parent on the same
build still gets "Not your child's grade". Staff currently see **trip pages only** — there is
no roster or student-list view, deliberately, since that would put PII back in the browser.

## The roster lookup function — the production answer
`netlify/functions/lookup.js`, served at **`/api/lookup`** (POST `{kind, value}`).

- Fetches the roster server-side, matches the credential, returns **only**
  `{id, name, grade, section}` per matched child plus `parentName`. No emails, phones,
  addresses, DOB or blood group ever cross the boundary. Verified against the live feed:
  real email → 200 with exactly those four fields; unknown → 404; malformed → 400.
- 404 is returned for both "no such address" and "address with no children", so the endpoint
  cannot be used to enumerate who is on the school's roll.
- **Imports the frontend's own `csv.js` / `normalize.js` / `identity.js`** so column handling
  cannot drift. That is why those modules now use **explicit `.js` extensions** — Vite did not
  need them, plain Node does. Keep them.
- `resolveParent()` is plain JS with no Netlify-specific types. **Only the thin `handler`
  wrapper is host-specific**, so moving to a paid domain/host means rewriting ~20 lines.
- `ROSTER_CSV_URL` comes from the server environment and is **deliberately not committed** —
  the repo is public and the feed is unauthenticated.
- 5-minute in-memory cache, per warm instance.

Frontend side: `sheetsAdapter.lookup()` posts to `config().rosterApiUrl` when set, else falls
back to filtering a client-side roster (correct for demo data, wrong for real). `rosterApiUrl`
lives in `config.json`, read at runtime — repointing after a host move needs no rebuild.
Trip content still comes from Sheets directly; it carries no personal data, so there is no
reason to route it through a server.

**Live since 2026-08-12.** The site is **`fountainheadschooltrips.netlify.app`** (site id
`01b3470b-efd1-4c26-b69b-9d871e9099de`, auto-deploying from the GitHub repo). Before that day
`ROSTER_CSV_URL` was unset, and the function's 502 branch surfaced in the UI as
**"Could not reach the school roster right now."** — that message means *the server variable is
missing*, not that the feed is down. Both `ROSTER_CSV_URL` and `ADMIN_EMAILS` are now set via
`netlify env:set` (all contexts) and the site redeployed.

Verified against production: a real parent email returns 200 with exactly
`{id, name, grade, section}`, a staff address returns `{role:'admin', students:[]}`, an unknown
address returns 404, and the browser flow reaches the child card. **Env changes need a redeploy
to take effect** — setting the variable alone does nothing to a running site.

## The real roster feed — needs a backend, cannot be used from the browser
The school publishes its roster at `.../CSVDATA/StudentData.csv` (an HTTP IP that 302s to an
HTTPS host). Checked 2026-08-11; only row 1 was fetched, never the records.

- **No `Access-Control-Allow-Origin` header.** Confirmed in the browser, not just by curl: a
  direct `fetch()` fails with `TypeError — Failed to fetch`. Not something code can work
  around — either the server sends CORS, or a server-side hop fetches it (see the dev proxy
  above).
- **No authentication at all**: ~1.1 MB downloadable by anyone with the URL.
- Columns go far beyond what the app needs: `BirthDate`, `BloodGroup`, `StreetNo`,
  `Address1-3`, `City`, `StudentNameAsPerAadharCard`, `ImagePath`. Pulling this into a
  parent's browser would expose every child's **home address** to any parent with devtools.
- Therefore this feed makes the **`api` adapter mandatory**: a server fetches it, matches the
  credential, and returns only that parent's children with only the needed fields. Never wire
  it to `fetchStudents()` in the browser, even if CORS is later added.
- Do not commit the URL or any of its data to this repo.

### What its columns taught us (both were real bugs, now fixed)
- `Senior KG` normalized to `''` and every such row was **silently dropped**. `normalizeGradeId`
  now tests senior before the generic kindergarten branch, and `sk` is a real grade in `GRADES`.
- `ParentsEmailID` / `FathersMobileNo` / `MothersMobileNo` matched no alias, so credentials came
  out blank and **nobody could log in**. `toStudent` now uses `collectAll` and returns
  `emails: []` / `phones: []`, so any one of a family's credentials works — which is also how
  mothers get access. `parentName` replaced `fatherName`.
- `StudentEmailID` and `EmergencyContactNo` are excluded on purpose: a child's own address is
  not a parent credential, and an emergency contact is often a neighbour. `pick`/`collectAll`
  match whole normalized header names, so `StudentEmailID` can never collide with `Email`.

## The school's real Drive folder — do NOT publish it
`drive.google.com/drive/folders/1kBYDyPs-2nAW-l2sEf7Czz5RaevzrxgQ` — "Educational trips
(25-26)". Inspected read-only via the user's own Chrome session on 2026-08-10, because it is
private to anonymous requests (`302 → ServiceLogin`, confirmed three ways).

**It is the wrong source, and making it public would be a serious disclosure.**
- Breadcrumb reads **Shared with me** — the user does not own it; the school does. They may
  not have authority to change its sharing at all.
- It holds `BOARD RESOLUTIONS 2025-26 TRUST DEED.pdf`, `Service Order` (a vendor Service
  Level Agreement), a `Vendor details` folder, police correspondence (`Letter to Police`,
  `Police station PYP…`, `SS Police station…`), and internal cost sheets (`Nature camp cost
  calculation sheet`). "Anyone with the link → Viewer" would publish the trust deed and
  vendor contracts to the open internet, irreversibly.
- **Not one of its ~22 items matches the eight source names**, so folder mode resolves to
  nothing regardless.
- **There is no student roster anywhere in it** — no parent could log in even if it were
  readable. This is the single biggest gap.
- Real trip content does exist (`Educational trips 2025-26`, `SS edu trips`,
  `Edu trips JS updated.pdf`, `Adventure-and-Community-Sattal-1.pdf`) but as dense internal
  planning grids, not the flat per-grade rows `normalize.js` expects.

Correct path: a **separate, school-owned folder holding only parent-safe data**, built from
`sample-data/Trip Data.xlsx`, curated out of the internal sheets by a human. The curation step
is a feature — it is what keeps trust deeds off the public internet. Never propose pointing
`folderId` at the internal folder.

## Real trip content — where it actually lives (found 2026-08-12)
Inside the internal folder, `Educational trips (25-26) › Senior School details`
(`1imYgZn8K8qrLFmZX18qK1eq27MJHe7mt`) is the **first genuinely parent-facing trip material
found**. It is senior school only — there is nothing for Grade 4 or any junior/middle grade
there, which is why the Grade 4 demo landed on an empty page. A junior/middle equivalent has
not been located.

`PPT-For parent Orientation/` holds one Google Slides **parent orientation deck per grade and
batch** — the real trips, all December 2025:

| Grade | Destination | Batches |
|---|---|---|
| 7 | Abhaneri–Ranthambore (B1) / Jaipur–Ranthambore (B2) | B1 6–13 Dec, sections Acuity, Acumen, Cognizance; B2 8–13 Dec, Idea, Insight… |
| 8 | Pachmarhi–Jabalpur | 7–13 Dec, Ardour/Exuberance/Rhapsody… |
| 9 | Jim Corbett | 7–14 Dec, all sections together |
| 10 | Rishikesh | B1 5–12 Dec (Apotheosis, Harbinger…), B2 6–14 Dec |
| 12 | Manali | B1 5–14 Dec, B2 6–14 Dec |

G7 B1 deck: `docs.google.com/presentation/d/1aLt74Pl7Il7gr3imlgqOwwI8Z0Bq8eed49DTbEmL2Ek`.
Grade folders (`Grade 7` = `1sMVq7sSCmYD-pgB-30umoMroO_c6OA8n`) add consent forms (docx+pdf),
train charts (`Surat to Jaipur -6 Dec`, `Jaipur to Surat - 12 Dec`, `Sawai Madhopur to…`),
insurance, and a `Govt docs` subfolder. Sibling folders: `PPT-For students`, `Posters`,
`ppt before trip- synopses`, `SS trips Photos/videos (2025-26)`.

**Still not shareable as a folder**: the same level holds `Purchase approval`, `Trip Approval`,
`Update to Vendors`, teacher-assignment and student-feedback response sheets, and the grade
folders contain **student name lists** (`G7 Students list`, `Final students list for…`). Curate
per file; never point `folderId` at it.

**Blocker hit:** the Chrome extension is permitted on `drive.google.com` but **denied on
`docs.google.com`** — folder listings, file names and thumbnails are readable, document
contents are not. So itinerary/guidelines/packing text cannot be extracted until that
permission is granted, or the content is pasted in.

### The local Grade 7 demo — the only login with content
`public/local-roster/` (gitignored) now holds **real** Grade 7 Batch 1 content curated from the
Drive folder — trip title, dates, batch/section note, the parent orientation deck link, and two
travel legs. The fabricated G5/G7/G9 rows that survived the purge were cleared out of
`itinerary/guidelines/reminders/media.csv` at the same time; those four are header-only because
their content is locked inside decks on `docs.google.com`.

`config.local.json` sets `csvBase: "/local-roster"`, so all eight sources read from there.
Demo login: **`p.aadhyan.khunt@fsksurat.in`** → Aadhyan Khunt, Grade 7, Section Cognizance →
hero, overview, one document card, two travel legs. Verified 2026-08-12, no console errors.
**Local only — never deployed, and no invented content anywhere in it.**

## Open with management — unsettled, blocks decisions
Raised in `docs/DATA-HANDOVER.md`; none answered yet. Do not assume any of these.
- **Privacy of the `Students` tab.** Direct-from-Sheets makes every family's name, email and
  phone publicly readable. If management says no, a backend is required — timeline/budget.
  Middle path floated: keep PII in a private sheet behind the server, trip content public.
- **Which credential**, and whether to verify (Google Sign-In / SMS OTP / none).
- **"Father" naming.** `FatherName/Email/Phone` excludes mothers and guardians. Options put
  to them: rename to `Parent*` (already accepted as aliases), add a second contact set, or
  allow multiple contact rows per student. Cheap to change before the roster is typed.
- **Whether trip documents will be publicly shared** (governs thumbnail previews).
- **Ownership and update cadence** of the sheet.
- **Scope beyond the eight tabs** — consent forms, fees, rooming, medical declarations.
- Confirmation that only JK and Grades 1–12 exist.

## Working rules
- **React + Vite, plain CSS.** Do not add a UI kit, CSS framework, state library or
  TypeScript without being asked.
- Content never gets hard-coded in a component — it comes from an adapter.
- New sheet column → add an alias in `normalize.js`, never read `row.someKey` directly.
- Any new grade-scoped screen must go through `canAccessGrade` before fetching.
- Keep `docs/SHEET-SCHEMA.md` in step with `normalize.js`; it is what the school works from.
- Dummy data changes go in `scripts/generate_sample_data.py` and get re-run. Never hand-edit
  `sample-data/*.xlsx` or `public/sample-sheets/*.csv` — they are build outputs.
- **`schoolTrips/` IS a git repository** and pushes to a public GitHub remote — corrected
  2026-08-14, having said the opposite since 2026-08-07. A tracked file is recoverable, so
  `git ls-files <path>` is the check before deleting one. What is *not* recoverable is anything
  gitignored: `public/local-roster/`, `config.local.json`, `.env`. Confirm before removing those.
  (The parent directory `C:\SchoolRepo` is not a repo; that is probably where the old note came
  from.)
- **`.claude/launch.json` exists twice.** `schoolTrips/.claude/launch.json` is used when the session
  opens in `schoolTrips/`; `C:\SchoolRepo\.claude\launch.json` (added 2026-08-14) is used when it
  opens at the parent, and runs `npm --prefix schoolTrips run dev`. The preview tool reads only the
  primary working directory's copy, so a session started at `C:\SchoolRepo` cannot see the inner one.
- **The browser console buffer is per-tab and survives reloads**, so stale HMR errors read as live
  ones. `useAuth must be used inside <AuthProvider>` from a Fast Refresh invalidation is the usual
  false alarm. Check the `?t=` build stamp on the stack frames, and confirm in a **new tab** — that
  is the only way to get a clean buffer.
- Two exports have no external caller and are kept on purpose: `matchFolderFiles`
  (exported so folder matching can be checked without a network call) and `GRADES` (the
  canonical domain list `gradeById` reads). Do not "clean" either away.
- Keep the codebase comment-light: comments explain *why* (a tolerance, a caveat), never
  what the line does.
- `legacy/trip-explorer.html` is frozen reference. Do not edit it.

## Changelog
- 2026-08-17 (fourth pass, same day) — **The Grade 7 trip photograph was published** ("overview photo
  not show in after publish please set in folder"). Moved
  `public/local-roster/trip-photos/g7-abhaneri.jpg` → `public/trip-photos/g7.jpg` and added the entry
  to the committed `config.json`; dropped the now-redundant `tripPhotos` override from
  `config.local.json`. This reverses the 2026-08-14 decision to keep it out of every build. The school
  was told first that the repo is public (so the image enters git history permanently) and that
  `public/` is not behind the parent login, and confirmed **parental consent is on file**. Verified:
  in `dist`, 200 as `image/jpeg`, banner renders 1220×563.
- 2026-08-17 (third pass, same day) — **The guideline poster is shown whole instead of as a 90px
  strip you had to click through.** `.chip-col .doc-card` fills its column and `.doc-thumb` takes the
  remaining height at `object-fit: contain`; new `eager` prop on `DocCard` for images that are the
  panel's content. Drawn 669×375 at 1907×878, nothing cropped, no scroll. **Also measured, and worth
  more than the CSS: both poster thumbnails error anonymously while a public control image loads, so
  the posters render for staff only because their own browser is signed in to Google.** A signed-out
  parent sees an empty tile. Verify sharing with a detached `new Image()` plus a control, never by
  looking at your own screen. Testing this needed the live sheet, so `csvUrls.trips` was temporarily
  removed from the gitignored `config.local.json` and **restored afterwards**.
- 2026-08-17 (second pass, same day) — **Safety and Do's/Don'ts side by side; Things to carry became
  its own tab.** Tab list is now Overview · Itinerary · **Things to carry** · Orientation · Travel ·
  Photos. Do's and don'ts is a **vertical stack of tinted cards** (`RuleStack`) under DO / DON'T
  labels, packing is a checklist in a 1080px-capped card, and Safety flows into **two grid tracks**
  above 1600px. Fixed the stray grey bullet beside every number — `ul.plain li::before` beat
  `.chip-lines > li::before` on source order at equal specificity, and the same trap had been
  silently discarding `display: block`. **Do not reach for CSS multicol in these lists:** in a
  scroller with a definite height the browser adds overflow columns *sideways* (measured: three 180px
  columns and 1226px of horizontal scroll on a 601px card), and `column-fill: balance` does not stop
  it. Grid tracks behind a media query is the working shape. Verified at 1907×878: 11/11, 4/4 and
  13/13 items all on screen, no panel or window scroll on any tab; 1280×720 and 375×812 degrade to
  internal and panel scrolling respectively.
- 2026-08-17 — **The three guideline columns redesigned to fill the panel** ("redesign this look
  good attractive take full breath and lenth of screen"). Each is now one card: a tinted head strip
  (icon square, title, item count; green / navy / amber) over a plain white list whose markers are
  drawn by `.chip-mark` — a **numbered disc** for safety, a **tick or cross** for do's and don'ts, a
  tick for packing. `splitRule()` reads the sheet's `Do:` / `Don't:` prefix to pick the marker and
  then strips it. Height: `.section.is-stretch` (a new `className` prop on `Section`) is
  `min-height: 100%` and `.chip-row` is `flex: 1 1 0`, so the row takes every px the itinerary
  leaves. To give it more, the batch block and the itinerary card were put **beside** each other in
  `.itin-top`, and the batches themselves side by side in `.batch-grid`. Measured at 1280×720:
  top block 306 → 167px, guideline row 217 → **356px**; at 1920×1080 the row is **758px** and the
  columns 608px wide, showing 8/11, 4/4 and 11/13 items with **no panel scroll and no window
  scroll**. Below 980px the columns take their natural height and the panel scrolls (stacked, they
  were sharing one row's height and each got a 69px head and nothing else).
  **Three flex traps, all found by measurement, all worth remembering:** (1) `flex: 1 1 auto` on
  `.chip-lines` made the list contribute its content height up the chain — the row became 1061px and
  the panel overflowed by 843; a **zero basis** is what makes a scroller take what it is given
  instead of defining it. (2) `height: 100%` on a card inside an `align-items: stretch` parent feeds
  itself — the block settled at 265px, taller than either part needed. (3) `.orient-row`'s 270px
  basis wrapped staff's **two** itinerary cards onto a second line, and the wrap, not the card, was
  the 265px. Also: a rule for `.panel` placed above `.panel.is-tight` loses on source order at equal
  specificity — `.itin-top > .panel.is-tight` is why the padding override sticks.
- 2026-08-14 (fourth pass, same day) — **Fixed two layout bugs the user caught in screenshots that my
  own measurements had declared clean.** (1) `.secnav` was still `position: sticky`, and since
  `overflow: hidden` makes `.app.is-fixed` a scrollport, `top: 66px` pushed the bar 66px down out of
  its flow slot — leaving an **84px empty band** under the header and laying the bar **over the
  panel**, slicing the "Orientation" heading and the first batch row. Now `position: static`; gap
  84 → 18, no overlap on any tab. (2) `.chip-lines` was capped at a flat 180px, which cut guideline
  sentences in half on a 1080px-tall window while leaving ~300px of panel empty below —
  now `clamp(150px, 26vh, 430px)` (281px at 1080). (3) `.orient-row`'s `auto-fit` + `1fr` grid gave a
  lone card the **whole 1860px row** and a pair 930px each — the cards the school had asked to be made
  small were the widest elements on the page; it is flex with a 270px basis now. **The lesson is the
  measurement, not the CSS:**
  `overflow: hidden` makes `scrollWidth - innerWidth` read 0 regardless of whether the layout fits, so
  every "zero overflow" number from the previous pass was meaningless. The fixed layout must be checked
  by walking `.sections *` and comparing each element's rect against the viewport. Re-verified that way
  at **1280×720 and 1920×1080, on both data paths** (fixture text and live workbook chips): 0 clipped
  elements, no nav/panel overlap, 18px gap, window scroll 0, panel scroll 0, first heading fully
  visible on all five tabs. Build clean. **Not pushed.**
- 2026-08-14 (third pass, same day) — **The sheet's chips shown side by side; Travel split back out;
  nothing scrolls on desktop.** `TopLine` deleted (the last row above the tabs — the top bar already
  carries it), which forced `TopBar` to show "My child" for one-child parents who would otherwise have
  been stranded. Itinerary is now batches → itinerary chip → **Safety · Do's and don'ts · Things to
  carry in one row**, each showing the sheet's own chip as a preview card labelled with the chip's own
  name, printing text only where a column has no chip. **`applyGuidelineFallback` is no longer
  called** — for a chip cell it was injecting `trip-guidelines.json`'s text and suppressing the
  school's poster, which is precisely "writing according to you"; this reverses the 2026-08-12
  text-over-links position, and the module + JSON are left unused rather than deleted. The Safety tab
  is gone (folded into that row), **Travel is its own tab again**, Orientation cards use a new
  `compact` DocCard (no 150px preview) and the Itinerary section heading was dropped — the three
  together took Orientation from 234px of overflow to none and Itinerary from 166px to none. Verified
  at 1280×720 on **both** data paths — the local fixture (text) and, by temporarily dropping
  `csvUrls.trips`, the live published workbook (chips, since restored): **window scroll 0 and panel
  scroll 0 on all five tabs**, zero horizontal overflow, the three columns confirmed sharing one row,
  chips labelled "Safety guidelines poster" / "Do and donts poster" / "Things to carry poster" and
  each linking out. Build clean, no console errors. **Caveat measured and unchanged: all three poster
  files are private (401), so `naturalWidth === 0` and the previews render empty until the school
  shares them.** At 375px the panels do scroll — three columns stack — while the window still does
  not. **Not pushed.**
- 2026-08-14 (second pass, same day) — **Hero and fact bar deleted; the trip page became a
  fixed-height view that never scrolls the window.** The user crossed both out on a screenshot and
  asked for their content on the Overview image: grade · batch · dates now sit there as `.home-meta`,
  with the trip name and the **whole** Header Text, and the body-copy panel underneath is gone.
  `App.jsx` sets `is-fixed` on `/trip/` routes — `100dvh`, `min-height: 0` down the chain, and the
  site footer dropped (~117px was the difference between fitting and not). The Home tab was relabelled
  **Overview** (id stays `home`). `heroDates` now strips the `Batch N:` prefix in the all-batches case
  too, since staff were reading "Batch 1: 12-19 December · Batch 1: 13-20 December" off the sheet's
  own duplicated text. **Found and fixed a silent content-loss bug in the process:** with `.sections`
  as a flex column, the panel's `scrollHeight === clientHeight` while content painted outside the box,
  so **Safety's last four measures could not be reached by any means** — `.sections` is `display:
  block` when it scrolls, flex only for Overview via an explicit `is-fill` class. Verified at 1280×720
  and 375×812: `window` scroll **0 on every tab** at both sizes, zero horizontal overflow, one image
  on the page, Overview 538/538 and 582/582 with no scroll, Safety 917 and Itinerary 1649 both
  scrollable with their last child reachable, back link present on every tab, `/children` still
  scrolls normally and keeps its footer, `/trip/g3` still "Coming soon". Build clean, **no console
  errors** in a fresh tab. **Not pushed.**
- 2026-08-14 — **Rebuilt the trip page from the school's handwritten notes: nine tabs to four, and
  a real photograph instead of a searched one.** Grades JK–6 became non-clickable "Coming soon"
  cards that issue no fetch (`isComingSoon`); picker cards carry the trip's name from the sheet
  (`useTripTitles`, one fetch for the whole grid); the 520px Wikipedia hero became a 232px bare
  header, with `lib/destinationPhoto.js`, the credit chip, the hero action buttons, `openTab()` and
  the Confirmed pill all deleted; the school's own photo moved to a new **Home** tab carrying the
  Header Text headline over it, with the second copy of the image gone; Itinerary absorbed travel,
  do's/don'ts and things-to-carry; Orientation shows Parent and Student decks with **B1 and B2 side
  by side** (`DocCard` gained `batchTag`). Found and fixed a real data-loss path while verifying:
  the sheet labels **both** Grade 7 rows "Batch 1", and since the label is part of `documentsFrom`'s
  de-dup key, a shared file name would have silently dropped one batch's deck — `batchLabels()` now
  breaks ties by position and warns once. Verified in a clean tab at 1440 and 375: five tabs, one
  image on the page, zero horizontal overflow on every tab, `window.scrollY` unchanged by every tab
  click, `/trip/g3` → "Coming soon" with **0 fetches**, staff → 14 cards (8 soon), parent
  `p.aadhyan.khunt@fsksurat.in` → card named "Jaipur-Abhaneri-Ranthambore" → their own batch's
  dates. `npm run build` clean; **no console errors** (the `useAuth` ones in the old tab were stale
  HMR scrollback). **The G7 photograph is deliberately uncommitted** — see the photograph section.
  **Not pushed.**
- 2026-08-14 — **Chip links switched on for the three text columns, reversing yesterday's rule.**
  Asked to fix "Safety text missing on Netlify"; confirmed first that it is data, not the deploy —
  fetched the live published CSV and Grade 7's Safety / Do-Dont's / Things-to-carry cells still
  read `safety-guidelines-poster`, `do-and-donts-poster`, `things-to-carry-poster`. The primary
  fix (paste the text, `sample-data/grade-7-guidelines-to-paste.md`, verified line-for-line
  against the fixture: 11 / 2+2 / 13) needs write access to a **Restricted** sheet nobody here
  has, so the user chose the code route instead. Removed the `chipLinks` option from
  `documentsFrom` in `src/data/tripApp.js`. Verified **both** paths: reading the live workbook
  (with `csvUrls.trips` temporarily dropped, then restored) Grade 7 has zero pending cards and
  Safety carries 2 real poster links, Things to carry 1; reading the fixture the text still
  prints (11 safety measures, "0 of 13 packed", 0 links). `npm run build` clean, no console
  errors. **Caveat that outlives this change: all three poster files answer 401 anonymously**
  (measured), so a parent now gets a clickable card leading to a Google sign-in page. The links
  are only useful once the school sets those files to "Anyone with the link → Viewer" — same
  sharing blocker as the other 15 files. **Pushed as `cb08a26` and verified on production the
  same day**: bundle hash matched the local build, and Grade 7's Safety tab serves 2 poster links
  and Things to carry 1, with no "link not added yet" text anywhere. The `zz-secnav-repro-*.html`
  scratch files, left untracked by every session until now, **were committed by the user as
  `f460f0e` ("changes")** and are therefore in the public repo — harmless standalone repro pages,
  but no longer scratch.
- 2026-08-13 — **Pushed and live.** `f0f6af4` on `main` carried the whole session — the navy
  redesign, tabs, grade names, Header Text in Overview, and the workbook reader — and Netlify
  auto-deployed it. Verified on production: the new login screen renders, staff reach 14 grade
  cards, Grade 7 shows the hero photo, "View itinerary", and **both photo folders as working
  links from one `output=xlsx` request**, `/api/lookup` still 404s an unknown address, and
  `/local-roster/students.csv`, `/local-roster/trip-app.csv` and `/config.local.json` all serve
  the SPA index rather than their contents (**bodies checked, not status codes**). Two partial
  staff addresses were scrubbed from this file before pushing, since the repo is public. The
  `zz-secnav-repro-*.html` scratch files were deliberately left untracked.
- 2026-08-13 — **Guideline text restored in dev, after removing `csvUrls.trips` had quietly
  taken it away.** The text only ever lived in the local fixture; the live sheet has poster chips
  in those three columns, so reading the live workbook made Safety and Things to carry fall back
  to cards. Put the real URLs into the fixture's five file columns and pointed `csvUrls.trips`
  back at it, so local work now shows text *and* links together. Nothing in the rendering code
  changed — production still needs the school to paste the text into the sheet
  (`sample-data/grade-7-guidelines-to-paste.md`).
- 2026-08-13 — **Staff list grew from 3 to 8** (3 `@fountainheadschools.org`, 5 `@fsksurat.in`,
  two of them role accounts). Written to the gitignored `.env` and `config.local.json` only —
  never to a committed file. Verified locally: two of the new addresses reach all 14 grade cards
  with the Staff chip, and the dropped `@protego.services` address is now refused. **Production
  still shows the old three** until `ADMIN_EMAILS` is updated in Netlify and the site redeployed;
  no CLI on this machine, so that step is the user's.
- 2026-08-13 — **The sheet's links work.** Discovered the published sheet's **`?output=xlsx`
  export keeps every smart-chip URL** the CSV drops (22 vs 0), which overturns the standing
  "no code change can recover it" conclusion. Added a dependency-free workbook reader
  (`src/lib/xlsx.js` — `DecompressionStream` + `DOMParser`) and `src/data/xlsxSheet.js`, wired
  `sheetsAdapter` to prefer it for a published document with a CSV fallback proven by deleting
  `DecompressionStream`. Grade 7 now shows 8 working links (2 decks, itinerary, 3 posters, 2
  photo folders), then **reverted the two text tabs at the user's request the same day** — Safety
  and Things to carry keep their pending cards (`chipLinks: false`), because those belong on the
  page as text; Documents and Photos keep the links. Measured the
  files themselves: **15 of 18 are still private**, so sharing is now the only blocker. Dev's
  `csvUrls.trips` override was removed so local work reads the live workbook like production.
  Build clean, no console errors. **Not pushed.**
- 2026-08-13 — **Tabs restored, grades named, Header Text into Overview.** Section nav became a
  real tablist again (one panel mounted, page never scrolls on a tab click, roving tabindex +
  Arrow/Home/End, tab held by id with a fallback when the grade changes); every parent-facing
  grade now reads "Grade 7" rather than "G7"; the sheet's Header Text moved onto the page —
  first to the hero, then, on the user's choice, into an **Overview tab that now leads the tab
  bar**, headline set apart from its paragraphs. A five-lens review workflow raised 12 findings,
  11 refuted; the one that survived was real and is fixed — `focus({preventScroll:true})` also
  suppressed the tab strip's own horizontal scroll, so on a phone the selected tab could sit off
  the right edge with nothing visibly selected (`revealTab()` now scrolls the strip only).
  Re-measured the live sheet: **still 0 URLs in 0 cells**, photo columns included. Verified in
  the browser at 1440 and 375, no console errors on a clean tab, build clean. **Not pushed.**
- 2026-08-13 — **Converted the UI again, to the "School Trips Portal" design** (`DesignSync`
  project `e7a8d8f0…`): navy/amber on `#FAFBFD`, Instrument Serif display headings, ST monogram
  and avatar, full-bleed trip hero, section eyebrows, dashboard breadcrumb head, gradient grade
  cards, reminders as a dated timeline, green/amber Do–Don't panels. Deliberately skipped the
  design's non-functional search box and notification bell, and invented no photography.
  Also made the dev server's port `PORT`-aware (`vite.config.js`) with `autoPort: true` in
  `.claude/launch.json`, so a second session can run alongside one already on 5180. Verified in
  the browser at 1440 and 375 — see the verification list above. Build clean. **Not pushed.**
- 2026-08-13 — **Converted the whole UI to the user's earlier Claude Design mock** (`DesignSync` project
  `f7ca652f…`, "Grade 7 trip interface"): white/coral Plus Jakarta Sans kit, split-screen login,
  full-bleed sticky header + site footer, grade/child cards with a colour stripe and icon square,
  hero + overlapping fact cards, and **tabs replaced by one scrolling page with a sticky
  underline section nav** (Student · Overview · Documents · Itinerary · Safety · Travel · Reminders ·
  Things to carry · Photos). Safety became a numbered accordion, packing a checklist, travel a card
  per batch, photos a masonry. Sections are still derived from the data. Verified in the browser
  against the local Grade 7 fixture and the live sheet — see the verification list above. Build
  clean, no console errors. **Not pushed.**
- 2026-08-12 — Guidelines as **text**, per the user's screenshots of the old prototype. Split the
  single Do/Dont's column into Do / Don't columns on a `Do:` / `Don't:` prefix, extracted the
  prototype's real Grade 7 safety/do/don't/packing text into
  `sample-data/grade-7-guidelines-to-paste.md` for the school to paste into the sheet, and proved
  the text path end to end with a local fixture (28 items, no cards). **The chips cannot be
  followed** — no URL in the export, and the posters are images — so the sheet is the only route.
  Not pushed.
- 2026-08-12 — **Pushed to GitHub and live.** `9c2e260` on `main` carried everything uncommitted
  from the last several sessions (the `dist` PII guard, `publishedId`, `tripApp.js`, Google One
  Tap, the header/tabs redesign) and Netlify auto-deployed it. `publishedId` is now set in the
  **committed** `config.json`, so production reads the school's published sheet — the first deploy
  with real trip content. Verified on the live site: the pointer is served, `/local-roster/…` and
  `/config.local.json` return index.html rather than their contents, and `/api/lookup` still 404s
  an unknown address.
- 2026-08-12 — **Every sheet column now reaches the page.** Chip cells become pending cards
  (dashed, unclickable, "link not added yet") instead of being dropped, so Grade 7 went from
  Overview + Travel to all six tabs: Overview / Photos 2 / Orientation 2 / Itinerary 1 / Travel 1 /
  Guidelines 3, verified against the live published sheet with every card's label and meta read out
  of the DOM. Guidelines split into one section per type. **Fixed a real bug found while
  verifying:** `config.json` was fetched relatively, so any load of `/trip/:grade` read no config
  at all and showed "Nothing published yet" — previously misdiagnosed as an HMR race. Build clean.
- 2026-08-12 — Redesigned the trip header to the user's order (name → batch → dates → child) as
  labelled facts, put a **Wikipedia destination photo** behind it with a credit link
  (`lib/destinationPhoto.js`), and moved photos back into a **Photos tab**, deleting the rail and
  its CSS. Verified live Grade 7: header order, Hawa Mahal photo at 1920×1440, "Jaipur · photo from
  Wikipedia" credit, and tabs Overview / Photos(3) / Travel with the Photos grid + album card —
  the Photos tab exercised with throwaway media rows that were removed again. Build clean.
- 2026-08-12 — Moved photos out of the tabs into a `PhotoStrip` rail directly under the header
  (header → photos → tabs → detail), per the user's layout. Added `PhotoTile` with an onError
  fallback and deleted the superseded `PhotosPanel`. Verified all three strip states and the DOM
  order against fixtures, then confirmed the live sheet still renders clean with no strip (it has
  no photo URLs yet).
- 2026-08-12 — Redesigned the trip page around the school's cards-vs-text rule: orientation,
  photos and itinerary became `DocCard` grids under Photos / Orientation / Itinerary tabs, while
  header text, travel, safety, do's/don'ts and packing print as text. Split per cell so a
  half-converted sheet works, and added `looksLikeFileName` so leftover chip slugs are not shown
  as guidance. Verified all six tabs against a fixture with real links, then confirmed the live
  sheet renders clean.
- 2026-08-12 — **The app now reads the school's real sheet.** Published link wired into
  `config.local.json`; Grade 7 renders live (title, both batch date lines, full starting text,
  both travel blocks). Confirmed 0/22 link cells survived as URLs — smart chips — and made the
  loss reportable per grade. Mapped all 13 columns. Fixed the carry-forward bug that filed the
  `MlC` row under Grade 11.
- 2026-08-12 — Built `tripApp.js` for the school's actual one-tab schema (merged grade cells,
  one row per batch, prose travel), detected by headers so both schemas work. Added the Batches
  and sections block and fixed travel to keep its line breaks. Rendered Grade 7 end to end from
  a transcription of the real sheet. Flagged the smart-chip risk: chips export without URLs.
- 2026-08-12 — **PII leak and fix.** Deploying `dist` published the local roster copy (2,619
  students) and `config.local.json` publicly for ~3 hours; the latter also silently disabled
  `/api/lookup` on production. Added `stripLocalOnlyFiles()` to `vite.config.js`, redeployed,
  deleted the one leaking deploy and swept all 16. Recorded that `public/` ships regardless of
  `.gitignore`, and that deploy permalinks outlive a fix.
- 2026-08-12 — Added `publishedId` so the content sheet can stay Restricted: `parsePublishedRef`
  / `publishedCsvUrl` handle the `/d/e/2PACX-…/pub` shape, and it wins over `sheetId` with no
  fallback to gviz. Unit-checked the parsing, including that a normal edit link is rejected.
  Identified the real content sheet ("Trip app") and measured its 401s. Waiting on the published
  link before the layout work can be finished.
- 2026-08-12 — **Collapsed to two sources.** Deleted the `Settings` index tab, per-source
  `sheetIds` and `folderId` folder discovery; `urlsFor` is now csvBase → `sheetId`. Rewrote
  `config.json` around the two pointers. Moved Photos to the first tab. Still waiting on the
  school's single content spreadsheet — the remaining asks (Orientation / Student orientation /
  Itinerary tabs, full text rendered in the page instead of links out to Drive) need its columns
  before they can be built.
- 2026-08-12 — Rebuilt the trip page as six data-derived tabs with a sticky pill bar, keyboard
  support and reworked photo tiles. Verified all six render (temporarily, with throwaway rows
  that were removed again), that empty tabs stay hidden, and that mobile scrolls the bar without
  overflowing the page. **Watch out:** rewriting several files in `public/` at once while the
  page reloads can make the `config.local.json` fetch lose the race, and the app then reports
  "No spreadsheet configured" for every source — reload before believing it.
- 2026-08-12 — Made Google the no-typing sign-in path: One Tap with `auto_select`, the button as
  fallback, `disableAutoSelect()` on logout. Fixed the real bug this exposed — `loginWithGoogle`
  mishandled the `{role, students}` adapter shape, crashing sign-in and dropping staff role; both
  paths now share `resolveIdentity`. Verified the typed parent and staff logins still work. **Not
  pushed, per instruction**; still blocked on an OAuth client id.
- 2026-08-12 — **Deployed site now authenticates real parents.** Set `ROSTER_CSV_URL` and
  `ADMIN_EMAILS` on Netlify via the CLI and redeployed; verified parent/staff/unknown against
  production. Note the extension is blocked on `app.netlify.com`, so the CLI (`netlify login`
  → `link --id` → `env:set`) is the way to touch site settings from here. Trip content is
  still unpublished online — the Grade 7 rows remain local-only.
- 2026-08-12 — Built the first working demo on **real** content: Grade 7 Batch 1 rows curated
  from the Drive folder into the gitignored `local-roster` CSVs, `csvBase` pointed at them, and
  the leftover fabricated rows cleared. `p.aadhyan.khunt@fsksurat.in` now renders a populated
  trip page. Itinerary, guidelines and packing stay empty — that text lives in decks the
  extension cannot read.
- 2026-08-12 — Explored `Senior School details` in the school's Drive (user-supplied link) and
  found the first real parent-facing trip content: per-grade/batch parent orientation decks for
  Grades 7, 8, 9, 10 and 12, December 2025, plus consent forms and train charts. **Nothing for
  Grade 4 or any junior/middle grade.** Confirmed the extension cannot read `docs.google.com`,
  so document text is still unavailable. Also noted the leftover fabricated G5/G7/G9 trip CSVs
  surviving in the gitignored `public/local-roster/` — placeholder doc ids, `example.edu`
  contacts, zero media rows, and unreachable by the app.
- 2026-08-12 — Removed the single-child auto-redirect so **every** parent gets the card-then-tap
  flow; trip page now always offers a back link. Designated three staff addresses, written to the
  gitignored `.env` (and mirrored into `config.local.json` for the no-server dev path) — never
  committed, still requires setting `ADMIN_EMAILS` in Netlify. Verified in-browser: a Grade 4
  parent sees one card with only their own child's name, `/trip/g5` still blocked, two of the
  three staff addresses reach all 14 grade cards. Build clean. **Nothing pushed to GitHub.**
- 2026-08-11 — **Erased all dummy data.** Deleted the demo CSVs, `mockAdapter`, `mock/rows.js`,
  the Drive fixture and the fabricated deck; `generate_template.py` now emits an empty workbook.
  `dataSource` defaults to `sheets`, `folderId` cleared. Fixed `merge()` so `null` explicitly
  clears a value. Trip content now legitimately has no source — grades read "Nothing published
  yet" until the school's sheet exists.
- 2026-08-11 — Added the staff role: server-side `ADMIN_EMAILS`, all-grades scope, grade
  picker, Staff chip. Verified staff reach any grade and parents still cannot.
- 2026-08-11 — Built `netlify/functions/lookup.js` (`/api/lookup`): server-side roster match
  returning only id/name/grade/section, verified against the live feed. Reuses the frontend
  normalize modules (hence explicit `.js` extensions). `resolveParent()` is host-agnostic so
  the move off Netlify is a ~20-line rewrite. `rosterApiUrl` is runtime config, so repointing
  needs no rebuild. Still blank/unset, so untested in the cloud.
- 2026-08-11 — Proved in-browser that the roster feed is CORS-blocked (`Failed to fetch`), then
  made it usable in dev via a Vite proxy at `/roster` plus per-source `csvUrls`. Added the
  gitignored `config.local.json` override so local work can target real data without breaking
  the auto-deployed committed config.
- 2026-08-11 — Checked the school's real roster CSV feed: public, unauthenticated, **no CORS**,
  and carrying addresses/DOB/blood group/Aadhaar names. Concluded it makes the `api` adapter
  mandatory. Fixed the two bugs its columns exposed — `Senior KG` being silently dropped, and
  `ParentsEmailID`/`FathersMobileNo`/`MothersMobileNo` matching no alias — and moved students to
  `emails[]`/`phones[]` so either parent can log in.
- 2026-08-10 — Inspected the school's real Drive folder read-only via the user's Chrome.
  Found it is "Shared with me" (not theirs), contains a trust deed, vendor SLAs and police
  correspondence, matches none of the eight source names, and has no student roster. Recorded
  it as **must not be published**; recommended a separate parent-safe folder instead.
- 2026-08-10 — Added `netlify.toml` in the project root and `public/_redirects` to support both Git-based and direct drag-and-drop Netlify deployments. Set build command to `npm run build`, publish directory to `dist`, and set up SPA redirect rules to handle React Router client-side routing.
- 2026-08-07 — Cleanup pass: deleted dead `maskPhone`, `isValidPhone`, `isFolderUrl`;
  un-exported `parseCsv` and `isValidEmail`; stopped generating the never-read
  `sample-sheets/settings.csv`; removed the redundant local `.env` so `config.json` is the
  single pointer. Verified the app still renders afterwards. Noted that this directory has no
  git history, so deletions are irreversible.
- 2026-08-07 — Added the end-to-end `setup-chain.svg` diagram and
  `Trip Explorer - Setup guide.pptx`, a 7-slide deck covering the four setup steps, the
  exact spreadsheet names, sharing as two distinct jobs, and the five quiet failure modes.
- 2026-08-07 — Added **Drive-folder-as-configuration** (`folderId`): the app lists the folder
  and matches spreadsheets to sources by file name, refusing to guess when two files match.
  Added a `gid=0` fallback so a dedicated file with a `Sheet1` tab still resolves. Recorded
  that this reverses the file-names-are-free rule.
- 2026-08-07 — Added `sample-data/split/` (Trip Master + one workbook per source) for the
  master-links-to-sheets layout, `docs/WHERE-TO-CONNECT.md` answering "where does the sheet
  plug in", and an exact-names section in `SHEET-SCHEMA.md` distinguishing free file names
  from strict tab names. Corrected a doc that stated the source-resolution order backwards.
- 2026-08-07 — Config collapsed to **one pasted spreadsheet link**: tabs are addressed by
  name via `gviz ?sheet=`, so the eight gids are gone, and `sheetId` parses a share URL.
  Added the optional `Settings` index tab for redirecting a single source. Wrote
  `docs/ARCHITECTURE.md` with three self-contained SVG diagrams.
- 2026-08-07 — Made updates dynamic. Added `public/config.json` read at page load so pointers
  change without a rebuild, refactored `src/data/index.js` to function exports so adapters
  resolve after config lands, and added Drive folder expansion for `Documents` rows behind an
  optional API key. Established the permanent-spreadsheet-id convention as the main fix.
  Verified both the expansion and the no-key fallback against local fixtures.
- 2026-08-07 — Explored making trip updates dynamic. Confirmed a Drive API key can list a
  public folder, but established that a folder cannot carry grade/label/order and so can only
  replace the `Documents` list, never the sheet. Identified that a permanent spreadsheet id
  plus runtime config removes most of the pain without folder-listing at all. Design choice
  pending.
- 2026-08-07 — Built the dummy dataset and the connection path: `Trip Data.xlsx` (8 tabs,
  grade dropdowns) for upload to Drive, matching CSVs served locally, and a dummy Parent
  Orientation deck. Added `VITE_SHEET_CSV_BASE` so the real sheets adapter can run offline —
  which finally exercised `parseCsv`/`normalize`/`assembleTrip` against real CSV bytes across
  three grades. Wrote `docs/CONNECT-SHEET.md`. Default `.env` now uses this local-CSV mode.
- 2026-08-07 — Wrote `docs/DATA-HANDOVER.md`, the school-facing brief: Drive folder layout,
  the two distinct sharing steps, all eight tabs with copy-paste headers, the failure modes
  (unreadable grade drops a row silently; a document not listed in `Documents` is invisible
  because the app never scans the folder), and six decisions for management. Logged those
  decisions as open above.
- 2026-08-07 — Added **email-based access**: one login box accepting an email or a mobile,
  matched against `FatherEmail` / `FatherPhone`. A row is reachable by whichever column is
  filled; both blank means nobody. Added optional Google Sign-In behind
  `VITE_GOOGLE_CLIENT_ID`, and an adapter-level `lookup({kind,value})` seam replacing
  `lookupByPhone`. Recorded that the browser-tool synthetic click does not reach React on
  this form.
- 2026-08-07 — Rewrote as a React + Vite app per requirements: Google-Sheets-backed content,
  phone login, per-grade access control, and thumbnail-preview document cards replacing the
  prototype's iframes. Added the eight-sheet schema contract, three swappable data adapters,
  and loose header/grade/phone parsing. Fixed a mock-adapter key-normalization bug that
  broke login. Verified the full flow in-browser. **Superseded the prototype's "one file,
  zero dependencies" rule**, which the user explicitly overrode.
- 2026-08-07 — Created skill from the single-file Trip Explorer artifact.
