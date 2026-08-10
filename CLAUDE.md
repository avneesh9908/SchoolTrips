# CLAUDE.md — schoolTrips

## Project Knowledge Curator (auto-loaded)
At the start of every session, read `.claude/skills/school-trips/SKILL.md` in full and
treat it as authoritative project context.

On every turn:
1. Re-read `.claude/skills/school-trips/SKILL.md` before responding.
2. Ground your answer in it; surface conflicts before overwriting.
3. Extract any new durable knowledge from the exchange.
4. Update the skill (merge, don't append blindly) and add a dated one-liner to its Changelog.
5. End your reply with: `📓 Skill update: <summary or "no changes">`.

Do not store secrets, credentials, or PII in the skill. Mark uncertain facts `(unconfirmed)`.

## Hard rules
- `index.html` stays a single self-contained file — no framework, no bundler, no npm.
- All trip content lives in the `TRIP_DATA` object; never hard-code copy into renderers.
- Every interpolated value passes through `esc()`.
