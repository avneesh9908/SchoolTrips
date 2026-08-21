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
- **From Grade 7, the student's own address works too** (2026-08-17, the school's rule:
  "grade 6 only access through the parent id, after grade 6 both parent and student access his
  and her email id"). `StudentEmailID` is collected into its own `studentEmails` field —
  **never pooled into `emails`**, because the two carry different rights — and
  `allowsStudentLogin(grade)` gates it at `STUDENT_LOGIN_FROM_GRADE = 7`. A student sees exactly
  what their parent would; the credential decides who is holding the account, not what the
  account may see.
- **`matchStudent(student, {kind, value})` in `lib/identity.js` is the ONE place that rule
  lives**, and all three resolving paths call it: the server function, `sheetsAdapter.lookup`'s
  no-server fallback and `AuthContext`'s last-resort filter. Each of those used to carry its own
  `s.emails.includes(value)` line; three copies of an access rule is how one of them ends up
  wrong. It returns `'parent'`, `'student'` or `''`, and a parent contact wins even where it
  equals the student's own, so a shared family address never loses a junior grade.
- **`allowsStudentLogin` is NOT `isComingSoon`**, though both hold the same eight grades today.
  Coming-soon is about content that is not published yet and shrinks when the sheet's junior
  worksheet is read; this is about who may sign in. `gradeNumber()` returns -1 for a grade that
  could not be read, so an unreadable row fails closed.
- **A refused junior student gets the same reply as an unknown address**, deliberately: a
  distinct "you are too young" would confirm to anyone typing addresses that this one is on the
  school's roll. The rule is stated on the login screen instead (`.field-note`), where saying it
  costs nothing, and the failure message repeats it unconditionally — safe precisely because it
  is said whatever the reason for the failure was.
