# Connecting a real Google Sheet

## The one thing that matters most

**Treat the spreadsheet id as permanent.** The schema already holds many trips at once —
one row per grade in `Trips`, and every other tab is keyed by grade. A new trip is *new
rows*, not a new spreadsheet.

Do that and there is nothing to reconfigure, ever. Management edits the sheet, parents
refresh, done. Everything below is one-time setup.

---

Two modes, same code path.

| Mode | `config.json` | Needs Google? |
|---|---|---|
| Local CSV files | `csvBase` set to a path | no |
| **Real Google Sheet** | `sheetId` set to the share link | yes |

There is no demo mode. Anything unconfigured has no source, and the app says
"Nothing published yet" rather than inventing content.

---

## Step 1 — create the spreadsheet

1. Open [drive.google.com](https://drive.google.com) and make a folder, e.g. **School Trips**.
   Make it a **new** folder — not the existing "Educational trips" folder, which holds a
   trust deed and vendor agreements and must not be made public.
2. Drag **`sample-data/Trip Data.xlsx`** into it. It ships empty: headers, formatting and
   validation dropdowns only, so nothing invented can reach parents.
3. Right-click the uploaded file → **Open with → Google Sheets**.
4. **File → Save as Google Sheets.** You now have a real spreadsheet with all 8 tabs,
   header formatting, and a dropdown on every `Grade` column.
5. Delete the leftover `.xlsx` if you like.

The tabs arrive already named `Students`, `Trips`, `Itinerary`, `Documents`,
`Guidelines`, `Reminders`, `Travel`, `Media`. Don't rename them.

## Step 2 — share it

**Share → General access → Anyone with the link → Viewer.**

Without this the browser gets Google's sign-in page instead of data, and the app will
tell you so in plain words rather than failing silently.

> Read the privacy warning in [DATA-HANDOVER.md](DATA-HANDOVER.md#a-privacy-of-the-student-list--the-big-one)
> before doing this with real family data. Dummy data is fine.

## Step 3 — copy the link

Just copy the whole address bar. That's it — no gid hunting.

```
https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit?usp=sharing
```

Tabs are addressed **by name** (`Students`, `Trips`, `Itinerary`, …), so as long as the tab
names match, one link is the whole configuration. A bare file id works too.

> Renaming a tab breaks it, because the name *is* the address. If you must rename one, put
> its `gid` into `config.json` instead — a gid survives renames and always wins over the name.

## Step 4 — point the app at it

Edit **`public/config.json`** — not `.env`. This file is read at page load, so changing it
on a deployed site takes effect on the next refresh, with **no rebuild and no redeploy**.

```json
{
  "dataSource": "sheets",
  "csvBase": "",
  "sheetId": "https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit"
}
```

Two fields. Paste the link straight in — the id is parsed out of it.

`csvBase` must be empty for `sheetId` to be used at all.

`gids` stays available for the rename case above, but you should not normally need it.
`.env` still works as the fallback for anything left blank here, which is handy for local
development — but for anything deployed, prefer `config.json`.

### The `Settings` tab — moving a source elsewhere

The workbook ships with a `Settings` tab: `Key | Link | Notes`, one row per source.

**Leave every `Link` blank and it does nothing** — each source is read from the tab of the
same name in the same file. That's the normal case.

Paste a link into a row and *that source* moves to wherever the link points, with nobody
touching `config.json`. Useful when the student roster lives in its own spreadsheet, or when
one grade's coordinator keeps their own itinerary file.

| Key | Link |
|---|---|
| Students | `https://docs.google.com/spreadsheets/d/1OTHER…/edit#gid=0` |
| Trips | *(blank — use the Trips tab in this file)* |

A link with a `#gid=` addresses that exact tab; without one, the app looks for a tab named
after the key in the linked file. Only the eight known keys are read; other rows are ignored,
so you can keep notes in there.

Sign in as a real parent from the school roster. If their grade's trip page shows the
content you put in the sheet, you're connected. Before the sheet exists, a correct login
still lands on "Nothing published yet" — that means auth works and trip content does not
have a source yet.

### If the tabs are separate spreadsheet files

Leave the gids blank and give each sheet its own file id instead:

```
VITE_SHEET_ID_STUDENTS=1Abc…
VITE_SHEET_ID_TRIPS=1Def…
```

A per-sheet file id takes precedence over `VITE_SHEET_ID`.

## Step 5 — add the documents

Upload the school's real orientation decks, posters and itineraries to the grade folders,
share each **Anyone with the link → Viewer**, and paste their links into the `Documents` tab.

A document that is not shared publicly still opens for anyone who has access — it just shows
a plain labelled tile instead of a thumbnail.

---

## Optional — one folder row instead of one row per document

A `Documents` row whose `Url` is a **Drive folder** can expand into one card per file in
that folder. Management then drops a new deck into the folder and it appears on the site,
with no sheet edit at all.

One row:

| Grade | Label | Url | Category |
|---|---|---|---|
| Grade 7 | Orientation documents | `https://drive.google.com/drive/folders/1AbC…` | Orientation |

To switch it on:

1. Create an **API key** in the Google Cloud console, enable the **Google Drive API**, and
   restrict the key by HTTP referrer to your site's domain.
2. Put it in `config.json` as `driveApiKey`.
3. Share the folder **Anyone with the link → Viewer**.

Each file becomes a card. The filename becomes the label (extension stripped), and the
row's `Grade` and `Category` carry across to every card.

**Leave `driveApiKey` blank and nothing changes** — a folder row stays one plain link card,
exactly as before. A folder that can't be read is also left as a link rather than breaking
the section.

What you give up: a folder listing carries no label, category or order of its own, so all
files in one folder share the row's category and are sorted by name. Keep documents that
need distinct labels or ordering as individual rows. Mixing both is fine.

The key is read-only and only reaches files already shared publicly, so it grants nothing a
parent couldn't already open — but restrict it by referrer anyway so it can't be reused.

---

## Troubleshooting

**"The sheet is not shared publicly — Google returned a sign-in page instead of data."**
Step 2 was missed, or the link-sharing was set on the folder but not the file.

**A parent can't log in.** Their row has neither `FatherEmail` nor `FatherPhone` filled in,
or the email differs from the one they typed. Email must match exactly (case is ignored).

**One section is empty but the tab has rows.** The tab was renamed. Tabs are addressed by
name, so `Itinerary ` with a trailing space, or `Itinerary 2026`, is a different tab as far
as the app is concerned. Rename it back, or put its `gid` in `config.json`.

**A whole grade is missing.** Its `Grade` cell is spelled in a way the app can't read.
Use the dropdown. `Grade 7`, `7`, `Class 7` and `VII` all work; `Grade Seven` does not.

**A section is missing from the trip page.** That grade has no rows in the corresponding
tab. Sections only appear when they have content — this is deliberate.

**A document shows a plain tile instead of a picture.** That file isn't shared publicly,
or it's a Drive folder or a Google Form (neither can ever have a thumbnail).

**Changes aren't showing.** Content edits appear on refresh. `config.json` changes also
apply on refresh. Only `.env` changes need a dev-server restart or a rebuild.

**A folder row didn't expand.** No `driveApiKey` set, the folder isn't shared publicly, or
the API key is referrer-restricted to a domain that isn't the one you're on. The browser
console names which. The row falls back to a plain link either way.
