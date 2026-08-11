# Trip Explorer — what we need from the school

A one-page brief for the management discussion. Written for whoever will actually maintain
the data, not for developers.

---

## The short version

We need **one Google Drive folder** containing:

1. **One Google Sheet** called `Trip Data`, with the tabs listed below. Start from the empty
   template we have supplied — it already has the right tab names and dropdowns.
2. **One sub-folder per grade** holding that grade's documents — orientation decks, the
   itinerary, posters, photos.

Then we need three things sent to us: the **spreadsheet link**, and answers to the
**decisions** at the end.

> **Important:** the website never scans the Drive folder. It only reads the spreadsheet.
> A document that exists in the folder but is **not linked in the `Documents` tab is
> invisible to parents.** The folder is just where files live; the sheet is the index.

---


> **Please create a new folder for this.** Do not reuse the existing "Educational trips
> (25-26)" folder: it contains the trust deed, vendor service agreements and police
> correspondence, and everything in the folder we connect has to be readable by anyone with
> the link. Only parent-facing trip content belongs in the new one.

## 1. Folder structure

```
📁 School Trips                        ← share this folder with us
   📄 Trip Data                        ← THE spreadsheet (8 tabs)
   📁 Grade 7
       📄 Parent Orientation deck
       📄 Student Orientation deck
       📄 Day-wise itinerary
       🖼 Orientation poster
       📁 Photos
   📁 Grade 9
       📄 …
   📁 Grade 5
       📄 …
```

One folder per grade keeps it tidy for you. The website doesn't care about the layout —
it follows whatever links you paste into the `Documents` tab — so organise it however
your team prefers. Just keep it consistent.

---

## 2. Sharing settings — two separate things

These trip people up constantly, so please treat them as two distinct jobs.

**a) The spreadsheet** must be set to **Anyone with the link → Viewer**, or the website
cannot read it at all. (See the privacy decision at the end before doing this.)

**b) Each document** you want parents to see a **picture preview** of must *also* be set to
**Anyone with the link → Viewer**, individually or by sharing the whole grade folder.

If a document stays private, nothing breaks — the parent sees a labelled tile ("Presentation",
"Document") instead of a picture, and clicking still opens the file for anyone who has
access. It just looks plainer.

Two things never show a picture preview no matter what: **Drive folders** and **Google
Forms**. That's a Google limitation, not a bug.

---

## 3. The spreadsheet: 8 tabs (plus an optional `Settings` tab)

Create one Google Sheet with these tabs. **Row 1 is the header row** — copy the header line
into it exactly as given, then add one row per item underneath.

Column names are forgiving about spaces, capitals and underscores (`Father Name`,
`father_name` and `FatherName` all work). **Tab names are not** — the app finds each tab by
its name, so renaming a tab makes that whole section disappear.

### The `Settings` tab
The workbook includes a `Settings` tab with a `Key | Link | Notes` row per source. Leave the
links blank and everything is read from the tabs in this one file — which is what you want
most of the time.

If a source ever needs to live in its own spreadsheet (say the student roster is maintained
separately by the office), paste that spreadsheet's link into the matching row. The site
follows it. Nothing on our side needs to change.

### Tab 1 — `Students`
Controls who can log in and what they see. One row per student.

```
StudentID | StudentName | Grade | Section | ParentName | ParentsEmailID | FathersMobileNo | MothersMobileNo
```

**You do not need to fill this in.** The roster already comes from the school's own student
system, and the website reads it from there. This tab documents how access is decided, so you
know why a particular parent can or cannot sign in.

**How access works.** A parent signs in with their email address *or* mobile number. A
student row is reachable by **whichever of those two columns is filled in**:

- Email filled → that parent can sign in with that email.
- Either mobile filled → **either parent** can sign in with their own number.
- **Both blank → that child is invisible to everyone.** This is the number-one cause of
  "my parent can't log in."

