# Redesign: notes for builders

Read this before `BRIEF.md`. It says how the brief maps onto this repository and settles the places where the two disagree.

## What is in this folder

- `BRIEF.md`: Aoife's redesign spec, copied unchanged from the canvas's handoff document. It is the source of truth for the look and the new sections.
- `canvas/*.dc.html`: the source of each approved board (14 boards, listed in `canvas/canvas.json` with titles). They are plain HTML with inline styles, so every size, colour, radius and string on a board can be read straight from its file. `{{name}}` holes are filled by the small script at the bottom of each file, which also holds the sample data and the on/off states. Read the board's file before building its screen. Match its values exactly.
- This file.

The canvas itself is at https://claude.ai/artifact/QqJjhdX4KULdLT2ywoug1y. Builders cannot open it; the files here are the same content.

## What still governs

The brief changes how the app looks and adds sections. It does not replace:
- `PLAN.md` section 0 (no Supabase secret key, the server-secret pattern for portal functions, invite-only sign-up) and section 10 (accessibility).
- `CLAUDE.md` (how the app is put together, conventions, test patterns). Update it as conventions change.
- `supabase/README.md` (the database contract). The database decides what a doctor can see.

The research-based decisions in `PLAN.md` section 2 still hold: consent asked each time, nothing opens before Allow, safety information always shared, medications always shared, the patient can always see and stop access, the portal is read-only.

## Where the brief and the repository disagree

The brief was written from the canvas and the live site, without the code. Where it guesses, use what exists:

| Brief says | Use |
|---|---|
| "9-step sign up" | The existing 7 steps. Restyle them; change no logic. |
| Durations "15 min, 30 min, 1 hr, until I end it, match the existing options" | The existing four: 30 min, 1 hour, All day, Manual. The canvas shows these. |
| Locked tiles "for example Safety info if the product keeps it mandatory" | Safety info and Medications are both locked and always shared. The canvas shows both locked. |
| "Storybook or a simple /kitchen-sink dev route" | The existing `/kit` routes. Rebuild them for the new components. |
| "Lock screen / Live Activity", notifications, PWA manifest, splash, email copy | None exist. Do not build them. Do update the favicon and the `theme-color` meta. |
| "Demo: patient approves" button | Does not exist. Nothing to remove. |
| "Share history" | The existing `/access-log`. Rename it in the interface. |
| "Privacy and security" | The existing terms page and the "Your data" actions (export, delete). |
| Demo strip "Demo with sample data" | Replaces today's "Demo · sample data" marker. Shown for demo accounts only, never for a real account. |
| One commit per phase | Commit at working checkpoints (a repository hook flags uncommitted files), each message starting with its phase, for example "Phase 3: ...". |
| Tokens named ground, surface, ink and so on | Replace today's Figma-named tokens in `src/app/globals.css` with the brief's names. Leave no old token behind. |
| DM Sans (today) | Inter 400/500/600 and Sora 300/400/600, loaded through `next/font` as now. Nothing else. |

Pages the brief lists that do not exist (Notifications, a separate Mental health page, Documents) are covered by the owner's decisions below. Do not invent others.

## Owner's decisions on open points

Recorded as Aoife answers them. If a point you need is not here, pick the option that shares less with the doctor and stores less, and list it under "Decisions I made".

(none yet)

## Rules for database work

- **The live site keeps running the old code against this same database until the redesign ships.** Every migration must leave the old app working: add tables, columns and functions; do not drop, rename or change the meaning of what the old code uses. Old function calls (same names, same arguments) must keep returning what they return today. Where a value moves (a medication's strength into periods), keep the old column filled as well. List what can be removed after the redesign ships.
- Scope is enforced in `portal_get_record` and nowhere else. A section whose scope was not granted returns nothing, and its data is not read. Medication notes follow their own rule in the brief (section 4.5).
- Migrations as files and applied with the same SQL. SQL tests in `supabase/tests/`, each in a transaction that rolls back. Update `supabase/README.md` and regenerate the types (both copies: `supabase/types/` and `src/lib/supabase/`).
- No real data is touched. One real account may exist. Never bulk-delete.

## Rules for everyone

- Work on `claude/charming-goodall-sivzpd`. Never push, never open a pull request. The supervising session reviews and pushes.
- The live site is held on the current design by the file `.deploy-hold` at the repository root. Leave that file alone.
- Never print, log or commit values from `.env.local`.
- Anonymous sign-ins are capped at 30 an hour from this machine. Sign in once per test run and reuse the session. Run single spec files while working and the full suite once at the end.
- Existing tests must keep passing, updated where the interface they describe has changed on purpose. Do not delete a test to get green.
- `docs/REVIEW.md` is Aoife's review list for the first build. Items the redesign settles should be removed from it; anything new she must decide goes in.