- **The login copy is the school's own wording — do not reword it.** Current text, rewritten by them
  on 2026-08-19: "Parents should sign in using the school's email address or mobile number registered
  with the school. You will only have access to the trip details relevant to your child's grade",
  then two lines, "**EY to Grade 6:** Parent login is required using school's email id or registered
  mobile number" and "**Grade 7 onwards:** Students may sign in using their school email address, and
  parents may also sign in using their school's email address or registered mobile number".
  **"email id" is the school's phrase and stays**, as does the repetition of "school" in the first
  sentence. The only editorial liberty taken is a **terminal full stop on each of the three**, which
  their draft omitted — punctuation, not rewording, and easily reverted if they object.
  The privacy promise came back here after a single pass without it: it was a standalone `.lede`
  paragraph, was **deleted at their request**, and returned an hour later as the second sentence of
  the instruction panel. It belongs inside the panel, not above it.
  **Both panels sit ABOVE the field**, settled 2026-08-19 after the school drew the layout it wanted:
  `.field-lede` (what to type) → `.field-note` (who may type it) → the label and input → Continue.
  The reader finishes the whole instruction before reaching the box, rather than typing and then
  finding a rule under their hands, and the two panels stay adjacent, which is what lets them read as
  one instruction. **They share one panel style** — `.field-lede, .field-note` is a single CSS rule
  carrying the tint, border, radius, 12.5px size and 1.55 leading, and only the outer margins differ
  (14px between the panels, 18px before the label: the bigger gap separates the instruction from the
  thing it is about). **Change the two together** or the pair stops looking like a pair.

  **Each rule is one left-aligned paragraph with a HANGING dash** — `.field-note > li` is
  `position: relative` with `padding-left: 16px` and the dash absolutely placed in that gutter. It
  was briefly a flex row with the dash as a flex item, which silently made the bold label and the
  sentence after it **two flex columns**: "Grade 7 onwards:" is wide enough to wrap on its own, so
  each item's body text started at a different x and the panel read as a ragged two-column table.
  The school sent a screenshot of exactly that (*"text align left side"*). Inline flow fixes it —
  measured, every line box in the panel starts at one x (778 at 1280 wide, 84 at 375) with the dash
  hanging 16px left of it. **Do not put `display: flex` back on the `li`.** It also came out shorter:
  the panel went 128px → 109px, which handed ~19px back to the height budget below.

  Two earlier attempts were corrected on the way, and neither reasoning survived contact with the
  school: the sentence began as the card's top `.lede` (moved down, because a paragraph before the
  box describes something the reader has not seen yet); then it was plain text with the rules in a
  tinted panel below the field (matched and moved up — *"keep text one side upper and lower to text
  field"*, then the drawn layout). The card's `.lede` briefly kept the privacy promise on its
  own ("You will only see the trip details for your own child's grade"), which is what the moved
  sentence used to share it with — **removed 2026-08-19** on the school's instruction, so the heading
  now runs straight into the instruction panel and `.auth-card h2` carries the whole 22px gap. `.lede`
  itself lives on for `.dash-head` on the picker; only the login one and its `max-height` trim went.
  **"EY"** is the school's
  name for the two kindergarten years, which `gradeNumber` scores 0 and the rule therefore treats
  as parent-only, so the copy and the code agree without a special case.

  **The card is height-budgeted at 1280x720 and `@media (max-height: 820px)` is what pays for it** —
  it trims chrome (`.login-form` and `.auth-card` padding, the `.lede`, `.field-lede` and
  `.field-note` margins), never the school's words, which are verbatim. The copy first cost ~130px
  and pushed the card 5px past the window; giving `.field-lede` the panel added ~24px more of padding
  and border and took it 38px past; stacking both panels above the field cost a little more again.
  Four trims pay for all of it (the `.auth-card .lede` one went with the paragraph). **Every copy
  revision has to be re-measured here** — this is not theoretical: the 2026-08-19 rewrite added a
  sentence to the first panel and a clause to each rule, ate the ~45px the previous two passes had
  freed, and went 8px past the window. `.login-form` 24→20 and `.auth-card` 26→22 bought 12px back:
  card **38-710 in a 720 window, `scrollHeight === innerHeight`**, ~10px of slack. Padding is the
  only lever left before the card's width or the art panel has to give.
- The session records `signedInAs` (`parent` | `student`), which is what puts "Student account"
  and "My trip" in the top bar instead of "Parent account" and "My child". It is a label, not a
  permission.
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
- **The travel cell opens with a bare "Batch 1" line, and `dropBatchHeading` drops it.** The card
  already shows the batch as a pill directly above, so it printed twice — "Batch 1" under
  "Batch 1". The PILL is what survives, because `batchLabels` corrects it by position when the
  sheet repeats a name (both g7 rows still say "Batch 1") while raw prose cannot be corrected;
  keeping the prose would have put "Batch 1" on the Batch 2 card. Only a line matching
  `/^batch\s*\d+\s*:?$/i` goes — "Batch 1 - 12 Dec" keeps its detail.
- Verified against a CSV transcribed from the real sheet: G7 → title, both batch date lines,
  full starting text, both travel blocks with line breaks intact.
- **`Student List (link)` — column 8 of the live sheet, right after Itinerary.** Read via
  `BATCH_LINK_COLUMNS` (added 2026-08-19) with aliases `studentlistlink`, `studentlist`,
  `studentslist`, `studentslistlink`, `studentnamelist`, `namelist`; `normalize.js` strips case,
  spaces and punctuation, so any of those spellings works. A **batch** column, not a common one — a
  list is exactly a batch's travelling group, and reading it across the grade would show both lists
  on both cards. **Confirmed live the same day**: only Grade 7 has it filled, as a smart chip reading
  "G7 students list (students/ parents) 2026-27", and the workbook export resolves the two rows to
  DIFFERENT tabs of one spreadsheet (`…1TCm_Iadn…/edit?gid=0` for Batch 1, `gid=1780253530` for
  Batch 2) — so the per-batch scoping is right and matters. Every other grade's cell is empty, so
  their tab is correctly absent.
- The live sheet also gained **`Grade Photo`** and **`Hero Section Photo`** columns (seen
  2026-08-19, 15 columns now). Nothing reads them yet — photographs still come from `config.json`'s
  `tripPhotos` / `tripCardPhotos`. Worth asking the school whether those columns are meant to
  replace that configuration.

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

### FIVE layouts now, behind one switch — `src/lib/layout.js`
`TRIP_LAYOUT` picks one and each costs a line to restore. It lives in its own module because `App` and
`TripPage` both read it and putting it in either makes them import each other. **Currently `'stage'`, and
pushed live** — `489271b` on `main`, 2026-08-17, which Netlify auto-deployed.

All five were asked for on **2026-08-17**, and the school went tabs → one page → tabs → one page → tabs
again in a single day. Nothing here is settled; do not delete a variant to tidy up.

| value | asked as | shape |
|---|---|---|
| `'stage-tabs'` | *"now first convert this tabs wise"* (**current**) | tabs, page scrolls |
| `'stage'` | *"remove tabs like different page make single page with header"* | ONE page, jump nav |
| `'stage-fit'` | *"cover whole page, fit on screen"* | tabs, nothing scrolls |
| `'flow'` | *"all things in one page make webpage scrollable with header"* | one page, older styling |
| `'fixed'` | 2026-08-14 *"I don't want scrollbar anywhere"* | underline tabs, nothing scrolls |

`App.jsx` holds two tables: `APP_CLASS` maps the value to a route class (`is-stage is-scroll`,
`is-stage is-fit`, `is-fixed`, or nothing for `'flow'`), and `NO_FOOTER` lists the layouts that drop the
site footer — the three that fit a tab to the window. The one-page layouts keep it.

**`TripBody` must dispatch on every value**; it checked only `'stage'` at one point and `'stage-fit'`
silently fell through to the old underline-tab markup. `'flow'` is superseded by `'stage'` — same shape,
pre-Fraunces design — and is kept only because it is what the school was shown that morning.

### The STAGE — the current trip page (2026-08-17)
The design the three `stage*` values share. What differs between them is only how the sections are
presented: `'stage'` puts them all on one page, `'stage-tabs'` and `'stage-fit'` show one at a time, and
`.app` carries `is-scroll` or `is-fit` to say whether the page may grow. Read this section for the design
and the subsections below for the three shapes.

- **One centred axis.** `--stage-w: 1400px` centred in the window — the only part of the app that is
  not full width, because a centred axis is the point and two decks abreast across 1900px stop reading
  as one page. Heads, rows, cards and card contents all centre on it. **Multi-line guidance stays
  left-aligned inside its card** (`.chip-lines > li`, `.rule-card`, `.carry-list > li`): a wrapped
  sentence is read from a straight left edge, and those lists are the one thing here a parent has to
  read rather than look at.
- **The strip is a centred segmented control** (`.stage-nav` / `.stage-tab`) — a white pill bar floating
  under the header, not the left-aligned underline row. In the tabbed variants it is a real
  `role=tablist` with roving `tabIndex` and Arrow/Home/End (`tabKeys()`, shared with `'fixed'`, and
  `revealTab()` still scrolls the strip and never the window); on the single page the same pills are
  anchors and the tablist roles are gone with the tabs.
- **Overview is a cover.** Whichever shape it is in, the block drops the width cap and the page gutter
  (`margin-inline: calc(-1 * var(--shell-pad))`) so the photograph reaches the window's edges, with the
  school's words centred on it and the meta line as glass pills. In the tabbed variants it fills the
  panel exactly (1907×730 at 1907×878); on the single page it takes 72dvh and lets the next heading peek.
- **The canvas** is two soft radial washes on the centre line over `--bg`; flat colour left the column
  floating on ~250px of nothing either side. Deliberately **not** `background-attachment: fixed` — the
  washes belong to the page, and fixed backgrounds repaint on every scroll frame and jump on iOS.
- Section heads are centred under a 44px amber rule, and every heading here is `--font-display`.
- Display headings size against **`vh` as well as `vw`** — `clamp(25px, min(2.5vw, 4.2vh), 38px)` — so
  a short window gets a smaller heading instead of a scrollbar.

**In the tabbed variants the section is centred with `margin-block: auto`, NOT
`justify-content: center`.** Auto margins give up their space when the free space is negative, so a
section taller than the space starts at its top and reads downwards; centring would have cut off both
ends with no way to reach either. The single page has no panel to centre in and does not use it.

#### The SINGLE PAGE — `'stage'`, the current default
*"remove tabs like different page make single page with header"*, 2026-08-17, and the fourth answer the
school has given to the same question in one day (tabs → one page → tabs → one page). Nothing was
deleted to build it: `TripStage` and its two variants are still there behind `TRIP_LAYOUT`.

`TripStagePage` renders **no tablist at all**. Overview is a full-bleed cover, every other section is
stacked beneath it in the centred column, and the pill bar is a **jump nav of real anchors**.

- **The cover takes 72dvh, not the whole screen.** Leaving ~100px of the next heading peeking is what
  tells a reader there is more page below; the tabbed version's complaint was that it looked finished at
  the fold. `flex: 0 0 auto` on the banner matters — with the basis at 0 it would take exactly
  `min-height` and clip its own text on a short window, where an `auto` basis makes the height the
  larger of the text and the screenful.
- **`width: auto` on the cover block, not the `width: 100%` the others carry.** With `width: 100%` the
  cover measured the column's 1205px and the negative margins merely slid it 30px left, leaving a strip
  of canvas down the right-hand edge. An auto width lets the flex stretch resolve to the container plus
  both margins.
- **The blocks carry the column cap themselves** (`max-width: var(--stage-w); margin-inline: auto`)
  rather than sharing a wrapper, which is what lets the cover opt out and reach the window's edges.
- **`scrollToBlock()` subtracts only the bars that will still be on screen**, read from their computed
  `position`. On a phone `.topbar` is `static` in this layout, so it scrolls away and must NOT be
  subtracted; on a desktop it is sticky and must be. The links keep their real `href`, so a pasted
  `#sec-travel` works and the hash stays shareable — `history.replaceState` keeps the address bar in
  step — and `scroll-margin-top` is set as an approximate fallback for that hash path only.
- **A section with no head of its own gets `.stage-block-title`** — Itinerary and Things to carry, which
  had been relying on the tab label to name them. It is styled to match `.is-stage .section h3` exactly,
  amber rule included, so the two kinds of heading cannot be told apart. The cover gets no heading at
  all: the picture is the heading. **Any new section that renders its own `Section` head needs
  `titled: true` in `buildSections`**, or its name prints twice.
- **No scroll-spy**, same as `TripFlow`: `useActiveSection` was deleted on 2026-08-13 and a listener
  repainting the nav every frame is not worth a highlight. The nav says where you can go, not where you
  are.
- **One nav serves every stage layout** — `StageNav`, which renders a row of pills on a wide window and
  a menu on a phone, in TAB mode when it is given `current` and JUMP mode when it is not. It was written
  for the one-page layout first and the tabbed renderer kept its own inline strip, so **the first time
  tabs came back the phone menu silently went with them** — the school's own complaint, reintroduced by
  a layout switch. Merging them is what makes the switch safe. The differences are only: buttons with
  the `tablist` roles, arrow keys and roving `tabIndex` versus real anchors (so a pasted `#sec-travel`
  still works); a trigger that names the CURRENT tab versus one that says "Sections"; and a marked
  selection in the menu, which only the tabbed modes have. The `tab` roles stay on the strip alone, so
  the two shapes never both claim to be the tablist.
- **On a phone the strip becomes a MENU** (2026-08-17: "in phone view tabs like menu make
  responsive"). At 375px the pill strip held **652px of sections in 373px of window**, so four of the six
  sat off the right edge behind a scroller whose scrollbar is hidden — nothing on screen said they were
  there. Below 720px a "Sections" button opens a card of full-width rows instead; Escape, a tap outside
  and picking an item all close it, and the listeners exist only while it is open.
  **Both shapes are rendered and CSS picks one** — a JS breakpoint would need a resize listener and would
  render the wrong one on first paint. The 720px switch is where the strip stops fitting: measured 652px
  against 661px of available width at 721px, and 373px at 375px.
  In the tabbed modes the trigger shows the section you are on and the open list marks it, because there
  one section is showing and the reader needs to know which.
- The **site footer comes back** here (and in `'flow'`): the page is long already, so the footer is how
  it ends rather than 117px that costs a tab its fit.
- **Density, after the school photographed the empty half of it** ("this is like take more space",
  2026-08-17): block padding 40 → 28 (22 on a phone), section gap 24 → 16, the heading's amber rule 14 →
  10, the travel card's padding 30 → 22/24, and the orientation groups put side by side. The page went
  **4110 → 3734px** at 1440×900 with nothing removed from it. If it ever needs to be denser again, the
  next thing to look at is the per-block heading — eyebrow, serif title and rule cost ~90px each — not
  the content.

Measured, Grade 7, parent: **1907×878** page 4128px, cover 1892×644 with a 98px peek, blocks centred at
x=246 w=1400, decks 661×372 / 661×372 / 1370×771 all ar 1.778; **1440×900** page 4110px, decks 644×362 /
1335×751; **1280×720** page 3813px, cover 1265×530, decks 564×317 / 1175×661; **1280×620** page 3704px,
cover 446px with the banner text 372px inside it; **375×812** page 3998px, cover 375×595, top bar static
at 165px and the nav pinned at 0. Every jump lands its block flush under the bars (`blockTop ===
navBottom`) except the last, which the end of the document clamps — as it should. Zero horizontal
overflow and nothing painted below `documentElement.scrollHeight` at any size, no internal scrollers
left anywhere, console clean, and all five `TRIP_LAYOUT` values build and render.

#### `.is-scroll` — the page may scroll (`'stage'` and `'stage-tabs'`)
- **`scrollToPanel()` in `TripPage` puts the top of the panel just under the two sticky bars on every
  tab switch.** This **reverses the 2026-08-13 rule** that a tab click must never move the page: that
  rule existed when the page was one long scroll with a spy on it, where a jump meant losing your place.
  Now each tab is its own screen, so landing at the top of it is the point.
- **Both bars are measured, never read from `--header-h`.** The token says 66 while the bar's own rect is
  67 — a pixel — but on a phone the bar wraps to three rows and stands at **165px**, and subtracting 66
  there would scroll the first heading up underneath it. `.topbar` is sticky at `top: 0`, so its rect
  height is right wherever the page is.
- **One screenful, with no arithmetic.** `calc(100dvh - var(--header-h) - <nav>)` needs the nav height as
  a token, and the nav measures **69px** against the 68 its padding implies — two sub-pixel px, enough to
  put a scrollbar on Overview. Instead `.app` is `min-height: 100dvh` and `.stage` is `flex: 1 1 auto`,
  so the panel takes exactly what the two bars leave. That token was written and then deleted; do not
  reintroduce it.
- **`min-height: 0` must NOT be in the chain here**, and that is the one rule most likely to be
  reintroduced by copying from `.is-fit`. A flex item with a zero basis and `min-height: 0` settles at its
  container's height while its content paints outside it — so the page never grows and the overflow is
  unreachable. It is the 2026-08-14 silent-content-loss trap, one layer up. `.page`, `.shell`, `.stage`,
  the cover section and `.home-banner` all keep `min-height: auto` in this variant.
- **On a phone the sticky pair is undone**: `.topbar` goes `static` and the tab bar pins at `top: 0`.
  `.stage-nav` sticks at `var(--header-h)`, a desktop measurement, so on mobile it would pin itself
  *underneath* the 165px bar and vanish — and the mobile bar's height depends on how long the parent's
  name is, so it cannot be a token either. Letting the header scroll away and keeping the tab bar is also
  the better phone pattern.
- **Nothing inside a card scrolls any more.** Every rule that gave a list, a rule stack, a poster
  thumbnail or a slide frame its height from a definite-height panel is handed back its natural height —
  the same list `.is-flow` restores, for the same reason. Consequence: the **decks are bigger** than in
  the fitted variant, because they are width-driven (1280×720: 564×317 and 1175×661 against 452×254 and
  804×452), and Things to carry costs a ~210px scroll for it.
- The site footer stays off (see `App.jsx`): every tab is at least a screenful, so the footer alone would
  put a scrollbar on tabs that otherwise end exactly at the fold.

#### `.is-fit` — the same stage locked to one screen
`100dvh`, `overflow: hidden`, `min-height: 0` down the whole chain, the panel as the only scroller, and
a long guideline list scrolling inside its own card. `is-stretch` sections take `min-height: 100%` here
because the cards and frames inside them are sized from a definite height.

**Four sizing traps, all found by measurement, all worth remembering:**
- **`aspect-ratio` does not feed a clamp back into the other axis.** Neither `height: 100%; width: auto`
  nor `width: 100%; max-height: 100%` fits a 16:9 frame into a box bounded on both sides — whichever
  axis is specified wins and the `max-*` on the other just distorts the result. In the narrower centred
  column the width clamp bound first and the decks came out **ar 1.499**. The fix is to ask the
  container how tall it is: `container-type: size` on `.chip-slides` and
  `width: min(100%, calc(100cqh * 16 / 9))` on the frame, which is a definite width the ratio can work
  from and cannot overflow either axis. Exact 1.778 at every viewport since. **`.is-fit` only** —
  `.is-scroll` has no definite height to ask about and goes width-driven.
- **…and that container query must be switched OFF below 980px.** `container-type: size` carries size
  containment, so the container's height may not come from its contents — once the cards stack and
  `.chip-slides` is `flex: 0 0 auto` there is nothing else for the height to be, `100cqh` reads 0, and
  every deck measured **2×2px**. `container-type: normal` + width-driven frames in the ≤980px block.
- **An auto inline margin on a flex item overrides the container's stretch.** `.carry-card` fell back
  to its fit-content width and took the deck down with it (**168×94**). `width: 100%` is what makes
  `max-width` + auto margins centre a box instead of shrinking it.
- **`auto-fit` counts tracks from the track's MAX size.** `minmax(min(340px,100%), 720px)` made exactly
  **one** 720px track in a 1220px row, so staff's two travel cards stacked and the panel scrolled. Keep
  the max at `1fr` (count comes from the 340px minimum) and cap the *card*.

**The 1600px two-track rule for `.chip-lines` is disabled on the stage.** That breakpoint keys off the
*window's* width, which no longer tells you the card's: at 1907px it fires while the stage holds Safety
to ~690px, and two tracks of ~330px wrap every sentence. One track. `.carry-list` keeps its two tracks —
that card is capped at 1080px, so the window is a fair proxy for it.

**Screenshots still do not work here, so the Overview scrim was verified by compositing it over the
photograph's own pixels in a canvas and computing WCAG ratios.** Centring the text moved it into the
lightest part of the old bottom-weighted gradient: white on it measured **2.96:1 for the title** (needs
3:1) and **4.00:1 for the body** (needs 4.5:1) at 1280×720. A radial layer over the middle plus a
text-shadow takes it to 3.49 / 8.94 / 5.13, and 3.95 / 5.46 / 5.53 at 1907×878, with the corners left
alone so the picture is still a picture. **Re-run that measurement if the scrim or the photograph
changes** — `getImageData` on a same-origin photo, composite the gradient stops by hand, worst sample
under each text block.

**Measured — `.is-scroll`**, Grade 7, parent and staff, with the decks and with the text fallback. In
every case nothing was painted below `documentElement.scrollHeight` (the check that content is reachable
rather than lost), no horizontal overflow, and no internal scroller left anywhere. Tabs other than the
ones named end exactly at the fold:
**1907×878** — only Things to carry scrolls, by 162px (deck 1370×771); Overview exactly 878.
**1280×720** — Itinerary 64px, Things to carry 210px; decks 564×317 and 1175×661, all ar 1.778.
**1280×620** — Itinerary 123px, Things to carry 281px, nav 56px, Overview exactly 620 with the banner
text inside it. **375×812** — top bar static at 165px and the tab bar pinned at 0 once scrolled;
Itinerary 495px, Orientation 168px, Travel 209px, frames 309×174, `scrollWidth === 375`.
**Text fallback** (`slidePreviews` temporarily cleared, then restored): Safety's **11 measures run down
the page in one 645px card with no internal scroller** at 1280×720 and the 11th is fully visible at the
foot of the page — which is the whole point of this variant. A tab switch from the bottom of a long tab
asks for exactly the panel's top and lands it flush under the bars (`stage.top === nav.bottom`,
`nav.top === header.bottom`).

**Measured — `.is-fit`**, same page, zero clipped elements and zero window scroll everywhere:
**1907×878** all six tabs with no panel scroll at all, decks 661×372 and 1084×610, photo 1907×731;
**1440×900** 651×366 / 1124×632; **1280×720** 452×254 / 804×452; **1280×620** 326×183 / 677×381;
**375×812** frames 309×174, panels scrolling internally with the last card reachable.

Common to both: Grade 8 (no photograph, no decks, five tabs) fits at 1440×900 on the navy gradient;
`/trip/g3` → centred "Coming soon" with **0 fetches**; `/trip/g5` as a Grade 7 parent → centred "Not
your child's grade", **0 fetches**; `/children` still scrolls and keeps its footer.

### The one-page FLOW layout (`'flow'`)
Every section stacked in `.sections.is-flow`, each in a `.flow-block` with a serif heading,
the window scrolling, `is-fixed` off so the **site footer comes back**, and the tab strip demoted to a
**jump nav of anchor links** — with all the content present there is nothing to switch between, only
somewhere to go. Deliberately **no scroll-spy**: `useActiveSection` was deleted on 2026-08-13 and this
does not bring it back; a real anchor gets a reader there without a listener firing every frame.

The one thing that needs undoing per-element: everything in the fixed view sizes itself from a panel
with a **definite height** — `.chip-row`, `.chip-lines`, `.rule-stack`, `.chip-docs`, the slide frames'
height-driven 16:9, the poster thumbnail, `.home-banner`'s `flex: 1`. On a scrolling page there is no
such height and left alone **they collapse to nothing**. `.is-flow` gives each of them its natural
height back — the same rules the ≤980px breakpoint already applies, for exactly the same reason.
`scroll-margin-top: calc(var(--header-h) + 58px)` on `.flow-block` is what stops the sticky header and
nav from covering a heading a reader just jumped to.

**Two things the first cut of it got wrong, fixed the same day:**
- **Every headed section printed its heading twice.** `OrientationSection`, `TravelSection`,
  `PhotosSection` and `RemindersSection` each render a `Section` head of their own, so a `.flow-title`
  above them read "Orientation / Before the trip / Orientation". Those four now carry `titled: true` in
  `buildSections` and `TripFlow` skips the label for them — **add the flag to any new section that
  renders its own head.**
- **Spacing.** 46px gap plus 40px block padding put 86px between sections; on a 900px window a third of
  the screen could be the gap between two of them. It is 32 + 32 now. And `.flow-title` was the display
  serif while `.section h3` is sans — two heading styles in one column made one page look like two, so
  it matches `.section h3` exactly (30px/700/-0.02em).

Measured at 1280×720, Grade 7, staff: page 4011px over a 720px window, six blocks (Overview 473,
Itinerary 695, Things to carry 847, Orientation 525, Travel 465, Photos 351), all three slide frames
exactly **ar 1.778**, no column clipping (`hidden=0` everywhere), zero horizontal overflow, footer
present, "Travel" jump landing its title at y=169 clear of the nav's 113 bottom. At 375×812:
`scrollWidth === 375`, frames 307×173 at 1.778, clean console. The only elements past the viewport are
the last two jump links inside `.secnav-inner`, which is a horizontal scroller by design.

### The trip page is a FIXED-HEIGHT view — the window never scrolls (the `'fixed'` layout)
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

### The Overview paragraph is justified — but only where the measure can take it
Asked for on 2026-08-19 (*"text align starting and ending point same line make same"*): the school
wanted the body text's line starts and line ends on the same two verticals, which is justification.
`.home-body-text` carries `text-align: justify`, and `.is-stage` adds `text-align-last: center` so the
final line of each paragraph — which has nothing to stretch against — is centred under the centred
lead. Because `white-space: pre-wrap` preserves the sheet's blank line, the line before it counts as a
last line as well, which is what keeps the two paragraphs reading as two.

**Below 720px it reverts to left-aligned, and that is not a matter of taste — it was measured.**
Word gaps in that paragraph, against a natural space of 2.7px: at 375x812 justification needed a
median of 13.5px and up to 17.9px (5x and 6.6x, visible rivers); at 1280x720 it needs 4.6px median
and 9.5px worst (1.7x). A phone gives the paragraph a ~339px measure with too few word gaps to
absorb the slack. The left edge is the half worth keeping there. If a future pass widens the phone
measure or drops the font, re-measure before putting justification back — the gap numbers above are
the test, not the appearance of the CSS.

`heroBatch` / `heroDates` survive as the Overview image's meta line. `heroBatch` said `Batch 1` only
when `trip.batchMatched`; otherwise "All N batches", because naming one batch would be wrong when
every batch is shown. **Both are historical** — the meta line left Overview in the 2026-08-18
redesign (photograph, then batch cards, then Header Text), and since 2026-08-19 every batch is shown
to everyone, so there is no one-batch case left to name. `heroDates` strips the `Batch N:` prefix from **both** the matched and the
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

### Photos come from Drive, not from the host (2026-08-18)
`tripPhoto.js` now runs every configured URL through a private `imageUrl(url, width)` before
returning it. It reuses `describeDoc()` for id extraction — one regex set for Drive links in this
codebase, not two — and rewrites any Drive link to `drive.google.com/thumbnail?id={id}&sz=w{width}`:
**1600 for the banner, 1200 for the picker card**, because that card is a 132px strip and the wider
fetch would be bytes no parent ever sees. Anything that is not a Drive link (`/trip-photos/*`, a CDN
URL) is returned untouched, so the committed local entries still render byte-identically.

Two reasons, and the billing one is the load-bearing one:

- **Netlify moved to credit billing and bandwidth is the expensive meter** — 20 credits/GB against
  2 credits per 10,000 requests, so the free plan's 300 credits is really a **~15 GB/month** budget,
  not the "1.5M requests" a request-only reading suggests. Trip galleries served from the origin
  would eat a month's budget in one trip; served from Drive they cost this site nothing.
- **The school pastes what Drive's Share button gives them.** A share link is an HTML page, not an
  image — dropping it straight into `src` shows a broken icon. Expecting staff to hand-build a
  `thumbnail?id=` URL is how the photograph silently stops appearing six months from now.

The file must be shared **Anyone with the link · Viewer**. Anything else returns a sign-in page
instead of image bytes — the same failure the document cards have always had. Both consumers already
handle it: `HomeSection` holds a `broken` flag and drops the band on `onError`, and `tripCardPhotoFor`
falls back to the grade colour and icon, so a wrongly-shared photo reads as *no* photo rather than a
broken one. Check by opening the link in a private window.

**Consequence for the scrim measurement below:** a Drive-hosted photo is cross-origin, so `getImageData`
taints the canvas and the WCAG contrast check **cannot be re-run the way it was**. To re-measure after
a photo change, point `tripPhotos` at a local copy in `public/trip-photos/` temporarily, measure, then
switch the entry back to the Drive link.

Verified 2026-08-18: build clean, no console errors, and the transform checked over six URL shapes —
`/file/d/ID/view`, `open?id=`, an already-thumbnail URL (re-sized, not double-wrapped), a local path,
a foreign CDN URL, and a folder link (passed through, since a folder has no single image).

### Never pause an entrance before the observer has answered (2026-08-20)
The collage's five motion pieces are the entrance, the pointer tilt, the pointer **glare**, the hover
lift and an **ambient drift**; the entrance is now revealed **on scroll** rather than at load. That
last one carries a trap worth more than the feature.

`js-reveal` on `.photo-collage` is what pauses the entrance, and a paused entrance holds its `from`
keyframe — **opacity 0**. So the class must be added from **inside the observer's first callback**,
never at mount: the steps that deliver an `IntersectionObserver` callback only run for a document that
is being *rendered*, so a page loaded in a background tab observes and hears nothing back. Add the
class up front and such a page hides the entire collage for ever. Added on arrival, the worst case
inverts to "every tile just animates at load", which is what the page did before the feature existed.
The class goes on and the on-screen tiles are released in the *same* callback, so nothing paints in
between and there is no flash. `useScrollReveal` in `TripPage.jsx` holds this, with the `armed` flag.

**This was observed, not theorised**: in the Browser pane `document.hidden` is permanently `true`, and
at load the callback never arrived — all 24 demo tiles sat at opacity 0. A hand-built observer probe
in the same pane returned `fired: true` with `intersectionRatio: 1`, which is what separated "the
environment does not deliver callbacks yet" from "the selector is wrong".

**A filling animation overrides the element's own `transform`, and that silently killed the tilt for
six days.** `collage-rise` was written `... both`, so the FINISHED entrance kept its `to` keyframe
(`rotateX(0) translateZ(0)`) applied for ever — and a CSS animation outranks a normal declaration, so
from 0.55s onward `.photo-item`'s own `transform: ... rotateX(var(--tilt-x)) ...` and the hover
`translateZ(38px)` both computed to the identity matrix. The cursor tilt asked for on 2026-08-20 had
never actually moved a tile in a real browser after the first half-second. **`backwards` is the fix**:
it fills the stagger delay, which is all that is needed to hold a tile invisible before its turn, and
then releases the element — `getAnimations()` empties and the declarations take over.

**The verification lesson is the sharper one.** The original pass verified the tilt by reading
`--tilt-x` / `--tilt-y` back off the element, and they were perfect: ±6.30deg at the corners, 0 at the
centre. **A custom property proves the handler ran, not that anything moved.** Read the computed
`transform` matrix, on a tile whose entrance has been driven to completion with
`getAnimations().forEach(a => a.finish())`. With `both` a hovered tile reading `--tilt-x: 5.42deg`
computed to identity, and cancelling the animation produced the rotation plus a 37.72px Z lift — the
same matrix `backwards` now gives without cancelling anything.

Two smaller rules from the same pass:
- **The glare and the tilt share one `getBoundingClientRect`.** `--mx` / `--my` (percentages) come off
  the same pointer measurement as `--tilt-x` / `--tilt-y` (degrees), in one handler. Chrome elides
  `at 50% 50%` when serialising a centred `radial-gradient`, so a computed-style check reads
  `radial-gradient(220px, rgba(...` and looks as though the position were dropped — set the property
  off-centre before believing it.
- **The ambient drift is on the LEAD TILE ONLY, and it animates `scale`/`translate`, not `transform`.**
  Only-the-lead because it is the one animation that runs forever and thirty composited layers would
  cost a phone battery for an effect nobody is watching — the same reasoning that keeps `will-change`
  off every tile. The longhands because an animation on `transform` beats the hover
  `transform: scale(1.06)` on the same element outright; as separate properties the two compose.

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

### The grade card carries the photograph and names the trip (2026-08-17)
The picker's card head was a block of grade colour with an icon and no words, while the trip's name sat
in the body. The school asked for the head to carry the picture and to say what it is: "show here
comming soon or trip name".

- `.pick-media` takes a photograph from **`config.tripCardPhotos`**, a second map beside `tripPhotos`
  and keyed the same way. It exists because the card head is a wide ~2.6:1 strip 132px tall while the
  trip page's banner fills the window, so one file rarely crops well in both; `tripCardPhotoFor()`
  falls back to `tripPhotos` when a grade has no card entry, and to the colour-plus-icon when it has
  neither. **No photograph is invented** — that rule is unchanged.
- The icon is **dropped** where a photograph exists rather than laid over it; it is the placeholder,
  not a decoration.
- `.pick-label` prints the destination, or **"Coming soon"** for a grade with no published trip, over
  a strengthened bottom scrim. It is absolutely positioned so the card's height does not depend on
  whether the trip name has arrived from the sheet — the same reason `tripLine` returns an em space
  rather than "Loading…". Verified: all 14 cards 260–261px regardless.
- The body's duplicate trip line was **removed**. A grade with no trip previously said it three times
  (head, body, pill); it now says it twice, on the picture and on the pill.
- A coming-soon grade gets **no photograph**, whatever config says: the picture is of the trip, and
  there is nothing to picture until one is announced.

Grade 7's card photo is `public/trip-photos/g7-card.jpg` — the group shot at the Jaipur gate, supplied
2026-08-17, resized 3248×1432 → **1400×617 and 1.7MB → 226KB** with Pillow before committing. Resize
what the school sends; a 3248px file for a 345px slot is most of a parent's page weight on mobile.

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
**`batchTag` renders INSIDE the label's text flow, and must stay there.** It began as
`position: absolute; top: 18px; right: 18px`, which was fine over an icon tile but printed "B1" across
the top-right of the live deck frame once Orientation became previews — the school caught it on
2026-08-19 ("dont b1 and b2 show in pdf ... [B1] Students Orientation details show like this"). Two
things were tried: a flex sibling beside the label, which took ~42px off the label's column on EVERY
line and made "Parents Orientation details" wrap to three lines in one card and two in its neighbour
off a 2px difference; then the chip as the first inline element inside `.doc-label` itself, which is
what shipped. Inline, only the first line pays for the chip and the label keeps its full width back
(207px and 2 lines in all four cards, against 164/166px and 2-vs-3 lines as a sibling). Cards with no
`batchTag` — Itinerary, Photos, the guideline chips — render the bare label unchanged.

### Student list — a tab, and a deliberate exception to the no-roster rule
Added 2026-08-19 after Itinerary, at the school's placement. It reuses `ItineraryCards` with
`kind`/`action` overridden ("Student list" / "Open the student list"), because it is the same
shape of thing: one link per batch, where the batch's dates and sections are what tell a reader
which list is theirs. Verified twice: first with a synthetic column in the
gitignored fixture (since restored), then **against the real live sheet**, where the two cards
resolved to the school's actual per-batch list URLs. Tab order Overview · Orientation · Itinerary ·
**Student list** · Travel details · Things to carry · Photos; Itinerary's own wording unaffected; and
with no column present the tab disappears entirely — no empty tab is published.

**This is the one place the parent side points at a class list, and it was flagged to the school as
such.** The standing rule below — no roster, no class list, the child's own name is the only personal
value on any screen — still governs everything the app RENDERS: the list itself lives in the school's
own Drive file, behind whatever sharing they set, and nothing about it is fetched or displayed here.
But the tab does hand a grade's parents a route to their batch's names, so the consent and sharing
decision is the school's and should not be quietly widened. Do not start rendering list CONTENT in
the page on the strength of this tab existing.

### The Itinerary links are FILLED CARDS with the batch's dates — and this took four attempts
`ItineraryCards` + `.itin-card`: a navy panel per batch carrying the `B1`/`B2` pill in `--amber`, the
batch's dates as a Fraunces heading, its section list, and one "Open the day-by-day plan ↗" line
pinned to the bottom with `margin-top: auto` so both cards' actions align whatever the section lists
do. `.itin-cards` is an `auto-fit` grid with a 20px gap, so it stacks on a phone.

**The whole history is one lesson: do not build this row out of anything Drive has to serve.**
1. `compact` DocCards — icon plus a line of text; the two batches were indistinguishable.
2. a live `/preview` iframe of the Doc — worked, but the school wanted it smaller and not a working
   document.
3. Drive's `thumbnail?id=…&sz=w1000` as a cover image — **it does not load.** First seen failing in
   the dev preview pane, which was written off as an environment block; then the school's own
   screenshot showed the same grey icon fallback in their browser. That endpoint serves only files
   shared "anyone with the link", and the itinerary Docs are not. The `cover` prop was removed from
   `DocCard` rather than kept: the code was never the problem.
4. content instead of a picture. `trip.batches` already carries the dates and section lists for the
   Overview tab, so the card is legible whatever Drive does and **nothing here can come back empty**.

Matched by batch LABEL, not index — `documentsFrom` and `batches` take their labels from the same
`batchLabels(all)` map, so "Batch 2" is the reliable join, and a doc whose batch has no row still
renders without dates. Measured 1280x720: two 589x175 cards, 20px gap, actions aligned at the same y,
**zero `<img>` and zero `<iframe>` in the row**; 1920x900 899x181; 375x812 stacked full-width, dates
clamping 27px → 20px.

**`--orient-ar` is the frame's aspect ratio as a NUMBER, and it exists because three formulas need
it**: the frame's `aspect-ratio`, the frame's width (`--orient-h * --orient-ar`) and the box's own
width (`... * 2 + gap + 148px`). It was a literal `16 / 9` in all three, which is three chances to
change two of them. `.doc-preview` and the card's flex basis read `var(--orient-ar, 1.7778)` so
previews outside an orient box keep 16:9 untouched. Only Orientation sets these variables now — the
itinerary's `.is-cover` variant went with the cover image — but the indirection stays: it is what made
the ratio changeable in one place instead of three.

`.itin-top` / `.itin-docs` were deleted with the markup they styled, and so were `.orient-box.is-cover`,
`itineraryLabel` and `stripBatchSuffix` when the cover image was abandoned — nothing in the JSX
referenced any of them. The batch is a pill (`.itin-card-tag`) again rather than the "B1- Itinerary"
label string of the pass before: that string existed only because a pill could not carry the hyphen
joining it to a one-word label, and the card's label is now the DATES, which the pill sits beside
rather than inside.

### Safety and Do's-and-don'ts: the font size in those columns is mostly NOT ours
The school asked to "increase font size" on both (2026-08-19). Worth knowing before promising it: on
Grade 7 each of those columns renders the school's **published slide deck in an iframe**
(`config.json` → `slidePreviews.g7.safety` / `.dodont`), so the words a parent actually reads are
pixels inside Google's document and **no CSS in this repo can resize them** — that is an edit to the
deck. What this stylesheet owns, and what was raised: `.chip-head h4` 15 → 19px, `.chip-count`
12 → 13px, and the `.chip-lines` text fallback 14 → 16px. The fallback is not a dead branch — several
grades' columns still hold TEXT rather than a deck in the live sheet, and those do get the larger
type. If the school means the words inside the deck, the answer is to edit the Slides file.

**The Orientation tab is the exception: its four card labels are FIXED COPY, not the file's name.**
The school gave them on 2026-08-19 as "B1- Parents Orientation details" / "B2- …" and the same for
Students, so `ORIENTATION_LABELS` maps the category to the words and the `batchTag` chip supplies the
`B1`. This reverses the 2026-08-17 rule for this section only — that rule preferred the sheet's own
chip name ("G7 B1 … Parent's Orientation") because it named grade, batch and destination; the school
would rather have four cards identical apart from their batch, and a file renamed in Drive must not
change what the page says. The section also has **no head at all** now (no "Before the trip", no
"Orientation"): the tab the reader pressed already says it. `titled: true` stays in `buildSections`
— it means "draws its own head, print nothing above it", and removing it would have the flow and
stage layouts put the heading straight back. The two group labels (`.orient-group > h4`) are styled as
**real section headings, matching `.section h3` exactly** — Fraunces at `--display-weight`, the same
height-aware `clamp(25px, min(2.5vw, 4.2vh), 38px)`, and a 44x3 `--amber` rule under them via
`::after` (on the heading itself, since unlike `.section-head` there is no inner div to hang it on).
The school asked for this against the "Orientation" head they were still seeing elsewhere ("show this
text bold font same in oritation", 2026-08-19); it replaced a 13px/800 uppercase caption, which was
itself an earlier attempt at "bold". Sentence case now, not tracked-out uppercase — a 30px serif is
not a caption. **Verified identical to a live `.section h3`** (Travel details): Fraunces / 600 /
30.24px / none / -0.3024px / `rgb(15,23,42)`, rule 44x3 `rgb(224,135,7)` at 10px. Keep them in step —
if `.section h3` changes, change this with it. Each group then got its **own box**, asked for
twice — "like minor border box to show difference", then "border and box more highlight show more
difference" (2026-08-19). It ended at `2px solid #b4bdda`, `--link-bg` fill, 18px radius, **18/20px
padding** and `--shadow-hero`, with 20px between the two batch cards and a 34px gap between the
groups.

**The heading sits OUTSIDE the box** (2026-08-19). `.orient-group` is now only the stack — `h4`, then
`.orient-box` 14px below it — and every border, fill, shadow and pad belongs to `.orient-box`; nothing
is drawn on `.orient-group` at all. Anything that used to target `.orient-group` for appearance has to
move to `.orient-box`, and the stage override `.is-stage .orient-group { gap }` is now the
heading-to-box gap, not a heading-to-cards gap.

**The box HUGS its cards and is centred**, `width: min(100%, calc(var(--orient-h) * 32 / 9 + 168px))`.
Full width it held 978px of cards in 1395px of inner space and ~208px sat empty inside each end, which
the school circled. Two things that do NOT fix that, both tried:
- `width: fit-content` — under fit-content sizing the browser takes a shrinkable flex item's
  MAX-CONTENT (here the label's width), not its `flex-basis`, so the cards resolved to 356px instead
  of 479 and the frames shrank 425 → 302px. The box hugged by shrinking the previews.
- widening the cards — `.doc-preview` is capped at `--orient-h * 16/9`, so a wider card just moves the
  empty space inside itself.

**Two variables drive the whole box, and both live on `.orient-box`** — not on the card, because the
box sizes itself from them and a custom property set on a child is invisible to its parent; the card
and the row inherit them.
- `--orient-h` — the frame's height budget, `clamp(140px, calc(100dvh - 560px), 270px)`.
- `--orient-gap` — the space between the two decks, `48px`, widened from 20 on 2026-08-19 ("maintian
  the gap in docs that side area cover") when the box was made bigger: the school wanted the extra
  width to go between the two documents, not back into the empty ends.

`width: min(100%, calc(var(--orient-h) * 32 / 9 + var(--orient-gap) + 148px))`, where 148 is 104px of
card padding (2 x 26 x 2) + 40px box padding + 4px border. **Keep the gap a variable**: `.orient-row`
reads `gap: var(--orient-gap, 20px)` and the width formula reads the same value, so a literal in one
place and a constant in the other cannot drift apart. The 20px fallback is for `.orient-row`s outside
a box — the itinerary's compact card sits in one — and was verified still applying there.

**The lesson, measured: in this kit a light fill cannot separate anything.** Every tint token lands
within ~1.05:1 of the page — `--wash` on `--bg` is 1.044:1 and a white card on `--wash` is 1.081:1 —
so the first two attempts (no fill, then `--wash` + a `--line-2` hairline at 1.07:1) were invisible at
arm's length whatever the token. A **line** can be much darker than a fill without shouting, so the
border does the work: #b4bdda reads **1.806:1 against the page**, and the fill stays only to give the
white deck cards a ground to sit on. Reach for border darkness before fill darkness on this palette.
Also: a `1.5px` border came back from `getComputedStyle` as `1px` — rounded away at DPR 1, which is
most of the school's desks — so widths here are whole pixels. **The two groups STACK, one boxed group per row** (2026-08-19, "box size increase"), reversing the
2026-08-17 side-by-side layout: four previews sharing one row left each frame width-bound by its card
at 209x117px, too small to read a slide. Full width each, the frames stopped being width-bound
by their card. That first overshot twice — 442x249 frames and 461px
boxes, then 567x319 on a 1859x895 screen, which the school photographed and called zoomed in — so
`--orient-h` settled at `clamp(140px, calc(100dvh - 560px), 240px)`.

**Which of the three numbers matters depends on the window, and this is the thing to know before
touching it.** At 1280x720 the *budget* binds (`720 - 560 = 160`), so the frame is 282x159 and the cap
is irrelevant. On a big screen the *cap* binds — at 1859x895 the budget would give 335px — so the cap
is the only number a large monitor ever sees, and it is what reads as "zoomed". Changing the cap
cannot affect a 720px-tall window; changing the subtrahend cannot affect a large one. Measured at the 270px cap
and a 48px doc gap: 1920x900 → box 1156px, frames 478x269, boxes 435px tall; 1280x720 → box 765px,
frames 282x159 (budget-bound, so the cap change does not reach it); 375x812 → box full-width 339px,
frame 241x136. Sides stay at 22px of padding at every size. The tab scrolls ~240-260px.

Margins around it, all set 2026-08-19 from the same screenshot ("not maintain margin in header and
heading boxes"): `.orient-groups` has `margin-top: 14px` so the first heading clears the sticky
section nav by **30px** rather than 16 — with the section's own head gone, that heading is the panel's
first line and had nothing holding it off the nav — and the heading-to-box gap is **14px** (base and
`.is-stage` alike, up from 10). **The original reason for side by
side has not gone away**: stacked, a grade with only ONE batch shows a single card with ~350px of
empty box beside it, which is the screenshot they sent on 2026-08-17. Grade 7 has two batches so its
rows are full; check a one-batch grade before treating this as settled.

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

## The TAB machinery — still here, but no longer what a parent sees
**Set 2026-08-13** ("after click on tabs any tab dont scroll, I want to switch on the tab look like
different pages") and true of the page until the tenth pass on 2026-08-17, when the school asked for the
tabs to come off ("remove tabs like different page make single page with header"). The default layout is
now one page with a jump nav; everything in this section still governs `'stage-tabs'`, `'stage-fit'` and
`'fixed'`, which are one line away, so none of it is dead.

**The "clicking a tab must never scroll the page" half of that rule was reversed on 2026-08-17**
("after the tab click switch scroll the web page"): on the `'stage'` layout a switch scrolls the window
to the top of the panel, `scrollToPanel()`. The rule still holds for `'stage-fit'` and `'fixed'`, which
cannot scroll the window at all — and the reasoning behind it is worth keeping, because it is what makes
the reversal safe rather than a regression: it was written when the page was one long scroll with a spy
on it, where a tab click that jumped meant losing your place. A tab that is its own screen has no place
to lose.

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

### The section list and its ORDER — `buildSections`
`buildSections(trip, photo, grade)` derives the list **from the data**, and it must stay that way. A
section with nothing behind it is never rendered, so a half-filled sheet reads as a finished page
rather than a row of empty shelves.

**It is also the single source of the ORDER** — the jump nav, the block order on the one-page layout and
the tab order in the tabbed ones all read this one array. To reorder the page, move a `push` in that
function and nothing else.

**The order, set by the school on 2026-08-17** ("first it should be overview Orientation Itinerary travel
details Things to carry photos") — the order a parent works through them, not the order the sheet's
columns sit in:

1. **Overview** · 2. **Orientation** · 3. **Itinerary** (Safety and Do's/Don'ts inside it) ·
4. **Travel details** · 5. **Things to carry** · 6. **Photos** · 7. Reminders

It replaced Overview · Itinerary · Things to carry · Orientation · Travel · Photos from 2026-08-14. Two
consequences that are deliberate, not leftovers: the three guideline decks are **no longer adjacent**
(Travel sits between Itinerary and Things to carry), and the `travel` section's label is now
**"Travel details"** to match the heading it renders — the short "Travel" said one thing in the nav and
another over the cards.

The 2026-08-14 grouping that got the list down from nine sections to four still stands:

The tab's **id is `home` but its label is "Overview"** — renamed 2026-08-14. Do not "tidy" the id to
match: `is-fill` and the fixed-layout CSS key off `#home`.

| Tab | Holds |
|---|---|
| **Overview** (id `home`) | the photograph and **nothing else**. Grade · Batch · Dates, the trip name, and the whole Header Text sit *on* the image. It never scrolls |
| **Itinerary** | the batch block and the itinerary chip **beside each other** (`.itin-top`), then **Safety and Do's and don'ts side by side** (see below). No section heading: the tab label already says "Itinerary", and the 86px it cost was the difference between fitting and scrolling |
| **Things to carry** | its own tab since 2026-08-17 — one 1080px card holding the packing checklist, two grid tracks on a wide window |
| **Orientation** | Parent Orientation and Student Orientation, one row each, the batches beside each other, **compact cards** |
| **Travel details** | a card per batch. Its own section again (it was briefly folded into Itinerary) |
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

### The guideline sections are LIVE Google Slides embeds — this is the current answer
Set 2026-08-17 and it supersedes both the poster-card and the printed-text paths for these three
sections. The school publishes Safety, Do's and don'ts and Things to carry as Slides decks and asked
for them **on the page, with no click**: "The Google Slides presentation must be embedded and visible
directly inside the existing webpage."

- `GoogleSlidesPreview` (`src/components/GoogleSlidesPreview.jsx`) frames the deck. `slidePreviews.js`
  resolves the URL and **rewrites `/pub` to `/embed`** — both are frameable (measured), but `/pub` is
  the standalone viewer with its own chrome and `/embed` is the same snapshot sized to its frame,
  which is the difference between "part of the page" and "a website inside a website". The document id
  and publish state are untouched, so **a staff edit in Slides appears on the next page load** with no
  image to replace and no deploy. That is the whole point — do not export these to PNG/JPG.
- **The three URLs were pasted one position ROTATED, and nothing in the code could tell** (found
  2026-08-17 from the school's screenshot): Safety framed the do-and-donts deck, Do's and don'ts framed
  things-to-carry, and Things to carry framed safety. A published deck's URL says nothing about its
  contents, so this is invisible until someone reads the page — or fetches the URL and looks at its
  `<title>`, which is the check to run whenever these are edited:
  `urllib.request` / `curl -s "<url>" | grep -o '<title>[^<]*'` returns `safety-guidelines-poster`,
  `do-and-donts`, `things-to-carry`. Verified after the fix by matching each card's iframe `src` against
  the config value **and** the title of the file behind it. The warning is repeated in `config.json`'s own
  `_slidePreviews` note, since that is where the next person will paste.
- **The URLs live in `config.slidePreviews`, keyed `"<gradeId>.<section>"` — FLAT, and it must stay
  flat.** `config.js`'s `merge()` walks one level into an object and calls `String()` on each value, so
  a nested `{g7: {safety: …}}` reaches the app as the literal `"[object Object]"`. Keyed per grade
  because Grade 8's parents must never be shown Grade 7's safety deck; only `g7` has entries today,
  and a grade with no entry falls through to the sheet's card or text exactly as before.
- A deck **replaces** the card, the count pill and the `PendingNote` for that section. On the single page
  it also replaces the **carry card's own head**: the block heading above it already says "Things to
  carry", and with no count pill to carry (a deck has no item count) that head was the same words twice.
  `.stage-page .carry-card.has-slides > .chip-head` is display-none; the printed-list path keeps its head
  and its count. The deck is the
  school's document, so a link to the same document beside it is noise.
- **The frame is HEIGHT-driven** (`height: 100%; width: auto; aspect-ratio: 16/9; max-width: 100%`),
  which is the one non-obvious part. Sizing it from width — the natural
  `width: 100%; aspect-ratio: 16/9` — derives its height from the card's width, which at 1280×720 came
  to 322px inside a 291px box and hung 31px below the window; `max-height` on the iframe cannot save
  it, because that resolves against a wrapper with no height of its own and is ignored. Below 980px the
  cards stack, there is no fixed height to derive from, and it goes back to width-driven with the panel
  scrolling. `.carry-card.has-slides` drops the list's 1080px cap: capping the width made width bind
  before height, which clamped the width without shrinking the height and the ratio came out 1.735.
- **The skeleton sits behind the frame, not instead of it** — the load event being waited for only
  fires if the frame is rendered. It is `position: absolute; inset: 0`, and because the wrapper's
  height comes from its container rather than its content, the box is its final size from the first
  paint. Measured: skeleton 820×461 against a wrapper of 822×463, so nothing can jump.

Measured, Grade 7, all zero overflow and zero window scroll: 1907×878 → Safety and Do's/Don'ts
820×461 (ar 1.781), Things to carry 1075×604 (ar 1.780); 1280×720 → 465×261 (1.784); 1920×620 →
362×203 (1.785); 375×812 → 307×173 (1.778), `documentElement.scrollWidth` 375 so no horizontal
overflow, both decks reachable.

**The poster path below is now the fallback, not the main route** — it still runs for any grade or
section with no deck configured.

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
  so B1 and B2 sit side by side (verified: equal `getBoundingClientRect().top`). Since 2026-08-17 the two
  KINDS sit beside each other too, in a `.orient-groups` grid: stacked, a one-batch grade gave the section
  two labels and two small cards down the middle of a 1400px column, ~350px of it empty. The block went
  528 → **303px** at 1440×900. `DocCard` takes
  `batchTag` and shows "B1"/"B2" as an absolutely-positioned chip, which is why `.doc-card` is
  `position: relative` — positioned rather than in the flow so it sits over a Drive thumbnail as
  readily as over the icon tile. The card's label stays the chip's own name from the sheet.

  **Since 2026-08-17 each card carries a LIVE, slide-sized preview** ("make box big like screen preview
  in box like ppt docs or slide preview, all things fit on screen"), which reverses the `compact`
  treatment below. `DocCard`'s new `preview` prop frames the deck itself — `describeDoc().embed`, which
  is `/embed` for Slides and `/preview` for a Doc, Sheet or Drive file — inside a fixed 16:9
  `.doc-preview` box, with the Drive thumbnail and then the typed icon as fallbacks in the SAME box, so
  a card whose file will not load stays slide-shaped instead of collapsing to a 46px icon beside a
  slide-sized neighbour.

  A framed card is a `<div>`, not an `<a>`: an iframe is interactive content and an anchor may not
  contain any, and it is also what stops a click on slide 2 from navigating away. The label carries the
  link instead.

  **Three sizing lessons, all measured:**
  - The frame is width-driven from a HEIGHT budget — `width: min(100%, calc(var(--orient-h) * 16 / 9))`
    with no height set — which is the only way to bound both axes and keep the ratio exact. Same rule as
    the guideline decks; setting both axes is what produced ar 1.499 there.
  - **The card needs a definite flex basis**, `calc(var(--orient-h) * 16 / 9 + 52px)`. With
    `flex: 0 1 auto` the card sized to its content while the frame asked for `min(100%, …)` of the card
    — circular, and the browser resolved it against the label's max-content width, so the frame came out
    302px where 434 was available.
  - **`flex-wrap: nowrap` on a row of previews**, because a flex line wraps BEFORE it shrinks: staff's
    four decks each had a basis of nearly the full column, so they went to four rows and pushed the page
    403px. With nowrap they shrink to half the column instead. Wrap returns below 980px, where the groups
    stack and two abreast would be ~160px wide.
  - `--orient-h` is `clamp(150px, calc(100dvh - 470px), 460px)`: ~470px of the window is fixed cost
    (two sticky bars, section head, group label, card chrome) that does not scale, so a plain `40dvh`
    fitted a tall window and overflowed a 620px one.

  Measured, no page scroll and every frame exactly ar 1.778: **1907×878** parent 637×358, staff 285×160
  ×4 in two rows of two; **1280×720** 442×249; **1280×620** 265×149 (the floor); **375×812** 285×160
  stacked, page scrolling as a phone does, no horizontal overflow. All four frames fire their load event
  (checked with a capture listener, since `load` does not bubble).

  **What a parent actually SEES in the box is the sharing question, and it is mostly bad.** Measured
  2026-08-17 anonymously: of the 7 orientation decks in the sheet, **2 are viewable and 5 answer 401** —
  both Grade 7 parent decks work, both Grade 7 student decks and all three Grade 8/10 parent decks do
  not. A private file's frame shows Google's request-access page, and **nothing in the browser can tell
  the difference**: the frame is cross-origin and its load event fires either way, so this cannot be
  detected and fallen back from. The fix is the school sharing those five files "anyone with the link →
  Viewer".

  The older `compact` treatment (2026-08-14, "orintation cards make small dont make ui scroolable")
  dropped the medium entirely to save 234px of height on the fitted layout. `DocCard` still supports it
  and the itinerary card still uses it.
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
**Two families, and they changed on 2026-08-17 ("change font"): `--font-display` is **Fraunces** and
`--font-body` is **Manrope**,** replacing Instrument Serif and Plus Jakarta Sans. Both are variable
fonts, so the whole weight range is two files from Google. The display face carries the login headline,
the dashboard title, the trip title and — new with the stage — every section heading on the trip page;
everything else is Manrope at 700, with gentler tracking (-0.01 to -0.02em).

**`--display-weight: 600` exists because of that swap.** Instrument Serif's 400 was already a display
weight; Fraunces' 400 is a text weight and looked underset at 48–64px. The four rules that hard-coded
`font-weight: 400` beside `var(--font-display)` (`.display`, `.login-copy h2`, `.dash-head h2`,
`.home-banner-text h3`) now read the token, so the next face change is one line. Verified after the
swap: login headline Fraunces 600/58.9px with no overflow, picker 14 cards all 260–262px, and the
`'flow'` and `'fixed'` layouts both still measure clean.
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

## Both Grade 7 rows said "Batch 1" in the sheet — how the app compensates
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

**FIXED 2026-08-17: labels are computed over the whole group and looked up per row.** The paragraph
that used to sit here said a parent whose section matched only the mislabelled row would still see
"Batch 1", "because one row carries no collision to detect" — and the school duly caught it: their child
is in **Acumen**, which the sheet lists against Batch 2, and the page said Batch 1 on the pill, the
headline, the orientation cards and the travel block.

The bug was the ORDER of two correct operations. `mine` was filtered to the matched batch first, and
`batchLabels(mine)` then saw a one-row group and left it alone — throwing away the only thing that
knew this row was the second one. (`mine` itself was removed on 2026-08-19 when the filtering went;
labelling over `all` is what still matters, and it is now the only path.) `assembleTripApp` now builds `allLabels = batchLabels(all)` and a
`labelOf` Map keyed by row, and `batches`, `travel` and `documentsFrom` all read from that;
`documentsFrom` takes the map as an option rather than deriving labels from the rows it was handed, which
is what made its `batchTag` wrong too. `batchLabelsCollided(all)` also means the sheet-typo warning now
reaches a single-batch parent's console, where before it was silent.

**The headline drops a leading `Batch N:` too** (`stripBatchPrefix`). The pill is right beside it, so the
prefix was repetition when the sheet is right and a flat contradiction when position has corrected the
pill — "Batch 1: 13-20 December 2026" under a "Batch 2" pill is what the school photographed. Same
treatment `heroDates` already gave the Overview meta line. A prefix on a *detail* line is left alone
(Grade 8's second row reads `13-19 December 2026 / Batch 2: Verve, …`) — that line is the sheet's own
section list, not a duplicate of the pill.

Verified against the fixture, which reproduces the typo exactly (both Grade 7 rows read `Batch 1:`):
a real **Acumen** parent now sees pill "Batch 2", headline "13-20 December 2026", orientation cards
**B2 B2**, travel "Batch 2" and Overview meta `Grade 7 · Batch 2 · 13-20 December 2026`; a Cognizance
parent still sees Batch 1 throughout; staff see both, correctly numbered, on g7, g8 and g10.

This is still a workaround, not a replacement for fixing the sheet — and **the school appears to have
fixed it** (their screenshot on 2026-08-17 shows `Batch 1:` and `Batch 2:`), in which case the labels
come straight from the text and position never runs. The app is right either way now.

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
(instant scrolling did), and `IntersectionObserver` never fired at all.

**The same missing frames mean CSS TRANSITIONS never progress there, and this WILL mislead you.** A
transitioned property reads back as its *starting* value for ever, so a rotation you have just triggered
computes to `matrix(1, 0, 0, 1, 0, 0)` — identity — and looks broken. Measured 2026-08-17 on the phone
menu's chevron: with `transition: transform .2s` it read identity even from an inline
`transform: rotate(180deg) !important`, and with the transition switched off it read
`matrix(-1, 0, 0, -1, 0, 0)` immediately. **Switch the transition off before measuring anything animated**,
and do not conclude the property does not apply to the element — an hour went into "SVG cannot be
transformed", which is not true. Verify layout there through
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
- **`public/local-roster/`** holds a column-reduced copy of the roster (19 of the feed's 29
  columns stripped) for offline work. It keeps `StudentID, Name, Grade, section, StudentEmailID,
  ParentsEmailID, FathersMobileNo, MothersMobileNo, FatherName, MotherName` — **`StudentEmailID`
  was added on 2026-08-17** and its absence is worth remembering as a failure mode: a Grade 7
  student's real address was refused locally while working perfectly on production, purely because
  the local copy predated the column. **When the app grows a new roster column, refresh this copy
  or dev will disagree with production and look like a bug.** Rebuilt with a short script against
  `https://nucleus.fountainheadschools.org/CSVDATA/StudentData.csv` — the host and path are in the
  committed `vite.config.js` proxy, so no secret is needed; `ROSTER_CSV_URL` in `.env` is empty
  locally and only Netlify's copy is set.
- **The Vite dev proxy** `/roster → nucleus.fountainheadschools.org/CSVDATA` (vite.config.js)
  re-serves the live feed same-origin, which is the only way a browser can read it.
  `csvUrls: { students: "/roster/StudentData.csv" }` points one source at it while the rest
  stay local. **Restart the dev server after touching vite.config.js.**

`csvUrls` (per-source URL) beats `csvBase` in `localUrl`.

**The trap that cost a round trip on 2026-08-19: `csvUrls.trips` in `config.local.json` silences the
live sheet entirely.** A new column was added to the live workbook, the code to read it was written
and verified — and the tab still did not appear on reload, because dev was reading
`/local-roster/trip-app.csv` (13 columns, no such column) and never touching the sheet at all. The
fixture is a curated demo of the finished state, so it does NOT track the school's edits. When
something the school just changed in the sheet does not show locally, check this key before debugging
the code. `trips` is now left out of `csvUrls` so dev reads the live workbook; put it back to return
to the fixture.

**The proxy is dev-only** — `npm run build` emits static files with no proxy — and it hands
the *entire* roster to the browser. Never present it as the production pattern.

## The parent flow — one card, then everything
Login → **the child card is always rendered**, one child or several (the single-child
auto-redirect was removed on 2026-08-12 at the user's request) → tap it → the grade page with
every section: overview, documents, itinerary, safety, do's/don'ts, travel, reminders, media,
communication, packing list.

### Every batch, for everyone — the trip page no longer narrows to the child's batch
Set 2026-08-19: *"some student in future change trip batch thats why i decide show all batch"*.
`assembleTripApp` used to filter the grade's rows down to the batch whose `Section:` list named the
child's section, so a parent saw only their batch's dates, travel timings and orientation decks.
It doesn't any more — **`mine` is gone and `batches`, `travel`, `media` and the per-batch document
columns all read `all`**, which is what staff already saw. The trip page is now the same page for a
parent, a student and staff.

The reason is data staleness, not layout: students move between batches during the term and the
sheet's `Section:` lists are edited by hand, so a filtered page confidently shows a family the wrong
train. Two batches side by side, each labelled and each carrying its section list, lets the reader
find their own — wrong-but-certain is worse than complete.

**Only the third screen changed.** Login and the child/grade picker are untouched, on instruction
(*"first login and section grade selection same now dont change"*). `activeStudent.section` is still
resolved, still shown as the "Section Acuity" pill on the child card, and still passed into
`useTrip` → `assembleTripApp` — it just no longer filters. `matched` / `batchMatched` survive as a
**data-quality signal only**: `batchMatched: false` means the sheet lists this section against no
batch, and the console warning says so without claiming a fallback happened.

Restoring per-batch narrowing means re-introducing the filter at that one seam. Do not — the label
correctness fix of 2026-08-17 below is only load-bearing *because* filtering existed; keep labelling
over `all` regardless, since `all` is the group that carries batch position.

Verified 2026-08-19 in the browser on the local Grade 7 fixture, signed in as a real **Acuity**
parent (a Batch 1 section, which previously hid Batch 2): Overview shows both cards — "Batch 1 /
12-19 December 2026 / Section: Acuity, Cognizance, Idea & Perspicacity" and "Batch 2 / 13-20 December
2026 / Section: Acumen, Insight, Envisage, Vision"; Travel details shows both blocks with both trains;
Orientation shows **B1 B2** under each of parent and student. Console clean, `vite build` clean.

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

## Railway — the second host, and why it needed a server
The repo auto-deploys to **two** public URLs from the same `main`:

| Host | URL | Serves |
|---|---|---|
| Netlify | `fountainheadschooltrips.netlify.app` | `dist` + `netlify/functions/lookup.js` |
| Railway | `schooltrips-production.up.railway.app` | `dist` + `server.js` (since 2026-08-20) |

**The failure that made `server.js` necessary.** Railway's builder detected a Vite SPA
(`vite` / `spa=true`) and served `dist` with **Caddy, a static file server**. Caddy answered
`POST /api/lookup` with **405 Method Not Allowed, `Allow: GET, HEAD`** — there was no process
that could run the lookup. Trip pages loaded fine; **nobody could sign in**. Netlify was never
affected.

The two failures are host-shaped and must not be confused:

| On `/api/lookup` | Means |
|---|---|
| `405 Allow: GET, HEAD` | Caddy is serving — there is no Node process at all |
| `502` "Could not reach the school roster right now." | Node is serving, but `ROSTER_CSV_URL` is unset |

**The fix.** `server.js` in the project root — one `node:http` process that serves the built
SPA and `POST /api/lookup`. It **imports `resolveParent` from `netlify/functions/lookup.js`**
rather than restating the roster matching, grade gate, admin list or the minimal reply shape,
so the two hosts cannot drift. This is exactly the portability that module's header promised.
It is **dependency-free** — no Express, no lockfile change; the routing is three cases
(`/api/lookup`, other `/api/*` → JSON 404, everything else → static file or SPA fallback).

`railway.json` pins `buildCommand: npm run build` and `startCommand: npm start`, and
`package.json` gained `"start": "node server.js"`. **Both are needed** — the pin is what stops
SPA detection falling back to Caddy a second time.

**Do not add `engines.node`** to `package.json` to satisfy Railway. Netlify reads that field
too, and a range there can move the Netlify build's Node version — risking the working host to
help the broken one. Railway's default Node is recent enough; `server.js` uses nothing newer
than `node:fs/promises`.

**Netlify ignores `server.js` and `railway.json` entirely** — its build runs `npm run build`
and publishes `dist`. Pushing them is safe, and this was re-verified after the push.

**Railway's GitHub App is not installed, so pushes do NOT deploy there.** Settings → Source
shows "GitHub Repo not found", and the repo is *not* the problem — verified 2026-08-20 with all
credentials disabled: the GitHub API returns 200, the public page returns 200, and
`git ls-remote` reads `main`. It is public and healthy. What is missing is Railway's GitHub App
on the **`avneesh9908`** account, which is also why that repo never appears in Railway's repo
picker. The Railway account is `dev@protego.services`, a different owner, so **only whoever owns
`avneesh9908` can authorize it.** Confirmed empirically: `f57a544` was pushed and Railway had
not built it two minutes later, while Netlify had.

**So `railway up` is currently the only way to deploy Railway.** The older note here said the
opposite — that a CLI upload never sticks because the next commit overwrites it. That was true
once (a fix *was* lost that way on 2026-08-14, when the App still worked), but it is now
backwards: nothing overwrites the upload because nothing auto-deploys at all. Both statements
share one lesson — **the commit and the running Railway container are independent; check which
commit is live rather than assuming the push arrived.**

**Railway needs its own environment variables — now confirmed set.** `ROSTER_CSV_URL` and
`ADMIN_EMAILS` are per-host; setting them on Netlify does nothing for Railway. Both are present
on the Railway service (verified 2026-08-20), and login there now returns the same 404 as
Netlify for an unknown address — a 502 would mean the roster was unreachable. **But a set
variable proves nothing on its own:** they sat correctly configured and entirely unread for six
days while Caddy served the site, because no Node process existed to read them.

### The `/%` crash, and why `/healthz` exists
`decodeURIComponent` in `resolveStatic` was unguarded. A request for **`/%`** — one character,
no auth — threw `URIError` inside the async handler, which Node treats as a fatal unhandled
rejection, and the process died. With `restartPolicyMaxRetries: 10`, ten such requests would
have taken the service down until a manual redeploy. Fixed in `f57a544`: a malformed escape is
not a path, so it is refused like any other and the caller answers 400. **It never reached
production** — Railway was still serving the old Caddy build, and Netlify never runs
`server.js` at all.

`/healthz` returns JSON, which **Caddy serving `dist` could never do**. Pointing
`healthcheckPath` at it means a deploy that silently falls back to the static builder now fails
its healthcheck instead of going live with every login broken — the exact failure that shipped
unnoticed for six days.

**gzip had to be restored by hand.** Caddy compressed every text response; bare `node:http`
does not, so the move tripled the wire size (230 kB of JS instead of 75 kB) — which matters
because the origin is **US West** and the parents are in **India**. `server.js` now gzips text
types over 1 kB. `Content-Length` is deliberately omitted on compressed replies: it describes
the file on disk, not the stream, and sending it truncates the response.

**Do not pin `"builder": "NIXPACKS"` in `railway.json`.** It was there briefly and bought
nothing — the explicit `startCommand` is what defeats the SPA detection, not the builder.
Removing it restored Railpack, Railway's current default. Verified on the live deployment:
`builder=RAILPACK`, `startCommand=npm start`, `healthcheckPath=/healthz`, and **no Caddy in
the resolved packages at all**.

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
- `StudentEmailID` **is now read, into its own field** (2026-08-17) and grants access from
  Grade 7 up — see the access-control section. Until then it was excluded as "not a parent
  credential", which was right for the rule as it stood. `EmergencyContactNo` is still excluded
  on purpose: it is often a neighbour or a relative. `pick`/`collectAll` match whole normalized
  header names, so `StudentEmailID` can never collide with `Email` in either direction.
  **Measured against the live feed 2026-08-17: `StudentEmailID` is filled in 2618 of 2618 rows**,
  so every student in the school has one. `ParentsEmailID`, both mobiles and both parent names are
  equally complete; only `section` has a gap (2617/2618).

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
- 2026-08-20 — **Pushed and live: `0fd3bb6`.** `LiveList` (the student list rendered from
  `tqx=out:csv&gid=`, with the split heading, sticky head and `clamp(320px, 58dvh, 680px)` body), the
  `.doc-open` anchor fix on the framed orientation cards, `parseCsv` exported from `data/csv.js`, and
  the `gid`-aware sheet embed in `docPreview.js`. Pre-push scan: 0 emails, 0 phone-shaped numbers, 0
  keys or roster URLs across the diff **and** the new untracked file; also grepped for the five
  fictional names used in the stubbed-fetch test — none reached the source, the stub lived only in the
  browser. Verified in production by matching the served bundle hash to the local build
  (`index-VKgQVjwq.js`), finding `live-list`, `tqx=out:csv` and `doc-open` in the deployed JS, and
  re-checking that `/config.local.json`, `/local-roster/students.csv`, `/.env` **and
  `/collage-demo.html`** all answer with the SPA index — bodies read, not status codes.
  `public/collage-demo.html` stays untracked by choice, so the stock-photo demo is neither in the
  public repo nor on the site.
- 2026-08-20 — **The student list box is taller, and now sized against the window** ("give list more
  height of the list card"). `.live-list-scroll` went from a flat `max-height: 300px` to
  `clamp(320px, 58dvh, 680px)`: the old number filled a third of a 720px laptop and a sixth of a 1080px
  desktop, so it was wrong at both ends rather than at one. `dvh` because `vh` on a phone means the
  address bar's tallest state and the box would overhang. Measured across four sizes — 1280x620 →
  360px/9 rows, 1280x720 → 418px/11 (was 300/8), 1920x1080 → 626px/18, 375x812 → 471px/13. The two
  cards stay equal height (606px at 1280x720, 821px at 1920x1080), the "Open the student list" line
  stays reachable, and there is no horizontal overflow at any size. Clean console, clean build.
- 2026-08-20 — **Dropped the sheet title and the empty-list note from the student list card.** Both
  removed on request: the card already names the batch and its dates, so "Final List of students for
  G7 Educational trip to Rajasthan (Batch 1)" was the same fact at greater length, and "The names have
  not been added to this list yet" told a reader what 54 blank rows already show. `.live-list-cap` went
  with them; `.is-note` survives for the loading and error lines only. **`splitMergedHeading` was
  kept** — the title is now discarded instead of rendered, and that split is the thing holding the
  serial column narrow, so removing it with the caption would have restored the original bug.
  Verified: zero captions and zero notes in the DOM, neither string present anywhere in the panel,
  card text now reading straight from "B1 · Student list · 12-19 December 2026 · Section: …" into the
  headers, columns still 59 / 211 / 136 / 128px across 54 rows, no overflow. Clean console and build.
- 2026-08-20 — **An empty student list now shows the table, not just a note** ("open preview when the
  list is empty"). `LiveList` renders `filled.length ? filled : body`, with the "names have not been
  added" line demoted to a caption above the rows. The previous pass had replaced an all-blank list
  with the note alone, reasoning that numbered blanks are a form rather than a list; the school's
  reading is better — a card containing one sentence looks broken, while the headings and the row
  count tell a reader the list exists and how long it is. The unfilled tail is still dropped once real
  names arrive, since by then the blanks carry nothing.
  Verified on g7: both cards show the caption, the note, and **54 rows** inside the 300px scroller,
  columns 59 / 211 / 136 / 128px at 1280x720 and 59 / 86 / 74 / 69px on a phone — the serial column
  staying narrowest at both, no horizontal overflow, zero iframes. Clean console, clean build.
- 2026-08-20 — **The student list is RENDERED by the app now, not framed from Google** ("serial tab
  show high width and student name colums show less"). The sheet carries a merged title across the top,
  so Google's own rendering gave column A the width of "Final List of students for G7 Educational trip
  to Rajasthan (Batch 1)" and squeezed Student Name, Section and Gender into the remainder. **A
  cross-origin frame cannot be styled from here at all** — no CSS, no column widths — so the only way
  to control the layout was to hold the data. That is the general lesson: an iframe buys fidelity and
  costs every ounce of layout control; the moment the layout matters, fetch and render.
  New `src/components/LiveList.jsx` reads `gviz/tq?tqx=out:csv&gid=…` (which honours the tab and
  answers with `Access-Control-Allow-Origin` echoing the caller — verified from localhost), parses it
  with the CSV parser now exported from `data/csv.js`, and draws a table. `splitMergedHeading` peels the
  glued title off "… Sr.No" so the long half becomes a caption and the short half stays the column
  head — the actual cause of the wide column. The serial column is `width: 1%; white-space: nowrap`,
  the head is sticky, and the body is capped at
  `clamp(320px, 58dvh, 680px)` so a 25-name list cannot push the card's "Open" line past the fold.
  **Window-relative, not a flat number** (raised from 300px on 2026-08-20, "give list more height"): a
  fixed cap was a third of a laptop screen and a sixth of a desktop one. `dvh` not `vh`, or the box
  overhangs on a phone where `vh` means the address bar's tallest state. Measured — 360px/9 rows at
  1280x620, 418px/11 rows at 1280x720, 626px/18 rows at 1920x1080, 471px/13 rows at 375x812. An HTML response (Google's sign-in page) is treated as an error, so an unshared
  sheet falls back to the link rather than rendering markup.
  **Rows carrying only a serial number are dropped once names exist**; while none are filled the whole
  table is shown, so an empty list still previews ("open preview when the list is empty").
  **The card renders the table and nothing else** — the sheet's own title line and the "names have not
  been added yet" note were both removed on the school's instruction. The card above the table already
  states the batch and its dates, so the title repeated that at greater length, and the note said what
  the empty rows show anyway. **`splitMergedHeading` still runs**: the title is discarded rather than
  displayed, and that split is what keeps the serial column narrow — deleting it along with the caption
  would put the wide column straight back.
  Verified both paths: live, zero iframes, each card fetching its own tab (Batch 1 / Batch 2 captions
  prove the gid); and with `window.fetch` stubbed to return five names, the table renders headers
  Sr.No · Student Name · Section · Gender at **59 / 136 / 112 / 82px** — the serial column now the
  narrowest — with a sticky head and the 300px cap. Phone: 339px cards, zero overflow. Clean console.
- 2026-08-20 — **`/preview` ignores `?gid=` — sheet embeds now use `gviz/tq?tqx=out:html`.** The
  school's screenshot showed both student list cards framing "Itinerary Batch 1", the workbook's FIRST
  tab, with Google's own tab bar along the bottom inviting a reader into tabs the card is not about
  ("here by default show first tab itinary i want to defult open student list and dont show the
  tabs"). Diagnosed by fetching each candidate form anonymously: `/preview?gid=0` and
  `/preview?gid=1780253530` return different bytes but the same first tab; `pubhtml` returns a 9KB
  not-published page (the sheet is link-shared, NOT published to web, so every `pub`/`pubhtml` form is
  out); **`gviz/tq?tqx=out:html&gid=…` honours the gid exactly** — gid=0 answers "Student List
  Batch 1", gid=1780253530 answers "Student List Batch 2" — returns nothing but the table, and carries
  no `X-Frame-Options` or `frame-ancestors`, so it frames. The trade, accepted: gviz is a plain table,
  losing the sheet's colours and merged cells. For a list of names, showing the RIGHT names beats
  showing the wrong ones prettily. With no gid `/preview` stays, since there is no tab to isolate.
  **Also settled a suspicion: the school's links were right all along** — gid=0 really is Student List
  Batch 1; it was `/preview` discarding the parameter. Verified in the app: two gviz srcs with
  distinct gids, 389x291 frames, "Open the student list ↗" still pointing at `/edit?gid=…`, clean
  console.
  **Noticed while reading the gviz output: both student list tabs are EMPTY** — headers and row
  numbers 1-N present, every name cell `&nbsp;`. Flagged to the school; the page is working, the sheet
  is not filled in yet.
- 2026-08-20 — **The Student list cards frame the list itself** ("here change like show preview like
  live list"). `ItineraryCards` gained a `live` flag: with it the card becomes a `<div>` holding a 4:3
  `.itin-card-frame` iframe of the document, with the action line as a real `<a>` — the framed-card
  anchor rule, applied deliberately this time rather than learned the hard way as on the orientation
  cards. 4:3, not the collage's 16:9, because a list wants rows: a 16:9 strip showed four names.
  Only the Student list is `live`; Itinerary stays a plain whole-card anchor (re-verified: `<a>`, no
  frame). A day-by-day plan is not worth reading in a 500px box, and a list is.
  **`embedFor` now carries a spreadsheet's `gid` into the embed** — read from the query *or* the hash,
  since Sheets hands out `#gid=` from the tab bar and `?gid=` from the share dialog. Without it both
  cards framed Batch 1's tab, i.e. the same list twice, defeating the per-batch column. Verified two
  distinct srcs: `…/preview?gid=0` and `…/preview?gid=1780253530`.
  **This one actually works because the file IS link-shared** — checked anonymously before building:
  `…/preview` returns "G7 students list (students/ parents) 2026-27" with no account, unlike the photo
  folders that redirect to sign-in. Worth the school knowing the flip side: that list is readable by
  anyone holding the URL, and the page now renders it inline rather than behind a click.
  Frames are **not** `loading="lazy"`, matching the deck frames' existing rule — the tab only mounts
  when opened, so lazy is pure delay. Verified: 541x405 frames at 1280x720, 287x215 on a phone, action
  line resolving to the sheet with `target="_blank"`, zero overflow, clean console.
- 2026-08-20 — **"Open ↗" on the framed cards was not a link at all** ("open button not work like i
  click no redirect"). On the `preview && embed` branch the card is a `<div>` (an anchor may not
  contain an iframe), the TITLE carried the href, and the action line under it was a bare `<span>` —
  measured `rgb(43,58,143)`, the accent colour, with `cursor: default`. It looked exactly like a link
  and did nothing, which is the worst of both. Fixed by wrapping the title and the action line in ONE
  new `.doc-open` anchor rather than making the meta a second one, so a screen reader still announces
  each deck once; its 14px gap reproduces the card's own, so no spacing moved (verified 14/14 before
  and after). Verified by intercepting real clicks with `preventDefault`: clicking the "Open ↗" line
  and the title on two different cards all resolve to that card's own deck URL with `target="_blank"`,
  and the meta's cursor is now `pointer`. Only the framed branch was affected — every other tab's
  card is itself the anchor, re-checked on Photos (`<a class="doc-card">`, meta inside it).
- 2026-08-20 — **Pushed and live: `7958071`.** The Photos collage (grid mosaic, perspective stage,
  staggered entrance, pointer tilt, glare, scroll reveal, ambient drift, all off under
  `prefers-reduced-motion`), the "Trip Memories" album card on the grade's photograph, the
  `imageUrl` rewrite in `PhotoTile`, the removed duplicate photo, and the travel-card work (centred
  16px/900 pill over a centred left-aligned fact block, `dropBatchHeading`, derived leg gap, shared
  highlighted-box rule). Pre-push scan: 0 emails, 0 phone-shaped numbers, 0 keys or roster URLs in
  the diff; `.env`, `config.local.json` and `local-roster/` all still ignored.
  **`public/collage-demo.html` was deliberately left UNTRACKED** rather than committed — it is a
  stock-photo demo, and there is no reason for it in a public repo when `LOCAL_ONLY` already keeps it
  out of every build. It stays available locally at `/collage-demo.html`.
  Verified in production by matching the served bundle hash to the local build
  (`index-Bo34XYkT.js`), confirming "Trip Memories", "photo-collage", "album-card" and "Student list"
  all appear in the deployed JS, that `/collage-demo.html` serves the SPA shell with **zero** picsum
  references, and that `/config.local.json`, `/local-roster/students.csv` and `/.env` all answer with
  the SPA index — **bodies read, not status codes**.
- 2026-08-20 (thirty-first pass) — **Railway login is live and verified, and a remote-crash bug
  was caught before it shipped.** Reviewing the previous pass's `server.js` found
  `decodeURIComponent` unguarded: `GET /%` killed the process (reproduced — the liveness recheck
  after it returned nothing), and `restartPolicyMaxRetries: 10` would have made ten such
  requests permanent downtime. Fixed, plus gzip restored (Caddy had been compressing; bare
  node:http was sending 230 kB instead of 75 kB to Indian users from a US West origin) and
  `/healthz` added so a silent fallback to the static builder fails its healthcheck instead of
  going live broken. Dropped the `NIXPACKS` pin — the `startCommand` is what defeats the SPA
  detection. Committed and pushed as `f57a544`, then deployed with `railway up` because
  **Railway's GitHub App is missing on `avneesh9908`, so pushes do not deploy there** — proven
  by watching `f57a544` sit unbuilt for two minutes while Netlify took it. The repo itself is
  public and healthy (GitHub API 200, `ls-remote` clean, all credentials disabled), correcting
  any suspicion that visibility was the cause. Live checks: `/healthz` → `{"ok":true}`,
  Railway and Netlify now return **byte-identical** 404s for an unknown address, `/%` no longer
  kills anything, bundle served `Content-Encoding: gzip` + `immutable`, roster CSV path still
  returns the SPA shell. Deployment manifest confirms `RAILPACK` / `npm start` / `/healthz` and
  **no Caddy in the resolved packages**. Also corrected the prior note that "`railway up` does
  not stick" — now backwards, since nothing auto-deploys to overwrite it.
- 2026-08-20 — **Removed the duplicated photograph on the Photos tab** ("REMOVE THIS PHTO YOU ADD
  EXTRA"). The collage had a fallback that showed the grade's own photo as a single tile when the
  sheet had no photo links — but the album card underneath already uses that same file as its
  background, so the tab rendered one picture twice. `tiles` is now plainly `media`, so the collage
  appears only when there are real photo links. Verified on g7: the photograph now appears **exactly
  once** on the tab (swept every `<img src>` and every computed `background-image` inside `#photos`),
  no `.photo-collage` element rendered, and the card still reads "Trip Memories". A caught-by-the-
  school duplication worth remembering: two features were each independently right to reuse the
  Overview photo, and neither knew about the other.
- 2026-08-20 — **The album card reads "Trip Memories", not the Drive chip's name.** New
  `ALBUM_LABELS = { Photos: 'Trip Memories' }` in `TripPage`, applied where `PhotosSection` renders
  the card. The sheet's chip is named "Pics for trips" — the school's filing name for the folder, not
  something written for a parent — and they asked for it replaced. Second instance of the same
  pattern as `ORIENTATION_LABELS`, with the same accepted trade: the page's wording is now fixed
  copy, so renaming the folder in Drive cannot change it. A category with no entry in the map still
  takes the file's own name, so `Photos from last year` is untouched (and has no column in the
  current 15-column sheet anyway). Verified on g7: one card labelled "Trip Memories", href still the
  folder, meta still "Photos ↗". Clean console, clean build.
- 2026-08-20 — **`collage-rise` is `backwards`, not `both`, and that is what made the cursor tilt work
  at all.** A filling animation overrides the element's own `transform`, so the finished entrance had
  been pinning every tile to its `to` keyframe: the tilt and the hover lift computed to the identity
  matrix from 0.55s after load onward, for the six days since the effect was added. Found while
  verifying the new glare — a real hover reported `--tilt-x: 5.42deg` and a computed transform of
  identity, and cancelling the animation produced the expected rotation plus a 37.72px Z lift.
  `backwards` fills the stagger delay and then releases the element. Verified after the change:
  `getAnimations()` empties once the entrance finishes, a tilt applies without cancelling anything, and
  the scroll reveal still holds an unreached tile at opacity 0 on the `from` keyframe.
  **Do not verify a transform by reading the custom property that feeds it** — that only proves the
  handler ran. Read the computed matrix, after `a.finish()`.
- 2026-08-20 — **Two more motion layers, and the demo doubled to 24 pictures** ("more images take on
  internet ... add motion animation other things like cursor move some motion or animation perform on
  screen"). Added a cursor-tracking **glare** (`--mx` / `--my`, written by the same handler and off the
  same `getBoundingClientRect` as the tilt), a **scroll reveal** so a tile plays its entrance when it is
  reached instead of below the fold, and a slow **ambient drift** on the lead tile so the page is never
  wholly still. Both the CSS and the demo copy carry them, and all four are switched off under
  `prefers-reduced-motion` — the glare because it follows a cursor, so it is motion too.
  **The stock images stayed in the local-only demo and the app's CSS took the motion**, which is the
  split the standing rule forces: the app never substitutes a found picture for a photograph it does
  not have. Verified `0` occurrences of `picsum` in the built bundle and `dist/collage-demo.html`
  absent, alongside the new CSS present in `dist/assets/*.css`.
  See **"Never pause an entrance before the observer has answered"** for the ordering trap this
  uncovered — it is the load-bearing lesson, not the effects.
  Verified: tilt ±7.00deg and glare 0%→100% at opposite corners, both 0 / 50% at centre, both
  unchanged after a touch move and reset on leave; paused-and-unmarked holds opacity 0 at the `from`
  keyframe (8deg, −69px Z) and `is-in` runs it to identity at opacity 1; with no `js-reveal` nothing is
  paused at all; drift on the lead tile only (tile 6's image reads `animationName: none`); 24 tiles, two
  columns and zero overflow at 375px; clean console, clean build.
- 2026-08-20 — **`public/collage-demo.html`: a standalone preview of the 3D motion collage, with
  placeholder photos.** The school asked to see the cursor-motion effect using pictures from the
  internet, since their own are unreachable (Drive folders shared with named people). Twelve
  `picsum.photos` seeds — deliberately random stock, **not** photographs of any school or any place on
  the itinerary — in a copy of the real `.photo-collage` CSS and the real tilt handler, so what the
  page does is what the Photos tab does.
  **It is in `vite.config.js`'s `LOCAL_ONLY` list, so every build deletes it from `dist/`** — verified
  (`[build] removed local-only files from dist: local-roster, config.local.json, collage-demo.html`,
  and `dist/collage-demo.html` absent). That guard is the point: the app never substitutes a stock
  image for a missing photograph, and a page of random pictures headed "Trip photos" would read to a
  parent as their child's trip. **Delete the file when the real photographs land.**
  **Twenty-four tiles since 2026-08-20**, up from twelve, because a scroll reveal cannot be seen in a
  collage that fits on one screen.
  Verified at `http://localhost:5180/collage-demo.html`: 12 distinct images, lead tile 2x2 (311x242
  against 146x114), two columns and no overflow at 375px, tilt +6.5/-6.6deg at opposite corners, 0 at
  centre, ignored for touch, reset on pointerout.
  **Two environment traps, both from the Browser pane being hidden** (`document.hidden === true`):
  lazy images never enter the viewport so nothing loads — an eager `new Image()` probe proved
  `picsum.photos` itself is reachable, so it is the pane, not a blocked host — and a `javascript_exec`
  that awaits image `onload` simply times out. Force `loading = 'eager'` and re-assign `src` to check
  rendering.
- 2026-08-20 — **Collage tiles now rewrite Drive links, and the column to paste them in is
  `Photos Links`.** The school offered to paste photo links into the sheet, which would not have
  rendered: `PhotoTile` put `item.url` straight into `src`, and a Drive *share* URL is a web page, so
  every tile would have errored to its icon. Exported `imageUrl` from `lib/tripPhoto.js` (it already
  did this for the Overview banner) and applied it in `PhotoTile` at 800px — non-Drive URLs pass
  through untouched, verified with the local `/trip-photos/g7.jpg` still loading.
  **Which header to use matters**: `val(row, 'photos', 'photo', 'media', 'photosvideos',
  'photoslinks')` feeds the collage, but `photos` is ALSO an alias of the folder column
  (`picfolderlink | picfolder | photos | photofolder`), so a column headed "Photos" would render as a
  media list *and* an album card. **"Photos Links"** normalises to `photoslinks`, which only the media
  reader claims. `splitLinks` splits on whitespace, commas and semicolons, so one URL per line works.
  Counts, from the grid (`auto-fit` 150px tracks, 130px rows, lead tile 2x2): **11 fills two clean
  rows at 1280px**, 13 at 1920px, 5 is the minimum that reads as a collage rather than a row.
  Sharing is still the gate — each pasted file must be "anyone with the link" or the thumbnail
  endpoint answers with a sign-in page and the tile falls back to its icon.
- 2026-08-20 — **The collage got a 3D motion treatment** ("make 3d motion collage like look
  attractive and attractive to student"). Three separable pieces, so any one can be tuned or dropped:
  a `perspective: 1200px` stage on `.photo-collage` (it must be on the PARENT — a `rotateY` under a
  flat parent renders as a squash); a `collage-rise` entrance that lifts each tile out of the page
  with a 6-step stagger that cycles, so a large collage does not make the reader wait; and a hover
  `translateZ(38px)` with a deeper shadow plus a 1.06 image scale, which is what makes a tile read as
  a window rather than a printed card.
  The cursor tilt is the only JS: `PhotoTile` writes `--tilt-x` / `--tilt-y` from the pointer position
  (max 7deg — past ~10 a photograph reads as distorted), because `:hover` cannot know where the
  cursor is. It is an enhancement on a collage that already works: the properties default to `0deg`
  in CSS, **touch pointers are ignored** (a finger is already on the tile it would tilt, and the
  transform fights the tap), and `prefers-reduced-motion` disables the animation, the transitions and
  the transforms in CSS *and* stops the handler being attached at all. `will-change` is deliberately
  not set per tile — a promoted layer each would cost more than the effect is worth in a grid that
  may hold dozens.
  Verified: tilt +6.30/-6.30deg at opposite corners, 0 at centre, unchanged after a touch move, reset
  on leave; stagger 0 → 0.30s cycling; three reduced-motion rules present for the collage.
  **Environment note worth keeping: CSS animations do not advance while the Browser pane is hidden**
  (`document.hidden === true`), so a tile sits pinned at its `from` keyframe and looks broken. Seek
  with `el.getAnimations()[0].currentTime = …` or `.finish()` to check the end state — the entrance
  resolves to an identity matrix at opacity 1. Clean console, clean build.
- 2026-08-20 — **The Photos tab is a collage grid now, and the reason it looks thin is DATA, not
  layout** ("pic collage"). `.photo-collage` replaces the `.photo-masonry` CSS-`columns` list: a grid
  with `auto-fit` 150px tracks, `grid-auto-rows: 130px` and `grid-auto-flow: dense`, where the lead
  tile spans 2x2 and the rest backfill around it. `object-fit: cover` on the tiles, since ragged tile
  heights make a collage read as a list with gaps. Verified the mosaic by cloning tiles in the DOM
  (layout only, then reloaded): lead 334x274 with six 160x130 tiles flowing around it and the seventh
  backfilling the second row, grid height 274 — no wasted rows; two columns of 163px on a phone, zero
  overflow at both.
  **Today it shows nothing, because `media` is empty — and that is correct.** A fallback that used
  the grade's own photograph as a single tile was added and then **removed the same day at the
  school's request**: the album card below already carries that photograph as its background, so the
  tab was showing one picture twice. `tiles` is now just `media`. With no media the collage does not
  render at all and the "Trip Memories" card is the whole tab, which also keeps the standing rule that
  the app never invents a photograph it does not have.

  **Why `media` is empty is a content limit, not a layout one.** Checked against
  the live sheet: `photos` holds a Drive FOLDER chip ("Pics for trips"), not image links, and the new
  `Grade Photo` / `Hero Section Photo` columns are **empty for every grade** — the school added the
  headers but no values. So `tiles` falls back to the grade's own `tripPhotos` image as a single
  full-width tile (`:only-child` takes `1 / -1`, because a 2x2 lead in a 7-track grid would leave two
  thirds of the row empty). It is deliberately NOT padded with `tripCardPhotos` — that is the same
  photograph cropped to a 2.6:1 strip, and two crops of one image side by side read as a mistake.
  **To get a real collage, one of two things has to happen**, and both are the school's:
  paste image links into the sheet's photo column, or set `driveApiKey` in `config.json` so
  `expandFolderDocuments` lists "Pics for trips" into one tile per file. The renderer needs no further
  change either way — it fills from `media` the moment `media` has more than one entry.
- 2026-08-20 — **The Photos tab's album card now sits on the grade's own trip photograph**
  ("make this page like background fancynatic ... like thoese i use in overview"). The tab read as
  empty because a Drive **folder** has no thumbnail — Drive serves none — so the card was a folder
  glyph on white. New `.album-card` wrapper takes the photo as an inline `--album-photo` custom
  property and layers a `rgba(12,18,44,.28) → .82` gradient scrim over it; the `DocCard` inside drops
  its own fill, border, shadow and icon and becomes the label only. It is the **same file Overview
  already fetched**, so there is no extra request and no stock image standing in for a picture of this
  trip.
  Two things worth keeping: the guard, and the auto-margin. `.is-photo` and the property are set only
  when a photo exists, so a grade without one keeps the plain white card rather than showing a dark
  box — **verified on g8 as staff**: no `is-photo`, white fill, ink label, folder icon still there.
  And `.doc-meta`'s `margin-top: auto` (which pins the action line on a normal card) **beats the
  parent's `justify-content: flex-end`**, so it split the pair — title near the top of the
  photograph, "Photos ↗" 100px below it. Cancelled to `margin-top: 0` on photo cards so `flex-end`
  groups them at the dark end of the scrim.
  Measured: photo loads 1920x1080, card 420x190 (339 on a phone), label in the lower half with 14px
  to the action line and 24px of inset below it, and the label's **worst-case** contrast — a pure
  white photograph under the scrim's darkest stop, `rgb(56,61,82)` — is **10.78:1**. Clean console,
  clean build.
- 2026-08-20 — **The travel gap is now DERIVED, one blank line before the return leg**
  ("depature , train and arrival, train make gap previously like"). Two passes got here: honouring
  the sheet's blank lines put gaps in the wrong places, then filtering them all out lost the
  outbound/return split. Neither reading of the sheet works, because g7 types a blank after Departure
  and after the outbound Train but none before the return Train. So `TravelNotes` keeps the
  blank-line filter and inserts its own gap from the LABEL: new `TRAVEL_LEG_START`
  (`arrival|arrives|return|boarding`) makes the separator `'

'` instead of `'
'`, rendered by
  the `pre-wrap` already on `.travel-notes` — no extra element. Whatever staff type, the card reads
  Departure/Train · gap · Arrival/Train. Measured line-to-line: 26px, **51px**, 25px at 1280x720 —
  one line-height inside a leg, two between them — identical on both cards, and the same pattern on a
  phone where each fact wraps to two lines. Clean console, clean build.
- 2026-08-20 — **Blank lines dropped from the travel facts** ("departure and train have one line gap
  please remove"). `TravelNotes` now filters empty lines after `dropBatchHeading`, so a batch's four
  facts read as one column. The sheet carries those blanks **inconsistently** — g7 has one after
  Departure and one after the outbound Train but none between Arrival and the return Train — so
  honouring them made the card look like the typing rather than like a list; filtering matches the
  pair that already had no gap. `white-space: pre-wrap` stays on `.travel-notes`: it is what preserves
  the single newlines now that there are no doubles to honour. Measured: 4 rendered line boxes with
  even 25/26/25px gaps (one line-height each), block 180 → 102px, both cards identical, zero blank
  lines in the text, no overflow at 1280x720 or 375x812. Clean console, clean build.
- 2026-08-20 — **One HIGHLIGHTED BOX treatment, now shared by `.orient-box` and `.travel-card`**
  ("boxes boder hightlist like other previous like show differnce on cards"). The travel cards were
  `--card` white with a 1px `--line` hairline and read as page rather than as containers; they now
  carry the same `2px solid #b4bdda` + `--link-bg` + `--shadow-hero` as the orientation deck groups.
  Written as **one rule listing both selectors**, with the treatment removed from `.orient-box`'s own
  block — a copy in each would drift the first time either is tuned. Only geometry stays per element
  (`.orient-box` 18px radius / 18-20 padding, `.travel-card` 26px / 22-24).
  The measured reasoning is recorded in that rule's comment so it survives the next tweak: on this
  palette every light tint is within ~1.05:1 of the page, so the **border** is what separates a box
  (`#b4bdda` = 1.806:1, against 1.07:1 for the `--line-2` hairline it replaced), and widths are whole
  pixels because a 1.5px border computed back as `1px` at DPR 1.
  Verified: travel cards 2px `rgb(180,189,218)` at 1.806:1 with body text 7.232:1 on the tint (well
  past AA); orientation boxes unchanged at 765px with four live iframes; a sweep of every element on
  the page found the treatment on exactly the two intended selectors and nothing else; zero overflow
  at 1280x720 and 375x812. Clean console, clean build.
- 2026-08-20 — **Travel details: the batch pill and the fact block, three passes.** Recording these
  properly because they were lost once: the code shipped in `b9e43a3` but that commit did not touch
  this file, and an uncommitted set of skill notes was then overwritten by a later session's rewrite.
  **Commit the skill with the code.**
  1. *"left align details"* — `.is-stage .travel-card` went `text-align: center` → `left`. Departure /
     Train / Arrival are labelled facts; centred, every label had its own left edge and the eye could
     not run the column.
  2. *"batch 1 and batch 2 size incrase and make bold or centere"* — `.travel-top .label` 12px/800 →
     **16px/900** in an `8px 18px` capsule, and `.is-stage .travel-top` back to
     `justify-content: center`. That does **not** undo (1): `.travel-top` is its own flex row, so
     centring it moves the pill alone. Verified both at once — pill centre == card centre while every
     body line still started at one x.
  3. *"all make center text in box and left align"* — the two halves of that are separate things and
     the card needed both: `.is-stage .travel-notes { width: fit-content; max-width: 100%;
     margin-inline: auto }` centres the BLOCK while `text-align: left` keeps its LINES aligned. Flush
     left, ~420px of text sat in a 599px card and looked off-centre under a centred pill.
     Measured: card centre == block centre == pill centre (330 and 951 at 1280x720, 188 at 375x812),
     four lines per card each starting at a single x (118, 760), zero overflow.
     **Accepted side effect:** each block centres independently, so cards whose longest lines differ
     get slightly different text left edges (88px vs 109px inside the card). Lining them up needs a
     shared `max-width`, which would un-centre one block — not asked for.
- 2026-08-20 (thirtieth pass) — **Railway can now run the login.** Asked to "devlop on the
  railway". Railway was serving `dist` with Caddy, so `POST /api/lookup` returned 405 and no
  parent or student could sign in on that URL. Added a dependency-free `server.js` (node:http)
  serving the SPA and the lookup, importing `resolveParent` from the Netlify function so both
  hosts share one implementation, plus `railway.json` pinning build/start and a `start` script.
  Verified locally against the real roster fixture: static 200, SPA deep route 200, hashed
  assets `immutable`, admin 200, malformed 400, GET 405, unknown-on-roster **404 — not 502,
  proving the roster actually loaded and matched** — and an encoded path traversal 400. Dropped
  an `engines.node` field before pushing, because Netlify reads it too. Pushed as `7566ee5`;
  **Netlify re-verified healthy**. Railway had not picked the commit up ~12 min later — still
  the old bundle `index-C9oF_N31.js`, still 405 — so **the Railway deploy is unconfirmed**, and
  its `ROSTER_CSV_URL` / `ADMIN_EMAILS` are unchecked (CLI logged out).
- 2026-08-19 (twenty-seventh pass, same day) — **Pushed and live.** `87dbd6e` on `main` carried the
  whole session: every-batch trip pages, the rewritten login copy bracketing the field, the
  Orientation redesign (no head, display headings, boxed groups, chip in the label flow), the filled
  itinerary cards, and the new Student list tab. Pre-push scan of the staged diff found no email
  addresses, phone-shaped numbers, roster URLs or API keys, and `.env`, `config.local.json` and
  `local-roster/` were all confirmed still gitignored with nothing untracked to sweep in. Netlify
  auto-deployed; verified in production by **matching the served bundle hash to the local build**
  (`index-C9oF_N31.js`), confirming "Student list" appears in the deployed JS, and re-checking that
  `/config.local.json`, `/local-roster/students.csv` and `/.env` all answer with the SPA index —
  **bodies read, not status codes**, since the SPA rule returns 200 for anything.
  **Carried forward, pre-existing:** `p.aadhyan.khunt@fsksurat.in` appears in three already-committed
  lines of this skill (demo-login notes from earlier sessions). This repo is public and CLAUDE.md
  forbids PII here, so those should be redacted to a placeholder in a follow-up — it was left alone
  in this commit rather than mixed into an unrelated push.
- 2026-08-19 (twenty-sixth pass, same day) — **"reload project dont show": the Student list tab was
  absent because dev was not reading the live sheet.** The code was correct; `csvUrls.trips` in
  `config.local.json` pointed at the curated 13-column fixture, which has no `Student List (link)`
  column, so nothing could render. Confirmed by fetching the published CSV directly: the live sheet
  now has 15 columns including `Student List (link)` at position 8 (plus new `Grade Photo` and
  `Hero Section Photo`, which nothing reads yet). Dropped `trips` from `csvUrls` so local dev reads
  the live published workbook, and the tab appeared with the school's REAL links — and usefully, the
  two batches point at different gids of one spreadsheet (`gid=0` and `gid=1780253530`), confirming
  the per-batch scoping was the right call. Only g7 has the cell filled; other grades correctly show
  no tab. Recorded the `csvUrls.trips` trap in the data-layer notes: check it first when a fresh sheet
  edit does not appear locally.
- 2026-08-19 (twenty-fifth pass, same day) — **New "Student list" tab after Itinerary** ("take list
  links in the sheet of trip app main sheet"). `BATCH_LINK_COLUMNS` gained a `Student list` entry with
  six header aliases, since the column is not in the workbook yet — batch-scoped, because a list is a
  batch's travelling group. The tab renders `ItineraryCards` with `kind`/`action` parameterised rather
  than a second near-identical component. Verified by temporarily adding a synthetic
  `Student List (link)` column to the gitignored fixture (**restored afterwards, confirmed back to 13
  columns**): the tab appeared in the right position with correct batch/dates/sections/hrefs, the
  Itinerary tab kept its own wording, and removing the column made the tab vanish — no empty tab is
  ever published. Flagged to the school that this is the first parent-facing route to a class list and
  that the consent/sharing call is theirs; the no-roster rule still holds for anything the app renders.
- 2026-08-19 (twenty-fourth pass, same day) — **The itinerary row was redesigned as filled cards, and
  the Drive cover image was abandoned** ("like itinary box fill colour show itnary somthing redesign
  this page"). The school's screenshot settled the open question from the previous pass: the thumbnail
  does not load in a real browser either, so `drive.google.com/thumbnail` is unusable for files that
  are not shared "anyone with the link" — the `cover` prop was **deleted** from `DocCard` rather than
  kept behind a flag, and `.orient-box.is-cover`, `itineraryLabel` and `stripBatchSuffix` went with it.
  New `ItineraryCards` + `.itin-card`: a navy panel per batch with an amber `B1`/`B2` pill, the batch's
  dates as a Fraunces heading, its section list, and an "Open the day-by-day plan ↗" line pinned by
  `margin-top: auto`. All of it comes from `trip.batches`, already in memory for Overview, so the row
  cannot render empty. Measured 1280x720: 589x175 cards, 20px gap, both actions at the same y, **0
  images and 0 iframes**; 1920x900 899x181; 375x812 stacked, dates clamping 27 → 20px. Orientation
  re-checked after the `DocCard` edit — unchanged at 765px boxes, 282x159 frames, 4 live iframes.
  Clean console, clean build.
- 2026-08-19 (twenty-third pass, same day) — **Itinerary labels became "B1- Itinerary" and the
  guideline columns' own type grew.** New `itineraryLabel()` joins batch and name into one string with
  the dash the school typed, which meant dropping `batchTag` from those cards — a pill cannot carry a
  hyphen that joins it to the following word — so Itinerary and Orientation now differ deliberately:
  chip on one, prefixed label on the other. Verified 0 `.doc-batch` chips in the itinerary box and
  labels reading exactly "B1- Itinerary" / "B2- Itinerary" at 1280x720 and 375x812.
  For "Safety and do/ dont - increase font size": `.chip-head h4` 15 → 19px, `.chip-count` 12 → 13px,
  `.chip-lines` and its `li` 14 → 16px; heads confirmed still fitting with 0 overflow on a 375px phone.
  **Stated plainly to the school and recorded above: both those columns render a published Slides deck
  in an iframe on g7, so the body text they can see is inside Google's document and cannot be resized
  from here** — only the headings, the count pill and the text fallback responded. Clean console, build.
- 2026-08-19 (twenty-second pass, same day) — **"Parent orientation" and "Student orientation" are now
  full section headings** ("show this text bold font same in oritation do for parent oritation and
  student oritation", with a screenshot of a serif "Orientation" head and its amber rule).
  `.orient-group > h4` dropped the 13px/800 uppercase caption for the display treatment: Fraunces at
  `--display-weight`, `clamp(25px, min(2.5vw, 4.2vh), 38px)`, sentence case, and a 44x3 `--amber`
  `::after` rule (10px above, centred on the stage). Confirmed byte-identical to a live `.section h3`
  on the Travel details tab — same family, 600, 30.24px, `none`, -0.3024px, `rgb(15,23,42)`, and the
  same rule geometry and colour. Clamp checked at three sizes: 25px on a 375px phone (one line, no
  overflow), 30.24px at 1280x720, 37.8px at 1920x900; heading-to-box gap holds at 14px. Clean console,
  clean build.
- 2026-08-19 (twenty-first pass, same day) — **The itinerary cover became a wide strip** ("decrease
  height and increase width"). Introduced `--orient-ar`, the frame ratio as a plain number, replacing a
  literal `16 / 9` that had been repeated in the frame's `aspect-ratio`, the frame's width and the
  box's width — three formulas that had to agree. `.orient-box.is-cover` now sets `--orient-ar: 2.6`
  (matching `tripCardPhotos`' 2.6:1 grade-card strips) with the height budget down again to
  `clamp(90px, 100dvh - 680px, 130px)`. Measured: frames 300x169 → **336x129** at 1920x900 and
  194x109 → **232x89** at 1280x720, boxes 784x335 → 856x295 and 571x275 → 648x255 — wider and shorter
  on both counts. Fallback checked: `var(--orient-ar, 1.7778)` leaves every preview outside an orient
  box at 16:9, and Orientation still measures 282x159 with four live iframes. Things to carry (slide
  previews, no `.doc-preview`) unaffected. Zero overflow at three sizes, clean console and build.
- 2026-08-19 (twentieth pass, same day) — **The itinerary links dropped the live embed for a cover
  image, and shrank** ("decrease the size dont show preview only show the like cover or image to take
  internet"). New `cover` prop on `DocCard` keeps `preview`'s 16:9 frame but skips the
  `preview && embed` branch, so the frame holds Drive's `thumbnail?id=…&sz=w1000` and the card is an
  `<a>` again. `.orient-box.is-cover` overrides only the two sizing variables (`--orient-h` cap 270 →
  170 with `- 640px`, gap 48 → 32), leaving the width formula and chrome shared with Orientation.
  Measured: **0 iframes** in the itinerary box at every size; box 784x335 with 300x169 frames at
  1920x900, 571x275 with 194x109 at 1280x720, 335px with 237x133 on the phone; 32px doc gap, 22px
  sides. **NOT verifiable in this environment:** `drive.google.com/thumbnail` errors in the preview
  pane (a same-origin control image loaded, so it is the host, not the code — the same block recorded
  on 2026-08-17), so the icon fallback is what renders here. The URL was confirmed correctly derived
  from the doc id. Needs one look in a real browser, and the file must be shared "anyone with the
  link" or it will 403 to the icon in production too. Orientation still uses live embeds — the school
  changed only the itinerary.
- 2026-08-19 (nineteenth pass, same day) — **The Itinerary batch links got Orientation's box** ("make
  size big ang give image or colour show cearlly"). They were `compact` DocCards with no medium at all,
  so B1's and B2's itineraries were indistinguishable; now they are `preview` + `eager` + `batchTag`
  cards inside a reused `.orient-box`, so the tint and 2px border supply the colour, the live document
  iframe supplies the image, and the sizing comes from the same `--orient-h` / `--orient-gap` variables
  as Orientation instead of a parallel set. New `stripBatchSuffix` removes the generated "— Batch N"
  from the label now that the chip carries it. Dead `.itin-top` / `.itin-docs` rules deleted along with
  `.is-stage .itin-top` — no JSX referenced them after the move. Guideline columns below still intact, zero horizontal
  overflow. Clean console, clean build.
- 2026-08-19 (eighteenth pass, same day) — **Bigger boxes, with the extra width going into the gap
  between the two decks** ("increase the size of the box and maintian the gap in docs that side area
  cover"). `--orient-h` cap 240 → 270 and a new `--orient-gap` 20 → 48px, and the box's derived width
  now reads that gap instead of a hard-coded 20 — `min(100%, calc(var(--orient-h) * 32 / 9 +
  var(--orient-gap) + 148px))` — so the two tunable numbers are variables and only the padding
  constant is a literal. `.orient-row` reads `gap: var(--orient-gap, 20px)`, the fallback covering
  rows outside a box (the itinerary's card, verified still at 20px). Measured at 1920x900: box 1021 →
  1156px, doc gap 20 → 48px, frames 425x239 → 478x269, sides still 22px. 1280x720 is budget-bound so
  its frames stay 282x159 and only the box grows, 737 → 765px. Phone unchanged. Clean console, build.
- 2026-08-19 (seventeenth pass, same day) — **The orientation boxes now hug their cards** ("side have
  many margin", with the two empty ends circled). The box ran the full column while its two cards
  needed 978px of 1395, so ~208px sat empty inside each end. `width: fit-content` was the obvious fix
  and was wrong: fit-content sizes a shrinkable flex item from its max-content rather than its
  `flex-basis`, so the cards fell 479 → 356px and the frames 425 → 302px — it hugged by shrinking the
  previews, which is not what was asked. Sized from the frame's own variable instead —
  `min(100%, calc(var(--orient-h) * 32 / 9 + 168px))` — which required moving `--orient-h` from the
  card up to `.orient-box`, since a child's custom property is invisible to its parent. Measured:
  1920x900 box 1021px with 22px inside each end and frames held at 425x239; 1280x720 box 737px, frames
  282x159; 375x812 box full-width 339px, frame 241px. Box centred on the heading's axis at every size,
  zero horizontal overflow. Clean console, clean build.
- 2026-08-19 (sixteenth pass, same day) — **The Orientation tab read as zoomed in on a large screen,
  and its top margins were too tight** (school screenshot at ~1859x895). Two separate causes.
  (1) `--orient-h`'s CAP is the only number a big monitor sees: the budget resolved to 335px there so
  the 320px cap put frames at 567x319, where 1280x720 was still bound by the budget at 160px. Cap
  320 → 240 gives 425x239 on the big screen and leaves 1280x720 at 282x159, untouched. (2) With the
  section head removed two passes earlier, the first group heading was the panel's first line sitting
  16px under the sticky nav; `.orient-groups { margin-top: 14px }` takes it to 30px, and the
  heading-to-box gap went 10 → 14px in both the base and `.is-stage` rules. Verified at 1859x895,
  1280x720 and 375x812 — margins 30/14/34 at all three, frames 425x239 / 282x159 / 241x136, exact
  16:9 everywhere, zero horizontal overflow. Clean console, clean build.
- 2026-08-19 (fifteenth pass, same day) — **The group headings moved outside the box, the gap between
  the groups grew, and the boxes shrank** ("parent oritation and student heading both outside the box
  please make box gap and decrease the size of the boxes"). New `.orient-box` wrapper in
  `OrientationSection` holds the border, fill, shadow and padding; `.orient-group` is now purely the
  stack of `h4` + box with a 10px gap, and `.is-stage .orient-group { gap }` changed meaning from
  heading-to-cards to heading-to-box. Box padding 24/26 → 18/20, group gap 24 → 34px, and `--orient-h`
  from `clamp(150px, 100dvh - 470px, 460px)` to `clamp(140px, 100dvh - 560px, 320px)` — the stacking
  pass had overshot at 442x249. Verified at 1280x720: headings confirmed outside their box by DOM
  containment, 10px above it, 34px between groups, frames 282x159 at exactly 16:9, boxes 325/349px
  tall (was 461), page scroll down to 220px from 400. At 375x812: same structure, 241x136 frames, zero
  overflow. Clean console, clean build.
- 2026-08-19 (fourteenth pass, same day) — **Parent and Student orientation now stack, one full-width
  box per row** ("box size increase"). Diagnosed first: the previews were not limited by the
  `--orient-h` height budget at all but by their card's width — four frames across one row, less two
  group gutters and two lots of box and card padding, left them 209x117px. `.orient-groups` went from
  `repeat(auto-fit, minmax(280px, 1fr))` to `1fr`, and each frame now takes the full budget: **442x249
  at 1280x720, exactly 16:9, 2.1x linear and ~4.5x the area**. The cost is the tab scrolling ~400px
  instead of fitting one screen, which the school chose knowingly when offered the alternative (a
  padding trim inside the side-by-side layout, worth only ~30px). Phone: 229x129 frames, groups
  full-width, zero overflow. **Open risk carried forward:** the 2026-08-17 reason for side-by-side —
  a one-batch grade leaving ~350px of empty box — applies again, and only g7 (two batches) exists in
  the local fixture, so this is unverified for g9/g11-style single-batch grades.
- 2026-08-19 (thirteenth pass, same day) — **The B1/B2 chip stopped covering the deck preview.**
  `.doc-batch` was absolutely positioned at the card's top-right, which put it on top of the live
  Slides frame — the school saw the batch code printed over their first slide and asked for the label
  line instead: "[B1] Students Orientation details". It is now the first inline element inside
  `.doc-label` (`display: inline-block; vertical-align: 2px; margin-right: 8px`), so it sits in the
  text flow and can cover nothing. A flex-sibling version was written and rejected first: it cost the
  label ~42px of column on every line and the identical text wrapped to 3 lines in one card and 2 in
  its neighbour. Inline, all four labels measure 207px over 2 lines. Verified no chip overlaps its
  frame at 1280x720 or 375x812, Itinerary's chip-less cards unchanged, zero overflow, clean console
  and build.
- 2026-08-19 (twelfth pass, same day) — **The orientation boxes were opened up** ("increase margin in
  box and orientation docs"): box padding 16/18 → 24/26px, heading-to-cards gap 10 → 16px, gap between
  the B1 and B2 cards 14 → 20px, gutter between the two groups 18 → 24px, and the stacked
  `margin-top` 18 → 22px. The stage's `gap: 8px` density override was lifted to 16px so it stops
  fighting the base. With the border now 2px, the old padding framed the cards instead of containing
  them, and the card gap had to beat the box's own padding or B1 and B2 read as one block. Verified at
  1280x720: 24/26 padding, 16px under the heading, 20px between cards, 24px gutter, boxes equal at
  30-628 and 652-1250 and 352px tall; 375x812 stacked full-width 24px apart; zero overflow at both.
- 2026-08-19 (eleventh pass, same day) — **The orientation group boxes were strengthened** ("border
  and box more highlight show more difference"). Measuring first showed why the previous pass read as
  nothing: `--wash` behind the group is 1.044:1 against the page and the white cards on it 1.081:1, so
  the fill was doing no work at any tint the kit offers. Switched the load to the border — `2px solid
  #b4bdda` at 1.806:1 against the page, up from a `--line-2` hairline at 1.07:1 — kept `--link-bg` as
  a ground for the white cards, and added `--shadow-hero` for when the two boxes stack on a phone with
  no gutter between them. 2px because a 1.5px border computed back as `1px`, rounded away at DPR 1.
  Verified: 2px `rgb(180,189,218)` both boxes, equal at 30-631 and 649-1250, 335px tall; 375x812
  stacked full-width 18px apart; zero overflow at both. Clean console, clean build.
- 2026-08-19 (tenth pass, same day) — **Parent and Student orientation each sit in their own
  outlined box** ("like minor border box to show difference"). `.orient-group` took `1px var(--rule)`,
  18px radius and 16/18px padding, deliberately with no background: the cards inside are white
  panels, so a fill would nest a box in a box, and `--rule` sits one step lighter than those cards so
  the frame reads as a grouping rather than another card. Verified at 1280x720 — two equal boxes,
  30-631 and 649-1250, 333px tall, 18px gutter — and at 375x812 stacked full-width, 18px apart, zero
  overflow at both. Clean console, clean build.
- 2026-08-19 (ninth pass, same day) — **The Orientation tab lost its head and gained fixed card
  labels.** The school's note: remove "Before the trip" and "Orientation", bold the two group labels,
  and label the cards "B1- Parents Orientation details" and so on. So `<Section id="orientation">`
  now takes no `eyebrow` or `title` (the tab already says the word — it was appearing three times on
  one screen), `.orient-group > h4` went 700/`--soft`/12.5px → 800/`--ink`/13px since those labels are
  now the only headings on the tab, and a new `ORIENTATION_LABELS` map overrides `d.label` per
  category, with the existing `batchTag` chip supplying the `B1`/`B2` half. That deliberately reverses
  the 2026-08-17 "use the sheet's own chip name" rule **for this section only**, so a file renamed in
  Drive can no longer change the page's wording. `titled: true` was left in place on purpose.
  Verified on g7: four cards reading B1/B2 + Parents/Students Orientation details, no `.section-head`
  in the panel, headings computed at 800 `rgb(15,23,42)`, zero overflow at 1280x720 and 375x812.
- 2026-08-19 (eighth pass, same day) — **The Overview paragraph is justified on a wide window and
  left-aligned on a phone** (*"text align starting and ending point same line make same"*, with a
  screenshot of the centred version where every line had its own start and end). `.home-body-text`
  takes `text-align: justify` in every layout, and `.is-stage` adds `text-align-last: center` so each
  paragraph's unstretchable final line sits under the centred lead rather than hanging off an edge —
  `white-space: pre-wrap` means the line before the sheet's blank line counts as a last line too,
  which is what keeps the two paragraphs reading as two.
  **Justification comes off below 720px, because it measured badly.** Word gaps in the same
  paragraph, natural space 2.7px: at 375x812 justify stretched it to a median of 13.5px and a worst
  case of 17.9px (5x and 6.6x — rivers); at 1280x720 it needs only 4.6px median, 9.5px worst (1.7x).
  A ~339px measure has too few gaps to absorb the slack, so the phone keeps the left edge and gives
  up the right. Verified: 1280x720 four flush lines all 320→945 with the two final lines centred;
  375x812 every line starting at 18 with all gaps back to 2.7px, zero overflow at both.
- 2026-08-19 (seventh pass, same day) — **The school rewrote the login copy again**, and the
  privacy promise they had deleted one pass earlier came back as the second sentence of the first
  panel ("You will only have access to the trip details relevant to your child's grade"). Both rules
  gained a credential clause, and "school's email id" arrived — their phrase, kept. Added a terminal
  full stop to all three, which their draft omitted; noted as the one liberty taken. The longer copy
  spent the ~45px of slack the previous two passes had freed and ran 8px past a 1280x720 window, so
  `.login-form` 24→20 and `.auth-card` 26→22 in the `max-height: 820px` block bought 12px back —
  card 38-710 in 720, `scrollHeight === innerHeight`. Hanging-dash alignment still holds at one line
  start (767 at 1280, 84 at 375, 8 wrapped rule lines on the phone), zero overflow either way.
- 2026-08-19 (sixth pass, same day) — **"You will only see the trip details for your own child's
  grade" was removed from the login card** at the school's request. The heading now runs straight into
  the instruction panel, with `.auth-card h2` carrying the whole 22px gap; the `.auth-card .lede` base
  rule and its `max-height: 820px` trim went with it (`.lede` survives for `.dash-head` on the
  picker). Login is down to heading → instruction → rules → field → Continue → policy line. Verified:
  no `.auth-card .lede` in the DOM, 22px heading-to-panel gap at both 1280x720 and 375x812, zero
  overflow either way. It also freed ~50px, so the card sits 74-674 in a 720 window — the height
  budget has real slack again for the first time. Clean console, clean build.
- 2026-08-19 (fifth pass, same day) — **The grade rules were laid out as a ragged two-column table
  and are now left-aligned paragraphs** (*"text align left side"*, with a screenshot). `.field-note >
  li` was `display: flex`, and since each `li` holds a `<strong>` label plus a bare text node, flex
  made them two columns — "Grade 7 onwards:" wraps inside its own column, so the body text of the two
  items started at different x positions. Replaced with a hanging dash: `position: relative` +
  `padding-left: 16px` on the `li` and the `::before` absolutely placed in that gutter, leaving the
  label and sentence as ordinary inline flow. Measured every line box in the panel starting at one x
  (778 at 1280x720, 84 at 375x812), dash hanging 16px left, zero horizontal overflow at both. The
  panel also lost a wrapped line (128 → 109px), so the card now sits 49-699 in a 720 window with
  ~19px of budget back. Clean console, clean build.
- 2026-08-19 (fourth pass, same day) — **Both login panels moved ABOVE the field**, the school
  settling the layout by drawing it: instruction → rules → label → input → Continue. So the reader
  finishes reading before typing instead of finding a rule under their hands afterwards, and the two
  matched panels are adjacent, which is what makes them one instruction rather than two. In the JSX
  the `.field-note` list simply moved ahead of `.field`; in CSS its `-2px` top margin (which existed
  to tuck it under the input) went, and the margins became 14px between the panels and 18px before
  the label. That put the card 2px past a 1280x720 window, so `.field-note { margin-bottom: 14px }`
  joined the `max-height: 820px` trims — five now. Verified: DOM order lede@237 → note@310 →
  label@456 → input@479 → Continue@546, card 39-709 in 720, `scrollHeight === innerHeight`, and at
  375x812 the same order with zero horizontal overflow. Clean console, clean build.
- 2026-08-19 (third pass, same day) — **The two login blocks were given the SAME panel style**
  (*"keep text one side upper and lower to text field"*), correcting the pass below, which made the
  upper half plain text on the reasoning that two tinted boxes around one input would read as two
  warnings. The school's reading wins: matched, they read as one instruction the field sits inside.
  `.field-lede, .field-note` is now one rule for tint, border, radius, size and leading, with only
  the margins separate. The ~24px of new padding and border took the card 38px past a 1280x720
  window, so the `max-height: 820px` trims were retuned (`.login-form` 32→24, `.auth-card` 32→26,
  `.lede` 22→14, `.field-lede` 14→10) — 40px back, chrome only, the verbatim copy untouched.
  Verified: both panels identical (`rgb(244,246,252)`, 1px `rgb(233,236,243)`, 14px radius,
  12.5px/19.375px), card 39-709 in 720, `scrollHeight === innerHeight`, and at 375x812
  `scrollWidth - innerWidth` is 0 with both panels 269px wide. Clean console, clean build.
- 2026-08-19 (second pass, same day) — **The login instruction now brackets the sign-in field**
  (*"make upper and lower of signing field this text"*). The school restated its 2026-08-17 copy, so
  the wording is unchanged; only the placement moved. "Parents should sign in using the email address
  or mobile number registered with the school" left the card's top `.lede` for a new `.field-lede`
  directly above the input, and the two grade rules stayed in `.field-note` below it — what to type,
  then who may type it, read top to bottom. `.field-lede` is plain muted text rather than a second
  tinted panel, because two panels around one input read as two warnings. The `.lede` kept the
  privacy line by itself. Verified in the browser: order is lede → sentence → field → two rules →
  Continue; at 375x812 `scrollWidth - innerWidth` is 0 and every block measures 269px wide with the
  sentence at y 806-871 and the input at 908; clean console, clean build.
- 2026-08-19 — **The trip page shows every batch to everyone.** The school's reason is churn, not
  layout: *"some student in future change trip batch thats why i decide show all batch"* — a page
  filtered to the batch the sheet lists a child's section against goes stale the moment a student
  moves, and shows them the wrong train with full confidence. `assembleTripApp` dropped `mine`
  entirely; `batches`, `travel`, `media` and the per-batch document columns read `all`, which is
  exactly what staff already saw, so parent, student and staff now read the same third screen.
  Login and the grade/child picker were left alone on instruction. `section` still flows all the way
  in and `matched` / `batchMatched` still compute — as a **sheet-data signal only** now, and the
  console warning was reworded so it no longer claims a fallback. Verified in the browser as a real
  Acuity parent (Batch 1, previously blind to Batch 2): both Overview batch cards with their own
  section lists, both travel blocks, **B1 B2** on both orientation rows; clean console, clean build.
- 2026-08-17 (twentieth pass, same day) — **Orientation decks now preview live in a big 16:9 box**
  ("make box big like fix screen preview in box like ppt docs or slde prviw all things fit on screen"),
  reversing the 2026-08-14 `compact` cards. New `describeDoc().embed` (`/embed` for Slides, `/preview`
  for Docs/Sheets/Drive files) and a `preview` prop on `DocCard` that frames it, with the thumbnail and
  the typed icon as fallbacks inside the same fixed-ratio box. A framed card is a `<div>` because an
  anchor may not contain an iframe. Three measured sizing lessons are written up above: the frame is
  width-driven from a height budget, the card needs a definite basis or the percentage width resolves
  against the label's max-content width (302px instead of 434), and a preview row needs `nowrap` because
  flex wraps before it shrinks (staff's four decks made four rows and 403px of scroll).
  **Two things this environment could not verify, and one it disproved:** Drive thumbnails are blocked
  in the preview pane — every `drive.google.com` / `lh3.googleusercontent.com` image errors while a
  control favicon loads — so the thumbnail path is unverifiable here; framing docs.google.com does work
  (all four frames fire `load`); and the earlier "the pane blocks Google" reading was wrong, it blocks
  images and not frames. **Also measured, and the real blocker: 5 of the 7 orientation decks answer 401
  anonymously**, so those boxes will show Google's request-access page until the school shares them, and
  no client-side check can detect it. Build clean, console clean.
- 2026-08-17 (nineteenth pass, same day) — **Back to tabs** ("now first convert this tabs wise"), which
  is `TRIP_LAYOUT = 'stage-tabs'` — but switching alone would have thrown away the phone menu, since
  `TripStage` still had its own inline pill strip while the menu lived in the one-page nav. So the two
  navs were merged into one `StageNav` with a tab mode and a jump mode: same pills, same phone menu, and
  in tab mode the trigger names the section you are on and the open list marks it. **A line-range replace
  was needed to do it** — a brace-matching script cut the old component short and left a stray `}) {`,
  which is worth remembering: `git checkout --` the file and redo it by explicit boundaries rather than
  patching the wreckage. Verified at 1907×878: six tabs, one panel at a time, the active tab and the
  hidden menu label both following the selection, arrow keys / Home / End / wrap-around and roving
  `tabIndex` all intact with the window never scrolling, only Things to carry scrolling the page (162px,
  its deck). At 375×812: strip hidden, trigger reading the current section, six 44px rows inside the
  window, choosing one switching the panel and closing the menu. `'stage'` re-checked and still a
  one-page layout with anchors, a "Sections" trigger and jumps landing flush. Build clean, console clean
  in a fresh tab — the 500s in the old one were the file mid-refactor.
- 2026-08-17 (eighteenth pass, same day) — **"A Grade 7 student's address is refused" — it was the
  local fixture, not the code.** The school sent the roster row beside the refusal. Probed the live
  endpoint with that exact address first: production answered **200 with `signedInAs: 'student'`**,
  so the rule shipped correctly and only local dev disagreed — `public/local-roster/students.csv`
  predated the `StudentEmailID` column, so no student address could match there. Measured the live
  feed while confirming: 29 columns, 2618 rows, and **`StudentEmailID` filled in every one of them**,
  which closes the open question from the previous pass. Rebuilt the local copy with the same 19
  columns stripped plus `StudentEmailID` (still gitignored, still 10 columns). Re-verified locally:
  the Grade 7 student signs in as `student` with "My trip", a **Junior KG student's own address is
  refused** while that child's parent address signs in as `parent` for grade `jk`. No code change —
  the lesson is that a stale local roster copy reads exactly like a broken feature.
- 2026-08-17 (seventeenth pass, same day) — **Students may sign in from Grade 7; Grade 6 and below
  stay parent-only.** The school's rule, implemented as one matcher — `matchStudent` in
  `lib/identity.js` — that the server function, the client fallback and `AuthContext`'s last-resort
  filter all call, replacing three separate `s.emails.includes(value)` lines. `StudentEmailID` is
  collected into `studentEmails`, kept out of `emails` because the two carry different rights, and
  gated by `allowsStudentLogin` / `STUDENT_LOGIN_FROM_GRADE`, which is deliberately independent of
  `isComingSoon`. A refused junior student gets the same reply as an unknown address so the endpoint
  still cannot be used to enumerate the roll; the rule is explained on the login screen instead.
  Sessions carry `signedInAs`, and the top bar says "Student account" / "My trip".
  Verified three ways: ten cases through the real csv/normalize/identity modules (parent by email and
  by mobile, G7/G9/G12 students, mixed case, G5 and Senior KG refused, unknown refused); the server's
  `resolveParent` against a stubbed roster feed — correct statuses, `signedInAs`, the student greeted
  by their own name, and **no DOB, blood group, address, phone or email in any response**; and the
  real login path in the browser by temporarily adding a synthetic `StudentEmailID` column to the
  gitignored fixture (since restored) — a Grade 7 student signed in to their own row with "My trip",
  a Grade 5 student was refused, and the student could open `/trip/g7` but got "Not your child's
  grade" with **0 fetches** on `/trip/g8`. Build clean, console clean in a fresh tab (the `useAuth`
  errors in the old tab were the documented Fast-Refresh false alarm).
- 2026-08-17 (sixteenth pass, same day) — **Pushed and live.** `489271b` on `main` carried the whole
  day: the one-page centred trip layout with its four alternates behind `TRIP_LAYOUT`, the Fraunces +
  Manrope type change, the phone menu, the section order, the density pass, the Batch 2 labelling fix and
  the rotated Slides URLs. Scanned the staged diff first — no addresses, phone-shaped numbers, roster URLs
  or API keys, and `local-roster/`, `config.local.json` and `.env` all confirmed still gitignored. Netlify
  auto-deployed within ~40s and production was verified: the live bundle hash matches the local build
  (`index-DW2l4jPy.js`), `/config.json` serves the corrected deck mapping (each key's published URL now
  answers with its own title), `/trip-photos/g7.jpg` is 200 `image/jpeg`, and `/local-roster/students.csv`
  and `/config.local.json` both return the SPA index rather than their contents — **bodies checked, not
  status codes**, since the SPA rule answers 200 for anything.
- 2026-08-17 (fifteenth pass, same day) — **The jump nav became a menu on phones** ("in phone view tabs
  like menu make responsive"). At 375px the pill strip was 652px wide in a 373px window with its scrollbar
  hidden, so two thirds of the sections were unreachable-looking. New `StageJumpNav` renders both shapes
  and CSS picks one at 720px — the width where the strip stops fitting (652 against 661 of available
  width at 721px). The phone shape is a "Sections" button with a hamburger and a chevron that turns over,
  opening a card of six 44px rows; Escape, a tap outside and choosing an item all close it, with the
  listeners bound only while open. Verified at 375×812: strip hidden, button 339×45, list 339×282 entirely
  inside the window and painting above the page, no horizontal overflow open or closed, and a pick landing
  its block flush under the sticky bar with the hash updated. Desktop unchanged at 1907 and 760.
  **Also learned, and worth more than the menu:** CSS transitions never progress in this preview pane, so
  a transitioned value always reads back as its starting value — which sent me down a wrong path
  ("`transform` does not apply to `<svg>`") before switching the transition off proved the rotation was
  always correct. Written into the verification notes. Build clean, console clean. **Not pushed.**
- 2026-08-17 (fourteenth pass, same day) — **Section order set by the school**: Overview · Orientation ·
  Itinerary · Travel details · Things to carry · Photos, replacing the 2026-08-14 order that had Itinerary
  and packing ahead of Orientation. Two `push` moves in `buildSections`, which is the single source of the
  order for the jump nav, the one-page block order and both tabbed layouts alike — verified that all of
  them followed. The `travel` label became **"Travel details"** so the nav agrees with the heading over the
  cards. Verified at 1907×878 and 375×812: nav and blocks in the asked-for order, every jump landing flush
  under the sticky bars (Photos clamps at the end of the document, as it must), strip fitting at 652px on
  desktop and scrolling sideways on a phone, no horizontal overflow, nothing painted below the page, and
  `'stage-fit'` re-measured with zero clipped elements on all six tabs. Build clean, console clean.
  **Not pushed.**
- 2026-08-17 (thirteenth pass, same day) — **The three Google Slides URLs were assigned to the wrong
  sections, and the duplicated "Things to carry" heading went with the fix.** The school's screenshot showed
  Safety framing the do-and-donts deck, Do's and don'ts framing things-to-carry and Things to carry framing
  safety — the three links in `config.slidePreviews` had been pasted one position rotated. Confirmed
  independently by fetching each published URL and reading its `<title>`
  (`safety-guidelines-poster` / `do-and-donts` / `things-to-carry`), rotated them back in the committed
  `public/config.json`, and re-verified by matching every card's iframe `src` to both the config value and
  the file's title. **A deck's URL says nothing about its contents, so nothing in the code can catch this**
  — the check is now written into `config.json`'s own note. Also dropped the carry card's head where it
  frames a deck: the block heading above it says the same words, and the deck took the 63px (page 3753 →
  3656 at 1907×878). Build clean, console clean. **Not pushed — and this one needs a deploy, not just a
  sheet edit, because the pointer lives in the deployed config file.**
- 2026-08-17 (twelfth pass, same day) — **A Batch 2 parent was shown "Batch 1" everywhere; fixed.** The
  school sent the sheet beside the page: Acumen is listed against Batch 2, and the pill, the headline, the
  orientation tags and the travel block all said Batch 1. The dates and sections were their child's — only
  the label was wrong, and it was wrong because `batchLabels` ran on `mine` (already filtered to the one
  matched row) rather than on the whole group, so the position that distinguishes the rows when the
  sheet's text repeats had already been discarded. `assembleTripApp` now labels `all` once into a `labelOf`
  Map that `batches`, `travel` and `documentsFrom` share, `documentsFrom` takes the map instead of
  deriving its own, `batchLabelsCollided(all)` makes the sheet-typo warning reach a single-batch parent,
  and `stripBatchPrefix` drops the cell's own "Batch N:" from the headline now that the pill beside it is
  authoritative. Verified with a real Acumen parent against the fixture that reproduces the typo: pill
  "Batch 2", headline "13-20 December 2026", cards B2 B2, travel "Batch 2", Overview meta Batch 2 — and a
  Cognizance parent unchanged on Batch 1, staff still seeing both batches correctly numbered on g7, g8 and
  g10. Build clean. **Not pushed.**
- 2026-08-17 (eleventh pass, same day) — **Density pass on the one-page trip view**, after the school
  sent a screenshot of the Orientation and Travel blocks with the note "this is like take more space":
  two labels and two small cards stacked down the middle of the column, then a travel card with four short
  lines in 30px of padding. Nothing was removed from the page. `OrientationSection` gained an
  `.orient-groups` grid so parent and student decks sit beside each other (block 528 → **303px**), the
  cards were allowed to fill their half at 420px instead of a 270px basis, block padding went 40 → 28 (22
  on a phone), the section gap 24 → 16, the heading rule 14 → 10 and the travel card 30 → 22/24. Page
  **4110 → 3734px** at 1440×900, 3998 → 3868 at 375×812, and `'stage-fit'` re-measured with zero clipped
  elements on all six tabs — the change makes the fitted variant shorter too. Build clean, console clean.
  **Not pushed.**
- 2026-08-17 (tenth pass, same day) — **The tabs came off: the trip page is ONE page in the stage
  design.** "Remove tabs like different page make single page with header" — the fourth answer to the same
  question that day, so `TRIP_LAYOUT` is now five values and the tabbed variants were renamed
  (`'stage-tabs'`, `'stage-fit'`) rather than removed. New `TripStagePage` renders Overview as a
  full-bleed **72dvh cover** — deliberately not the whole screen, so the next heading peeks and the page
  does not look finished at the fold — then every section stacked in the centred 1400px column with the
  pill bar demoted to a **jump nav of real anchors**. Itinerary and Things to carry gained
  `.stage-block-title`, styled to match the heads the section components render, since they had been
  relying on a tab label to name them; `titled: true` still suppresses it for the four that head
  themselves. `scrollToBlock()` subtracts only the bars that will still be on screen, read from their
  computed `position` — on a phone `.topbar` is `static` in this layout, so subtracting it would scroll
  the target under nothing. The footer comes back, since a long page ends better with one than without.
  **One bug found by measurement:** the cover block inherited `width: 100%` from its siblings, so the
  negative margins slid it 30px left instead of widening it and left a strip of canvas down the right
  edge — `width: auto` lets the flex stretch resolve it. Verified at 1907×878, 1440×900, 1280×720,
  1280×620 and 375×812: pages 3.7–4.1k tall, zero horizontal overflow, nothing painted below the
  document's scrollHeight, no internal scrollers anywhere, decks exactly ar 1.778 (1370×771 for packing at
  the school's window), every jump landing its block flush under the sticky bars, access control still
  fetch-free, console clean. All five `TRIP_LAYOUT` values build and were rendered. **Not pushed.**
- 2026-08-17 (ninth pass, same day) — **The stage was let go of the window: the page scrolls again, and
  a tab click scrolls it.** Asked as "same page scrollable make after the tab click switch scroll the web
  page", four hours after "fit on screen" — so the design was kept and only its relationship to the
  window changed. `TRIP_LAYOUT` gained `'stage-fit'` (the locked variant, unchanged and re-measured
  clean) and `'stage'` now means the scrolling one; `App` maps the value to `is-stage is-scroll` /
  `is-stage is-fit` through one object, which also decides the footer. New `scrollToPanel()` puts the top
  of the panel under the two sticky bars on every switch, **reversing the 2026-08-13 "a tab click must
  never scroll" rule** for this layout. The payoff is that **nothing inside a card scrolls any more**:
  Safety's eleven measures run down the page in one 645px card instead of four-at-a-time in a hidden
  scroller, and the decks are width-driven and bigger (564×317 / 1175×661 at 1280×720 against 452×254 /
  804×452). **Four things had to be got right and each was caught by measurement:** the two bars are
  measured rather than read from `--header-h`, which is 66 against a real 67 on desktop and a real
  **165** on a phone; a `--stage-nav-h` token was written, found to be 68 against a measured **69**, and
  deleted in favour of letting the flex chain size one screenful; `min-height: 0` had to come **out** of
  the `.page`/`.shell`/`.stage` chain, because a zero-basis flex item with it settles at its container's
  height and paints the overflow outside the page where it cannot be reached; and the sticky pair had to
  be undone on a phone, where `.stage-nav` would otherwise pin itself underneath a 165px header — the
  header goes `static` there and the tab bar pins at 0. Also fixed on the way: `TripBody` dispatched on
  `'stage'` only, so `'stage-fit'` fell through to the old underline-tab markup. Verified at 1907×878,
  1280×720, 1280×620 and 375×812, parent and staff, deck path and text path (`slidePreviews` cleared in
  `config.local.json` and **restored**), with all four `TRIP_LAYOUT` values exercised: nothing painted
  below the document's scrollHeight, no horizontal overflow, decks exactly ar 1.778, tab switches landing
  the panel flush under the bars, access control and the coming-soon short-circuit still issuing no
  fetch. Build clean, console clean in a fresh tab. **Not pushed.**
- 2026-08-17 (eighth pass, same day) — **The trip page redesigned as the STAGE, and the app changed
  typeface.** Brief: "redesign whole page, centre all things, change font, change style, cover whole
  page, fit on screen, totally redesign after click on grade". `TRIP_LAYOUT` gained a third value and
  defaults to `'stage'`; `'flow'` and `'fixed'` are untouched and were both re-measured clean.
  Fraunces + Manrope replace Instrument Serif + Plus Jakarta Sans app-wide, with `--display-weight`
  added because Fraunces' 400 is a text weight where the old face's was a display one. The page itself:
  a `--stage-w: 1400px` centred column on a washed canvas, the tab strip rebuilt as a centred segmented
  pill control, section heads centred under an amber rule, card contents centred, and **Overview
  bleeding to all four edges** as a full-cover photograph with the school's words centred on it. Long
  guidance stays left-aligned inside its card, deliberately. Vertical centring is `margin-block: auto`
  rather than `justify-content`, so a section too tall for the window scrolls from its top instead of
  being cut off at both ends. **Four sizing bugs were found by measurement and are written up above:**
  `aspect-ratio` never feeds a clamp back into the other axis (decks at ar 1.499 → fixed with
  `container-type: size` + `100cqh`), that container query collapses to zero once the cards stack (decks
  at **2×2px** on a phone), an auto inline margin overrides flex stretch (the packing card at 168×94),
  and `auto-fit` counts tracks from the track's *max* size (staff's two travel cards stacked). The
  Overview scrim was **measured, not eyeballed** — screenshots do not composite in this environment, so
  the gradient was composited over the photograph's own pixels in a canvas: the old bottom-weighted
  scrim gave the centred title 2.96:1 and the body 4.00:1, both under the WCAG minimum, and the new
  vignette plus text-shadow gives 3.49 / 8.94 / 5.13. Verified at 1907×878, 1440×900, 1280×720,
  1280×620 and 375×812, parent and staff, with the deck path and the text path (via a temporary
  `slidePreviews` clear in `config.local.json`, since **restored**): zero clipped elements, zero window
  scroll, decks exactly ar 1.778 everywhere, access control and the coming-soon short-circuit both still
  issuing no fetch. Build clean, console clean in a fresh tab. **Not pushed.**
- 2026-08-17 (seventh pass, same day) — **One-page scrolling trip layout, added as a switch and left
  UNCOMMITTED for review** ("all things in one page make webpage scrollable with header"). New
  `src/lib/layout.js` holds `TRIP_LAYOUT`; `'flow'` stacks every section, restores the footer and turns
  the tab strip into anchor jump links, `'fixed'` is the 2026-08-14 view unchanged. The work is almost
  entirely in undoing definite-height assumptions: every guideline list, rule stack, slide frame and the
  Overview banner size themselves from a fixed-height panel and **collapse to nothing** without one, so
  `.is-flow` hands back natural heights exactly as the ≤980px breakpoint does. No scroll-spy — anchors
  only. Verified at 1280×720 and 375×812: 4011px page, six blocks, all frames ar 1.778, no clipping, no
  horizontal overflow, jump targets clearing the sticky nav, clean console. **Then adjusted** ("make
  webpage show proper sapce other things header"): the four sections that render their own `Section`
  head were printing their heading twice, so they carry `titled: true` and `TripFlow` skips the label;
  inter-section spacing 86px → 64px; `.flow-title` restyled to match `.section h3` instead of being the
  odd serif in a sans column. Re-measured at 1440×900: zero duplicate headings, 64px separations, page
  4011 → 3852, jumps clearing the nav by 44–68px, no horizontal overflow at 375, clean console.
- 2026-08-17 (sixth pass, same day) — **The grade card now carries a photograph and names the trip on
  it.** New `config.tripCardPhotos` map + `tripCardPhotoFor()` (falls back to `tripPhotos`, then to the
  grade's colour and icon); `.pick-photo` fills the head and the icon is dropped where a photo exists;
  `.pick-label` prints the destination or "Coming soon" over a stronger bottom scrim, absolutely
  positioned so a late-arriving trip name cannot change the card's height. The body's duplicate trip
  line was removed. A coming-soon grade gets no photograph regardless of config. Grade 7's card photo
  is the Jaipur gate group shot, resized 3248×1432 → 1400×617, 1.7MB → 226KB. Verified: 14 cards all
  260–261px, label never overlapping the grade or section pill, no horizontal overflow at 1907 or 375.
  **Not pushed.**
- 2026-08-17 (fifth pass, same day) — **Safety, Do's and don'ts and Things to carry are now LIVE
  Google Slides embeds**, replacing the card-with-an-Open-link. New `GoogleSlidesPreview` component and
  `lib/slidePreviews.js`; the three published URLs live in `config.slidePreviews` under flat
  `"<gradeId>.<section>"` keys, so staff edits in Slides appear on the next page load with nothing to
  rebuild. `/pub` is rewritten to `/embed` (both frame, but `/embed` fits its box instead of bringing
  its own page chrome). Two things that took measurement to get right: the frame must be **height**-driven
  or a width-derived 16:9 box hangs below the window, and the loading skeleton must sit **behind** the
  iframe or the load event it waits for never fires. Verified at four viewports plus mobile — exact
  16:9, no overflow, no window scroll, no layout jump; grades without a deck fall back to the sheet's
  card or text unchanged. **Not pushed** — build clean, waiting on the go-ahead.
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
- 2026-08-18 — Photographs moved to Drive-hosted: `tripPhoto.js` rewrites any Drive share link to the
  thumbnail endpoint at the width each surface renders (banner 1600, card 1200), non-Drive URLs pass
  through. Driven by Netlify's credit billing, where bandwidth at 20 credits/GB makes the free plan a
  ~15 GB/month budget. Recorded that a cross-origin photo breaks the canvas contrast measurement.
- 2026-08-07 — Created skill from the single-file Trip Explorer artifact.