Same email or number on two rows → that parent sees both children and can switch between
them, even across different grades.

Phone numbers are matched on the **last 10 digits**, so `+91 98765 43210`, `098765 43210`
and `9876543210` are all treated as the same number. Don't worry about formatting.

### Tab 2 — `Trips`
**One row per grade.** A grade with no row here shows "Nothing published yet."

```
Grade | TripTitle | TripDates | Status | CoverImage | Overview | Coordinator | CoordinatorPhone | CoordinatorEmail | Emergency
```

- `Status` — write `Confirmed` to show a "Confirmed" badge. Anything else (or blank) shows
  "Details coming soon."
- `TripDates` — free text, e.g. `Batch 1: 12–19 December 2026 · Batch 2: 13–20 December 2026`
- `Overview` — a paragraph or two. Line breaks are preserved.
- `CoverImage` — optional; leave blank unless you have a direct image link.

### Tab 3 — `Itinerary`
One row per line of the day-wise plan. They appear in the order you type them.

```
Grade | Day | Time | Activity | Location
```

| Grade 7 | Day 1 | 10:30 PM | Depart Mumbai Central | Mumbai Central |
|---|---|---|---|---|

### Tab 4 — `Documents`
Every orientation deck, itinerary doc and poster. Each row becomes a clickable preview card.

```
Grade | Label | Url | Category
```

You can also paste a **folder link** instead of a file link. One such row turns into one
card per file in that folder, so you can drop a new deck into the folder and it appears on
the site without touching the sheet. Files in a folder all share that row's category and
are ordered by filename, so keep anything needing its own label or position as its own row.
(This needs a one-off setup on our side; ask us to switch it on.)

| Grade 7 | Parent's Orientation deck | https://docs.google.com/presentation/d/… | Orientation |
|---|---|---|---|

- `Label` — what parents read on the card.
- `Url` — paste the normal Google share link. Docs, Slides, Sheets, PDFs, images and Drive
  folders all work.
- `Category` — optional small caption, e.g. `Orientation`, `Itinerary`, `Photos`.

### Tab 5 — `Guidelines`
Safety points, do's, don'ts and the packing list **all live in this one tab**, separated by
the `Type` column. One point per row.

```
Grade | Type | Text
```

`Type` must be one of: `Safety`, `Do`, `Dont`, `Carry`.

| Grade 7 | Safety | One adult accompanies students at all times. |
|---|---|---|
| Grade 7 | Carry | Sport or trekking shoes (compulsory) |

### Tab 6 — `Reminders`
Deadlines shown as highlighted notices.

```
Grade | Date | Text
```

`Date` is free text — `1 September` is fine.

### Tab 7 — `Travel`
**One row per leg**, so an onward and a return journey are two rows.

```
Grade | Leg | TrainNo | Departure | Platform | CoachSeat | Notes
```

| Grade 7 | Onward | MMCT JAIPUR SF (12955) | 10:30 PM | | 3AC | Report 60 min early. |
|---|---|---|---|---|---|---|
| Grade 7 | Return | JP BDTS EXP (12980) | 8:20 PM | | 3AC | Arrives Surat next morning. |

### Tab 8 — `Media`
Photos and videos. Can be left empty.

```
Grade | Type | Url | Caption
```

`Type` is `photo` or `video`.

---

## 4. Rules that matter

**Writing the grade.** Any of these work: `7`, `Grade 7`, `Class 7`, `grade-7`, `VII`, and
`JK` / `Junior Kindergarten`. But if a grade is misspelled in a way we can't read
(`Grade Seven`, `7th std`, a stray space that makes it blank), **that row silently
disappears** — no error, it just won't show. Please keep the spelling consistent down the
whole column; the easiest way is a dropdown (Data → Data validation).

**Only JK and Grades 1–12 are supported.** Tell us now if you have other year groups.

