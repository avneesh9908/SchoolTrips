# Turning on Google Sign-In

**Nobody can sign in to this site until this is done.** Google Sign-In is the only way in —
there is no password and no typed-address fallback — so with no client id configured the
login page shows a "sign-in is not configured" notice and refuses everyone. That is
deliberate; see *Why there is no typed box any more* at the bottom.

You need to do two things: create one OAuth client in Google Cloud Console, then paste the
id it gives you into two places. Budget fifteen minutes. There is no cost.

---

## Step 1 — Create the OAuth client

1. Go to **https://console.cloud.google.com/** and sign in with a school Google account
   (ideally an admin account on the school's Workspace, not a personal one — whoever owns
   this project controls sign-in for the whole site).

2. **Pick or create a project.** The project dropdown is in the blue bar at the top.
   *New Project* → name it something like `School Trips Portal` → **Create**. Wait for it to
   finish, then make sure the dropdown now shows that project.

3. In the search bar at the top, type **"Google Auth Platform"** and open it. (Older guides
   call this the "OAuth consent screen"; it is the same thing.)

4. **Configure the consent screen.** If it asks for a *User type*:
   - Choose **Internal** if every parent has an address on the school's own Google Workspace
     domain. This is much simpler — no verification, no publishing step.
   - Choose **External** if any parent signs in with a Gmail or other outside address.

   Fill in:
   - **App name:** `School Trips` (parents see this on the Google prompt, so use a name they
     will recognise)
   - **User support email:** the school office address
   - **Developer contact email:** the same, or whoever maintains the site

   Save. If you chose **External**, go to the **Audience** page and press **Publish app** —
   left in "Testing", only addresses you list by hand can sign in, and everyone else gets a
   confusing "access blocked" error. You do *not* need Google's verification review, because
   this app only asks for the basic email/profile scopes.

5. Go to **Clients** (or *Credentials* → *Create credentials* → *OAuth client ID*).

6. **Application type: Web application.** Name it `School Trips web`.

7. **Authorised JavaScript origins** — this is the part that goes wrong most often. Add
   **every** origin the site is served from, each as a separate entry, with no trailing
   slash and no path:

   ```
   https://trips.fsksurat.in
   https://schooltrips-production.up.railway.app
   https://fountainheadschooltrips.netlify.app
   http://localhost:5173
   http://localhost:5180
   ```

   An origin that is not listed makes the Google button silently fail to appear — no error
   the parent can read. If you add a new domain later, come back and add it here too.

   Leave **Authorised redirect URIs** empty. This app uses Google Identity Services in the
   browser, which does not redirect.

8. Press **Create**. Google shows a **Client ID** ending in
   `.apps.googleusercontent.com` — copy it. You can reopen it later from the Clients list;
   nothing here is a secret, but there is no reason to post it publicly either.

   Ignore the **client secret**. This app never uses it. Do not put it anywhere.

---

## Step 2 — Put the client id in the two places that need it

The **same value** goes in both. They are checked against each other: the browser asks
Google for a token stamped with the id, and the server refuses any token not stamped with
its own. A mismatch refuses every sign-in with *"That sign-in was not issued for this site"*.

**a) The browser** — `public/config.json`, the `googleClientId` field:

```json
"googleClientId": "123456789-abcdefg.apps.googleusercontent.com"
```

This file is read at page load, so on a running server you can edit it and refresh — no
rebuild. (In a local checkout you can put it in `public/config.local.json` instead, which is
gitignored.)

**b) The server** — an environment variable named `GOOGLE_CLIENT_ID`:

- **Railway (production — this is the one parents use):** project → the service →
  **Variables** → *New Variable* → `GOOGLE_CLIENT_ID` = the id. Railway restarts the service
  itself.
- **Netlify (the mirror):** *Site configuration* → *Environment variables* → *Add a
  variable* → same name and value → then **redeploy**, because functions pick environment
  variables up at deploy time.
- **Locally:** it is already stubbed in `.env` — paste the value after the `=`.

While you are in there, confirm the other two are set on the same host:
`ROSTER_CSV_URL` (the roster feed) and `ADMIN_EMAILS` (staff who see every grade, comma
separated).

---

## Step 3 — Check it

1. Open the site in a **private/incognito window** — a normal window may reuse a session and
   tell you nothing.
2. The login page should show a **"Sign in with Google"** button. If it still shows the
   "not configured" notice, `googleClientId` in `config.json` did not take: reload with the
   cache off, and check you edited the deployed copy.
3. Sign in with an address that is on the roster. You should land on the child picker.
4. Sign in with an address that is **not** on the roster. You should be refused with *"No
   student is registered against this Google account…"* — that is the roster check working,
   not a bug.
5. Confirm the server half is really on, with the site's own URL:

   ```bash
   curl -s -X POST https://trips.fsksurat.in/api/lookup -H 'Content-Type: application/json' -d '{"value":"any.parent@example.com"}'
   ```

   It must answer `401` and *"Sign in with Google to continue."* If it ever answers with a
   list of students, the old build is still live — the whole point of this change is that an
   email address is no longer a credential.

6. Sign out and back in. The second time, if you are still signed in to Google in that
   browser, you should land on the child picker **without clicking anything** — that is One
   Tap's `auto_select`, and it is the intended behaviour.

---

## Things that commonly go wrong

| What you see | What it is |
|---|---|
| No button, no error | The origin is not in *Authorised JavaScript origins*. Check for a trailing slash, `http` vs `https`, or the wrong port. |
| "Access blocked: this app has not completed verification" | The consent screen is **External** and still in *Testing*. Publish it. |
| "That sign-in was not issued for this site" | `googleClientId` and `GOOGLE_CLIENT_ID` are different values. |
| "Sign-in is not available right now" | `GOOGLE_CLIENT_ID` is not set on the **server**. The browser half alone is not enough. |
| A parent is refused although they are on the roster | Their `FatherEmail` in the roster is not the address they signed in with, or it is not a Google account. See below. |
| Changes did not take on Netlify | Functions read environment variables at deploy time. Redeploy. |

---

## Why there is no typed box any more

Until 2026-08-21 the login page accepted an email address or a mobile number, and that was
the entire credential. An address is not a secret — it is in the class WhatsApp group, on
the school's own mailing lists, on any circular — so anyone who had one could sign in as
that parent and read their child's trip details and travel plans. The same request worked
without a browser at all: posting an address to `/api/lookup` returned the family's
children.

Google Sign-In fixes it because Google, not the school and not this app, proves the person
at the keyboard actually holds that mailbox. The server then checks that proven address
against the roster. Both halves must agree, and the browser decides neither — which is why
the client id has to be on the server too, and why an unset one refuses everybody instead of
quietly letting them through.

**The cost of this: a parent whose roster row has only a mobile number can no longer sign
in.** There is nothing the site can do about that — a phone number is not something Google
can prove. Those rows need a `FatherEmail` (or, from Grade 7, a `StudentEmailID`) filled in,
and it must be an address that can sign in to Google. That is a roster job for the office,
and it is worth pulling the list of blank-email rows before this goes live rather than
discovering them one confused parent at a time.
