# Google Sheet schema

## Exact names — read this before naming anything

**File names are free — unless you connect a Drive folder.** If the app is given one
spreadsheet link, it never reads a file name and you can call things anything. If it is given
a **folder** link instead, it finds each spreadsheet *by file name*, and the files must be
called `Students`, `Trips`, `Itinerary`, `Documents`, `Guidelines`, `Reminders`, `Travel`,
`Media` (extra words allowed, as long as only one file matches each). See
[WHERE-TO-CONNECT.md](WHERE-TO-CONNECT.md).

**Tab names are the address.** The app finds each tab by its name, so these nine must match
exactly — same spelling, same capitals, no trailing space, no year suffix.

| Tab name | Required |
|---|---|
| `Settings` | optional (leave out if everything is in one file) |
| `Students` | **yes** |
| `Trips` | **yes** |
| `Itinerary` | no |
| `Documents` | no |
| `Guidelines` | no |
| `Reminders` | no |
| `Travel` | no |
| `Media` | no |

All plural except `Settings`… which is also plural. There is no singular anywhere — not
`Student`, not `Document`, not `Reminder`.

A tab that is absent simply means that section doesn't appear. A tab that is **misnamed**
looks identical to the app — the section silently vanishes with no error. That is the one
failure worth guarding against, so if you rename a tab, tell us.

**Column headers are forgiving.** `Father Name`, `father_name`, `FatherName` and `FATHER NAME`
all work — case, spaces, underscores and punctuation are ignored. Extra columns are ignored
too, so you can keep working notes in the sheet.

**Values in the `Grade` column are forgiving**: `7`, `Grade 7`, `Class 7`, `VII`, `JK`.
But a spelling we can't read (`Grade Seven`, `7th std`) drops that row silently — use the
dropdown in the supplied workbook.

**`Type` in `Guidelines`** must be one of `Safety`, `Do`, `Dont`, `Carry`. Anything else is
treated as `Safety`.

**`Key` in `Settings`** must be one of the eight tab names above. Capitals and spacing are
ignored there, but the word must be right — `Student` will not match `Students`.


The app reads eight tabs. Create them in **one spreadsheet** (simplest) with these exact
tab names, or as eight separate spreadsheet files — the adapter supports both.

Column headers are matched loosely: case, spaces, underscores and punctuation are ignored,
so `Father Name`, `father_name` and `FatherName` are all the same column. Extra columns are
ignored. Alias columns are listed where more than one name works.

Every tab except **Students** has a `Grade` column, and rows are filtered by it.

## Which rows are one trip — Grades, Trip name, Destination

The school's own sheet is one flat tab, one row per **batch**, with the Grades cell merged down
a grade's rows. Three columns decide how those rows are grouped, and they are the first three:

| Column | Fill it | Effect |
|---|---|---|
| **Grades** | always, on the first row of the grade | The grade number — `11`, `Grade 11`, `XI`. **Never a trip or programme name**: anything that is not a grade cannot be read and the row is dropped silently. |
| **Trip name** | only for a named programme | Optional. `MLC`, a camp name, anything. Starts a new trip inside the grade, and shows as a small tag beside the destination. |
| **Destination** | on the first row of each different trip | Where that trip goes. Starts a new trip. Leave **blank** on a row that is just another batch of the trip above. |

So:

- **A grade going to one place in two date batches** — destination on the first row, blank on
  the second. This is what Grades 7 to 10 already look like; nothing to change.
- **A grade running two different trips** — fill Destination again (and Trip name, if it has
  one) on the row where the second trip starts.

```
Grades | Trip name | Destination | Dates/ Sections
11     |           | Kevdi       | Batch 1: 12-19 December 2026
       |           |             | Batch 2: 14-21 December 2026
11     | MLC       | Manali      | 12-19 December 2026
```

That is three batches across **two** trips: Kevdi with two, MLC-Manali with one. Everything
else on a row — Safety guidelines, Do/Dont's, Things to carry, Travel details, orientation
links — belongs to **that row's trip**, so the MLC group never sees the Kevdi packing list.

**The one thing to avoid:** writing the programme name in the Grades column. `MlC` there is not
a grade, so the whole row vanishes from the site with no visible error. Put `11` in Grades and
`MLC` in Trip name.

---

## Grade column
Accepts `7`, `Grade 7`, `grade-7`, `Class 7`, `VII`, plus `JK` / `Junior KG` and
`SK` / `Senior KG`. Anything it cannot read is treated as no grade, and the row is dropped —
so a typo makes a row silently vanish. Only JK, SK and Grades 1–12 are supported.

---


> **In practice the roster is not a sheet.** The school publishes it as a CSV feed, which the
> `/api/lookup` function reads server-side. The `Students` tab below documents the shape and is
> what a sheet-based roster would need; the live feed's own columns
> (`ParentsEmailID`, `FathersMobileNo`, `MothersMobileNo`, …) are already recognised.

## 1. Students
Drives login and access control. One row per student.

