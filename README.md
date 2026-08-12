# School Trips — Trip Explorer

A parent-facing React app for school educational trips. A parent signs in with their
registered email address or mobile number and sees the trip plan for their own child's grade
only — itinerary, safety guidelines, do's and don'ts, travel details, reminders, packing list
and the orientation decks as clickable previews.

Named staff can see every grade.

**This project runs on real data only.** There is no demo or mock mode. Anything not yet
configured simply has no source, and the app says so rather than showing invented content.

## Run it

```bash
npm install
npm run dev
```

Opens on http://localhost:5180.

```bash
npm run build
```

## What's connected, and what isn't

| Piece | Source | Status |
|---|---|---|
| **Roster / login** | the school's `StudentData.csv` feed, via `/api/lookup` | works once `ROSTER_CSV_URL` is set on the server |
| **Staff access** | `ADMIN_EMAILS` on the server | works once set |
| **Trip content** | a Google Sheet built from `sample-data/Trip Data.xlsx` | **no source yet** — every grade reads "Nothing published yet" |

The trip spreadsheet does not exist yet. Until the school creates and shares it, the app will
authenticate parents correctly and then show them an empty trip page. Build it from the empty
template in `sample-data/`, then paste its link into `sheetId` — see
[docs/WHERE-TO-CONNECT.md](docs/WHERE-TO-CONNECT.md).

## Server environment

Set these where the site is hosted (Netlify → Site settings → Environment variables):

| Variable | Purpose |
|---|---|
| `ROSTER_CSV_URL` | the roster feed the lookup function reads |
| `ADMIN_EMAILS` | comma-separated staff addresses that may see every grade |

Neither is committed. The roster feed is unauthenticated, so its URL does not belong in a
public repo, and publishing the staff list would reveal exactly which addresses unlock all
grades.

`ADMIN_EMAILS` is a comma-separated list, matched case-insensitively:

```
ADMIN_EMAILS=first.last@example.org,second.person@example.org
```

For local work with `netlify dev`, the same two variables go in a gitignored `.env` at the
project root. The deployed site never reads that file — Netlify's own environment variables
are the only thing that counts in production.

## Parent flow

Sign in → the parent's own child (or children) appears as a card → tap the card → the full
grade page: overview, documents, itinerary, safety guidelines, do's and don'ts, travel,
reminders, photos and videos, communication, packing list.

Trip content is **common to a whole grade** — every Grade 4 family sees the same itinerary and
the same photos. The only personal thing on either screen is the child's own name, so no parent
ever sees another family's child. The card step is shown even when a parent has just one child,
so the name they are entitled to is always confirmed before grade content opens.

## Configuration

`public/config.json` is read at page load, so pointers can change on a deployed site with no
rebuild. `public/config.local.json` overrides it and is gitignored — that is where local
development points at real data without touching what deploys.

In both files, `""` means "not set, fall through to the layer below" and `null` means
"explicitly clear whatever the layer below said".

Docs: [ARCHITECTURE.md](docs/ARCHITECTURE.md) (diagrams),
[WHERE-TO-CONNECT.md](docs/WHERE-TO-CONNECT.md) (where the sheet plugs in),
[SHEET-SCHEMA.md](docs/SHEET-SCHEMA.md) (columns),
[CONNECT-SHEET.md](docs/CONNECT-SHEET.md) (setup steps),
[DATA-HANDOVER.md](docs/DATA-HANDOVER.md) (brief for school management).

## How access control works

- Login matches an email against the parent-email column, or the **last 10 digits** of either
  parent's mobile. Either parent's number works.
- With `rosterApiUrl` set, the match happens **server-side** and the browser only ever
  receives `{id, name, grade, section}` for that parent's own children. No addresses, dates of
  birth or blood groups cross the boundary — which is why the roster is never fetched by the
  browser directly.
- Grade is derived once, in `AuthContext`, from the matched rows. No screen reads a grade from
  the URL. `/trip/:gradeId` checks `canAccessGrade` before mounting, so an unauthorised grade
  never triggers a fetch.
- Staff (`role: admin`) are scoped to every grade and get a grade picker instead of a child
  picker. They see trip pages only — there is no student-list view, deliberately.

### The verification gap

Typing an email that appears in the roster is not authentication. Anyone who guesses a
parent's address — or a staff address, which are institutional and predictable — gets in.
Setting `VITE_GOOGLE_CLIENT_ID` adds Google Sign-In, which proves the address. A magic link
sent to the registered address would do the same without requiring Google accounts. **One of
these should be in place before real parents use this.**

## Layout

```
netlify/functions/  lookup.js — server-side roster match (/api/lookup)
scripts/            generate_template.py (empty workbook), generate_setup_deck.py
sample-data/        the empty template the school fills in, plus the setup guide deck
docs/               contract, setup, architecture diagrams
src/
  auth/             AuthContext, roles, route guards
  components/       Icon, Section, DocCard, TopBar, states
  data/             adapters (sheets | api), CSV parser, row normalizers, useTrip
  lib/              grade/phone/identity parsing, Drive + sheet URL handling
  pages/            Login, ChildPicker, TripPage
  styles/           design tokens + global stylesheet
legacy/             the original single-file prototype, kept for reference
```
