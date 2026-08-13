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
legacy/               original single-file prototype (reference only)
src/
  main.jsx            BrowserRouter > AuthProvider > App
  App.jsx             routes + footer
  auth/               AuthContext, RequireAuth / RequireStudent
  components/         Icon, Section, DocCard, TopBar, States
  data/               index (adapter pick), sheetsAdapter, apiAdapter, csv,
                      normalize, useTrip
  lib/                grades, phone, docPreview, destinationPhoto
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
| `sheets` | `gviz/tq?tqx=out:csv` per tab, **or local CSVs when `VITE_SHEET_CSV_BASE` is set** | tolerates missing optional tabs via `Promise.allSettled`; detects Google's sign-in HTML (see below) |

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

**CONFIRMED against the live published sheet, 2026-08-12: smart chips destroy every link.**
`0 of 22` filled link cells carried a URL — all exported as display text ("Pics for trips",
"safety-guidelines-poster"). **Nothing in the app can be opened**, and no code change can recover
it: the URL is simply absent from the export. The school must paste plain URLs or use
`=HYPERLINK("url","label")`. What the app can do — and now does — is show the file's name and say
the link is missing (see pending cards below).

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

**Current honest state:** login works against the real roster, but **no trip-content source
exists**, so every grade renders "Nothing published yet". That is correct behaviour, not a
bug — do not "fix" it by reintroducing sample data. It resolves when the school creates and
shares a trip spreadsheet and its link goes into `sheetId`.

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

**Page order, revised 2026-08-12: header (with a destination photo) → tabs → panel.** The photo
rail between hero and tabs was removed at the user's request and photos are a tab named
**Photos** again, so the tabs are **Overview · Photos · Orientation · Itinerary · Travel ·
Guidelines**.

`PhotosPanel` renders a `photo-grid` of `PhotoTile`s when the sheet holds image URLs, plus a
`DocCard` block for album folder links; with neither, `buildTabs` never creates the tab.
`PhotoTile` swaps to a typed tile on `onError`, since a Drive image that is not link-shared 403s
and would otherwise leave a white gap.

### The trip header — name, batch, dates, child, in that order
`TripHero` in `TripPage.jsx`, ordered as the user specified: grade pill → **trip name** →
**Batch** → **Dates** → **Travelling** (child · section). The three facts are a `th-facts`
definition list with a small uppercase label each, not a row of bare pills — "Batch 2" alone does
not tell a parent it is their child's batch. `heroBatch` says `Batch 1` only when
`trip.batchMatched`; otherwise it says "All N batches", because naming one batch would be wrong
when the page is showing every batch. `heroDates` strips the "Batch 1:" prefix already shown
beside it.

**The hero photo is of the destination, from Wikipedia — never presented as the school's photo.**
`lib/destinationPhoto.js` splits the Destination cell (`Jaipur-Abhaneri-Ranthambore` → three
candidates), searches each via the action API
(`generator=search&prop=pageimages&piprop=thumbnail&pithumbsize=1600&origin=*`) and takes the
first hit; results are cached per destination and a failure resolves to `null` so the hero just
stays the grade colour. The action API is used over the REST summary endpoint because summary
thumbnails are only 330px and search tolerates the school's spelling (`Panchmarhi` → Pachmarhi).
It sends `Access-Control-Allow-Origin: *`, so no key and no proxy. A sheet `coverImage` always
wins, and when the Wikipedia image is used a `th-credit` link names the page. Keep the credit —
without it an illustrative stock photo reads as a picture of this trip.

The photo is **not** `loading="lazy"`: it is the hero, above the fold, and lazy images never load
at all while the preview pane is hidden, which also makes the tile fallbacks unverifiable there.

`Do/Dont's` is one column holding both sides, so it renders as a **single list**, not the
eight-tab schema's Do/Don't pair — hence the extra `doDonts` field alongside the legacy
`dos`/`donts`.

The card/text split is decided **per cell, not per column**: a URL in a text column still becomes
a card (a "Posters" block), and text in a link column is ignored. That is what lets the sheet be
half-converted from chips to URLs without the page breaking either way.

`GuidelinesPanel` keeps **one section per guideline type** — Safety guidelines / Do's and don'ts /
Things to carry — each holding its text lines *and* its poster card, instead of pooling every
poster into one "Posters" block. "Things to carry" must stay findable under that name whichever
form the school used.

`looksLikeFileName()` drops a leftover chip name from a text column — a single
hyphen-or-underscore token with no spaces, like `safety-guidelines-poster`. Printing it as a
safety guideline read like a broken attachment. Real guidance is a sentence and has spaces.
Verified: with the live sheet those three columns now yield nothing at all rather than three
slugs, and with a fixture carrying real URLs and text all six tabs render correctly.

## The trip page is tabbed
Rebuilt 2026-08-12: hero, then a **sticky pill tab bar**, then one panel. Tabs are
**Overview · Photos · Orientation · Itinerary · Travel · Guidelines**, where Overview folds in
reminders and coordinator contact, and Guidelines folds in safety, do's/don'ts and things to
carry — six tabs instead of ten stacked sections.

`buildTabs(trip)` derives the list **from the data**, so a tab with nothing behind it is never
rendered: today's Grade 7 shows only Overview / Travel / Documents. Counts sit in a pill on each
tab. Keep this — declaring the tabs statically would put empty shelves in front of parents
while the school is still filling the sheet.

Proper `tablist` semantics: `aria-selected`, `aria-controls`, roving `tabIndex`, and Left/Right
moving both selection and focus. The bar scrolls sideways on mobile rather than wrapping, and
the panel fade respects `prefers-reduced-motion`. Photo tiles are `aspect-ratio: 4/3` with a
hover lift; videos get a round play badge instead of a broken `<img>`.

## Design system
Carried over from the prototype, now in `src/styles/tokens.css`.
```
--bg #FCF8ED  --ink #22303F  --muted #767066  --card #FFFFFF  --line #ECE6D6
```
Baloo 2 display / Inter body. Radii 26/22/18/14/11/20px. Section badges are coloured per
key in `Section.jsx`'s `SECTION_COLOR`. Grade colours and icons live on `GRADES` in
`lib/grades.js` — **icons are now a property of each grade, not positional** as they were
in the prototype, so reordering grades no longer reshuffles them.
Sole breakpoint `max-width:720px`. Light theme only.

## Verified working
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

Three named staff were designated on 2026-08-12 (one `@protego.services`, one
`@fountainheadschools.org`, one `@fsksurat.in`). **The addresses themselves are written only
into the gitignored `.env` and must be set by hand in Netlify's environment** — this repo is
public, so they are deliberately absent from every committed file, including this one. Matching
is case-insensitive; `Vardan.Kabra@…` was verified to work.

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
- **This directory is not a git repository.** Nothing deleted here is recoverable, so confirm
  before removing anything not regenerable by a script or a build.
- Two exports have no external caller and are kept on purpose: `matchFolderFiles`
  (exported so folder matching can be checked without a network call) and `GRADES` (the
  canonical domain list `gradeById` reads). Do not "clean" either away.
- Keep the codebase comment-light: comments explain *why* (a tolerance, a caveat), never
  what the line does.
- `legacy/trip-explorer.html` is frozen reference. Do not edit it.

## Changelog
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