**Don't rename or reorder the tabs.** Adding columns is fine — we ignore what we don't know.
Renaming a tab breaks that whole section.

**Don't delete the header row**, and don't insert blank rows above it.

**Blank rows in the middle are fine** — they're skipped.

**One person should own the sheet.** Concurrent edits are fine in Sheets, but a single owner
avoids two people inventing two spellings of "Grade 7".

---

## 4b. What happens when the next trip comes around

**Nothing, on our side.** Keep using the same spreadsheet: update the `Trips` row for that
grade, replace its `Itinerary`, `Guidelines`, `Travel` and `Reminders` rows, and repoint the
`Documents` links. The site follows within a refresh.

Please don't create a *new* spreadsheet per trip — that's the one change that would need us
to reconfigure things each time.

Still undecided: whether past trips should be **kept as history** or simply overwritten. If
you want parents (or the school) to look back at last year's trip, tell us now — it needs a
small extra column, and it's far cheaper to add before the roster is typed than after.

## 5. What to send us

1. The link to the **`Trip Data` spreadsheet** — just the address bar, nothing else.
2. Confirmation that it's shared **Anyone with the link → Viewer**.
3. Confirmation of which **grades are in scope** for the first launch.
4. Answers to the decisions below.

That single link is the entire configuration. If a source later moves to another
spreadsheet, put its link in the `Settings` tab rather than sending us a new one.

We'll handle the technical wiring from there. Changes you make in the sheet appear on the
website — no developer involvement needed for content updates.

---

## 6. Decisions management needs to make

These change what we build, so they're worth settling in the meeting.

### A. Privacy of the student list — the big one
For the website to read the sheet directly, **the whole spreadsheet must be readable by
anyone with the link**. That includes the `Students` tab with every family's name, email and
phone number. A technically-minded parent can find that link in the page and open the raw
sheet.

The per-grade restriction still works as a *user experience*, but it is **not a security
barrier** in that setup.

Two options:

| | Direct-from-Sheets | Via a small server |
|---|---|---|
| Student data | Publicly readable by anyone with the link | Stays private |
| Grade restriction | Cosmetic | Actually enforced |
| Cost | None | Hosting + build time |
| Setup | Ready now | Needs to be built |

**If management is not comfortable with the student list being publicly readable, we need
the server option** — please decide, because it affects timeline and budget.

A middle path: keep names, emails and phones in a *separate* private sheet behind the
server, and leave only the harmless trip content (itinerary, packing list) public.

### B. How should parents sign in?
- **Mobile number** — familiar, but anyone who knows the number can sign in as that parent.
- **Email typed in** — same weakness, and emails are easier to guess than phone numbers.
- **Sign in with Google** — Google proves the address is genuinely theirs. Much stronger.
  Needs a one-off Google account setup on our side, and assumes parents have the email
  address on file as a Google account.
- **OTP by SMS** — strong and familiar, but costs money per message.

Right now email and mobile both work, with no verification. Google Sign-In is built and
ready but has never been switched on.

### C. "Father" — is that the right field?
The sheet currently has `FatherName`, `FatherEmail`, `FatherPhone`. In practice mothers and
guardians will need access too. Options:

- Rename to `ParentName` / `ParentEmail` / `ParentPhone` (we already accept these names).
- Add a second set of columns for a mother or guardian.
- Allow several contacts per student on separate rows.

**Please decide this before the roster is typed up** — it's cheap now and painful later.

### D. Will trip documents be shared publicly?
Needed for picture previews. If school policy says no, everything still works; parents just
see labelled tiles instead of thumbnails.

### E. Who maintains it, and how often?
Who owns the sheet, who checks it before a trip, and how quickly should a change reach
parents? (Currently: immediately on page refresh.)

### F. Anything not in the eight tabs?
Consent forms, fee status, per-student rooming, medical declarations, packing checklists
parents tick off — none of that exists today. If it's wanted, now is the time to say so.