| Column | Required | Notes |
|---|---|---|
| `StudentId` | no | Aliases: `Id`, `AdmissionNo`, `RollNo`. Auto-generated if blank. |
| `StudentName` | **yes** | Alias: `Name` |
| `Grade` | **yes** | See above. A student with no readable grade cannot be reached at all. |
| `Section` | no | Alias: `Division` |
| `FatherName` | no | Aliases: `Father`, `GuardianName`, `ParentName`. Shown as the signed-in name. |
| `ParentsEmailID` | one of the two | Aliases: `ParentEmail`, `FatherEmail`, `MotherEmail`, `Email`. **A login credential.** |
| `FathersMobileNo` | one of the two | Aliases: `FatherPhone`, `Mobile`, `Phone`. **A login credential.** |
| `MothersMobileNo` | no | Also accepted as a login credential, so either parent can sign in. |

### Who gets access
A row is reachable by **whichever of the two credentials it has filled in**:

- Email filled → that father can sign in with that email (typed, or via Google Sign-In).
- Phone filled → that father can sign in with that mobile number.
- **Both blank → nobody can reach that student.** The child simply will not appear for
  any parent. This is the most common cause of "my parent cannot log in".

Fill in the email column for every family you want to have email access. Rows without an
email are not an error — they just fall back to mobile-only.

### Matching rules
- **Email** is compared case-insensitively after trimming. It must match exactly
  otherwise — no aliasing, no plus-addressing tricks.
- **Phone** is compared on the **last 10 digits**, so `+91 98765 43210`, `098765 43210`
  and `9876543210` all match. A number Excel has reformatted is fine.

Two children under one email or number → the parent gets a child picker and can see both
grades. The two children do not need to be in the same grade.

## 2. Trips
One row per grade. A grade with no row shows "Nothing published yet".

| Column | Notes |
|---|---|
| `Grade` | |
| `TripTitle` | Alias: `Title` |
| `TripDates` | Free text, e.g. `Batch 1: 12–19 December 2026` |
| `Status` | `Confirmed` shows a green-ish "Confirmed" pill; anything else shows "Details coming soon" |
| `CoverImage` | Optional direct image URL for a banner |
| `Overview` | Long text. Line breaks are preserved. |
| `Coordinator` | Alias: `CoordinatorName` |
| `CoordinatorPhone` | |
| `CoordinatorEmail` | |
| `Emergency` | Alias: `EmergencyContact` |

## 3. Itinerary
One row per line of the day-wise plan. Rows render in sheet order.

`Grade` · `Day` · `Time` · `Activity` · `Location`

## 4. Documents
Orientation decks and other files. Each becomes a preview card.

| Column | Notes |
|---|---|
| `Grade` | |
| `Label` | Card title. Aliases: `Title`, `Name` |
| `Url` | Google Docs / Slides / Sheets / Drive file or folder share link |
| `Category` | Optional caption under the title, e.g. `Orientation` |

**The thumbnail only appears if the file is shared "Anyone with the link → Viewer."**
Private files fall back to a typed placeholder tile — the card still opens correctly for
anyone who has access. Drive *folders* and Google *Forms* never have a thumbnail; they
always show a placeholder.

## 5. Guidelines
Safety points, do's, don'ts and the packing list all live in one tab.

| Column | Notes |
|---|---|
| `Grade` | |
| `Type` | `Safety`, `Do`, `Dont`, or `Carry`. Unrecognised values are treated as `Safety`. |
| `Text` | One point per row |

## 6. Reminders
`Grade` · `Date` (free text, e.g. `1 September`) · `Text`

## 7. Travel
One row per leg, so an onward and a return journey are two rows.

`Grade` · `Leg` (e.g. `Onward` / `Return`) · `TrainNo` · `Departure` · `Platform` ·
`CoachSeat` · `Notes`

## 8. Media
`Grade` · `Type` (`photo` or `video`) · `Url` · `Caption`

---

## Connecting the sheets

1. Share the spreadsheet: **Anyone with the link → Viewer**.
2. Copy the file id from the URL:
   `docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`
3. Copy each tab's `gid` from the URL when that tab is selected (`#gid=123456`).
4. Fill in `.env` from `.env.example`:

```
VITE_DATA_SOURCE=sheets
VITE_SHEET_ID=THIS_PART
VITE_GID_STUDENTS=0
VITE_GID_TRIPS=123456
...
```

If the tabs are separate spreadsheet files instead, leave the gids blank and set
`VITE_SHEET_ID_STUDENTS`, `VITE_SHEET_ID_TRIPS` and so on.

> **Read this before going live.** With `VITE_DATA_SOURCE=sheets` the spreadsheet must be
> publicly readable and its id is visible in the JavaScript bundle. Any parent can open the
> raw sheet and read every family's name and phone number. The grade filter is a
> convenience, not a security boundary. For real access control, put the sheets behind a
> backend and switch to `VITE_DATA_SOURCE=api` — the contract is in
> `src/data/apiAdapter.js`.
