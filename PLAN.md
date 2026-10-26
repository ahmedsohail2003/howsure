# HowSure becomes the food, weight and sleep tracker Ahmed outlined, usable every day, with every request built, or decided by him out loud

Plan v1 (2026-11-03). Executed by: Claude builds, Ahmed decides and tries each phase. Local file: do not commit (it quotes private notes).

- **0. Situation**
  - The ask: "Yes, plan it first", answering "Start building the rest of what I outlined, on a separate branch that isn't pushed until after Oct 30. Show me the build order first." Earlier: "This is nothing like what I outlined to u originally", and on Oct 26: "Just everything I asked for include it."
  - Why it happened: 5 of 29 slices shipped (1, 2, 3, 4, 7), all on one idea, how sure a calorie number is. The plan ordered work by the hackathon clock, and Ahmed never tried the app before it was submitted. Hackathon rules (fictional person first, generic foods, one computer) were built in as if they were the product.
  - Checked against his words: 240 rows in the ledger (`.autopilot/plans/tracker/buildout/ledger.md`). 41 built, 21 partly, 54 planned as asked, 57 planned but shrunk, 14 deferred with his OK, 4 cut without it, 11 lost from every document, 38 notes rather than features. The word-search calls can miss a differently worded mention.
  - Known: there is no weight code at all; the headline is calories eaten, not net; a saved log has no way to survive a format change (`src/store/schema.ts:99`); the app runs only on a dev server on this computer (`vite.config.ts:8`); "Wake time not set" has no button. The earlier copy of slices 5 and 6 no longer exists, so they get rebuilt.
  - Not known: what he meant specifically. His Oct 26 message had two images ("So yeah try doing this") that were not opened, because they may show the real tracker, which this folder's rules keep off limits. Also unseen: the group-chat link in his Sep 26 note, and what a friend suggested on Sep 28.
  - Dates: judging ended Oct 30; winners are announced on or around Nov 4 at 2 PM ET. `main` stays exactly as judged and this work is not pushed until he says so.

- **C. Done means**
  - C1 "Just everything I asked for include it." — full marks: every feature row in the ledger is built as he said it, or has his own recorded decision to change or drop it; a default accepted in bulk does not count — check: re-run the ledger against the code at the end of each phase — met by: 1 to 5.
  - C2 "actually useful in day to day life" — full marks: he uses it for his own day on the devices he carries, without retyping usual meals or knowing calories in advance — check: he tries it at each phase's end and says so — met by: 1, 2, 3.
  - C3 "simple enough for anyone to understand but when they go into they then are able to see the breadth and depth" — full marks: every number on the surface opens into real detail, and the surface stays uncluttered — check: tap-through test on every number, and his read — met by: 1.5, 4, 5.4.
  - C4 "a clear rational behind it" and "breadth and depth in every aspect" — full marks: every claim shows its source or says it is an assumption, and every feature has a stated use — check: copy and sources tests, independent verifier on each slice — met by: every slice.
  - C5 No loss of his data — full marks: a log saved today opens correctly after every later update — check: an automated test loads an old saved log in each new version — met by: 1.1.

- **1. Safe to build on** — why: every later feature changes saved data, and today a format change can hide a log.
  - [ ] 1.1 Saved logs upgrade safely (format versions, an upgrade step, a test on an old log; separate storage for this branch's test data) — done when: an old log loads with nothing lost, in an automated test.
  - [ ] 1.2 Export and import your log, and Delete (slice 13's core plus import, which no slice owned) — done when: export, delete, import returns the identical log.
  - [ ] 1.3 Shared pieces no slice owned: the More menu, a targets editor (calories, protein, carbs, fat), a full-screen view switch — done when: each opens in a browser test.
  - [ ] 1.4 Close old test debt: colour contrast test, wording sweep, golden cases G6, G7, G9, G10 — done when: all exist and pass, or the checklist says plainly why not.
  - **1.5 The first look, redone with him** — why: the surface is what he reacted to.
    - [ ] 1.5.1 Show him the current screens against his "Look and Feel" answers and his "make the UI look a lot better" note; he picks the direction — done when: his choice is written in Changes.

- **2. His own tracker on this computer** — why: "a food, weight, and sleep tracker" for his own day comes before anything else, and it fixes most of what he saw.
  - [ ] 2.1 Your own log is the main path; the demo becomes a side door (slice 5, with Reset and a correct switch label) — done when: a fresh start reaches an empty own log in one tap, and returning opens the last log used.
  - [ ] 2.2 Set and correct wake and sleep times, add a missed night, delete a wrong one (slice 6, plus the two gaps it left open) — done when: "I woke at 8" works, and any meal that would move is shown before saving.
  - [ ] 2.3 Repeat a usual meal, saved meals, recent meals (lost from every document) — done when: a home meal is logged in two taps.
  - [ ] 2.4 Weight log with trend, on the dashboard (slice 20) — done when: a weigh-in shows on the day and in the trend.
  - [ ] 2.5 Workouts, and net calories as the main number (slice 10), with deficit or surplus shown or left out by his decision D5 — done when: the headline is net with eaten and burned under it, each one tap from its detail.
  - [ ] 2.6 Gym log below weight, viewable across many dates (slice 26, plus his open question) — done when: a session with drop sets is entered and earlier ones can be found.
  - [ ] 2.7 Weekly view with averages of all stats, updated daily (slice 8, widened to "all") — done when: every stat in the app has a week average, and new stats must add one.
  - [ ] 2.8 3-day and 4-day timeline with wake and expected-sleep markers (slice 18, with the 4-day option made real) — done when: both views show the markers.
  - [ ] 2.9 Tap-through on the macro row and on sleep; foods inside a meal shown (stored today, displayed nowhere) — done when: every dashboard number opens.
  - [ ] 2.10 Gamer-tag guest name (slice 9) — done when: a new log gets a readable random tag that can be changed.
  - [ ] 2.11 **Stop: he uses it for a day.** — done when: he says what is wrong, and that goes into the plan before Phase 3.

- **3. On the phone, with almost no typing** — why: "just saying it" and "just by taking photos" are how he said logging should work.
  - [ ] 3.1 Hosted, installable phone version, with saved data moved to browser storage that phones keep (IndexedDB) — done when: it installs on his phone and his exported log imports, with no server holding his log.
  - [ ] 3.2 Probe: one connector tool working from Claude on a phone, end to end — done when: a test proposal from the Claude phone app appears in the app, or the blocker is written down. Phone needs a hosted server with sign-in; the local kind cannot reach a phone [E2].
  - [ ] 3.3 Claude connector for photo and voice logging with an Add or Dismiss inbox, usable away from home (slice 14, not the same-computer version): several photos of one meal, count the pieces, guess the restaurant and say so, one meal with parts from different sources, gym sessions by voice, a skill file and a setup video — done when: a meal photo and a voice note each become a proposal he adds from his phone. The app gets Claude's reading, not the photo itself, unless the probe finds otherwise [E2].
  - [ ] 3.4 Plates with photos and weights, weigh-minus-plate (slice 11, with plate photos restored) — done when: reading minus plate is logged and Claude can match a plate.
  - [ ] 3.5 Barcode by camera or by typing, on the current Open Food Facts API, fetching ingredients and nutrients (slice 12, widened) [E1] — done when: a real product scans on his phone with its source shown.
  - [ ] 3.6 Food search (the search half of slice 24) — done when: a food found by name fills the meal.
  - [ ] 3.7 Label from a photo counts as a label (the spec rejects this today) — done when: it logs as `label` with the photo as its evidence.
  - [ ] 3.8 Probe: how close photo estimates get to his 10 to 20% target, from the studies, and what would lower it — done when: the answer is shown in the app's detail, whatever it is.
  - [ ] 3.9 **Stop: he logs a day using only his phone.**

- **4. The detail you didn't know you needed** — why: this is the "oh" he described: ingredient quality, how processed it is, micronutrients, the gut score.
  - [ ] 4.1 Micronutrients including omega-3, as far as the source reports them, with missing shown as missing (slice 21, widened from fibre, sugar and sodium) — done when: each nutrient shows its source, its coverage and a week average.
  - [ ] 4.2 Ingredient list and quality, and the percent processed (slice 21's processed share, plus the ingredient view) — done when: a scanned product lists its ingredients and the day shows a processed share labelled with its method [E4].
  - [ ] 4.3 Gut score from foods, kefir counting (slice 15 split into food list, calculation and panel) with his decisions on one number versus meters and on a how-sure figure — done when: it is labelled as a diet-pattern score, adapted from the published index, and never as a measure of his gut [E4]. Fibre types appear as cited notes per food, because daily grams by type cannot be computed from the data available [E4].
  - [ ] 4.4 Deep research on foods through Claude, with a button, a check on logging, and a preloaded starter set of common foods (slice 16, widened), with his decision on harm verdicts — done when: logging a researched food shows its findings and sources, and an unresearched one says "not known" and offers the button.
  - [ ] 4.5 Probe: what should a person actually be told about their food? (his research task, lost) — done when: a cited short list, which he reviews, decides what 4.1 to 4.4 surface.
  - [ ] 4.6 Room left, in foods, with sugar and fat limits, saving room for later meals, using real food names if he decides (slice 19, widened) — done when: the budget updates as meals are logged and says when you are over.
  - [ ] 4.7 Ranges for protein, carbs and fat, and the sweat sodium note (slice 29) — done when: each macro opens its range, with sources.
  - [ ] 4.8 Meal photos on the device, night tags, sleep file import from his device's format (slices 22, 23, widened) — done when: a real export file from his device imports.
  - [ ] 4.9 The "for sure" range as he decides (D4) — done when: the screen says what he chose, and what the evidence supports.
  - [ ] 4.10 **Stop: he reads through the depth and marks what is missing.**

- **5. For the other people it is for** — why: he said it is also for family, friends and "globally", and accounts were "for later", not cut.
  - [ ] 5.1 Second profile with a clinician-given budget, readings log and blood pressure (slices 25 and 21's readings, plus the lost tracker request), with his decision on "can I eat this" — done when: he has tried it with a typed sample; food-database terms bar medical use, so any answer must not lean on them alone [E1].
  - [ ] 5.2 Accounts and a database, holding only what must be shared (slice 24's sign-up half) [E3] — done when: sign-in works, and a test confirms one user cannot read another's rows.
  - [ ] 5.3 Real groups, per-meal sharing, revocable links, leaderboards, runs from a route file, then optional global boards (slices 17 and 28, real instead of preview) — done when: two real accounts join a group and a revoked link stops working. No Strava API use [E5].
  - [ ] 5.4 3D touches and the visual pass he chose (slice 27) — done when: he has seen it and kept it.
  - [ ] 5.5 Play Store listing, if he wants it (his account, fee and testers) [E6] — done when: he decides, and if yes, it is listed.
  - [ ] 5.6 Name, README and demo updated to the real app; open a pull request to `main` when he says — done when: he approves it.

- **Plan support**
  - **Sequence** — 1.1 -> 1.2 -> 1.3 -> 1.4 -> 1.5 -> 2.1 -> 2.2 -> 2.3 -> 2.4 -> 2.5 -> 2.6 -> 2.7 -> 2.8 -> 2.9 -> 2.10 -> 2.11 -> 3.1 -> 3.2 -> 3.3 -> 3.4 -> 3.5 -> 3.6 -> 3.7 -> 3.8 -> 3.9 -> 4.5 -> 4.1 -> 4.2 -> 4.3 -> 4.4 -> 4.6 -> 4.7 -> 4.8 -> 4.9 -> 4.10 -> 5.1 -> 5.2 -> 5.3 -> 5.4 -> 5.5 -> 5.6. Hard needs: 2.5 before 2.6 and 5.3; 1.2 before 3.1; 3.2 before 3.3; 3.1 before 3.3; 3.5 before 4.1 and 4.2; 3.3 before 4.4; 5.2 before 5.3.
  - **How each item is built** — one builder, then an independent verifier re-running unit tests, type check, that item's browser test and the full suite, with fix rounds. Expected results come from a separate calculation. One Playwright or ffmpeg job at a time; a browser crashed at 2.1 GB free, so check memory first. Each item ends in a commit on `build-out` if he allows it (D3).
  - **Decisions only he can make** (recommended answer first; never bundled as "defaults")
    - D1 What did "nothing like" mean most, and what did the Oct 26 images show?
    - D2 Is this your real tracker now? Recommended: yes, own log first. Builders still use sample data only, and his real meals stay out of the repo.
    - D3 Commits on a local branch `build-out`, one per verified item, nothing pushed. Recommended: yes. The folder's state file and his global rule need this said explicitly.
    - D4 "For sure" range: recommended, keep "very likely" and add an outer "almost certainly" range under the same model; the 21 sources re-checked give no guaranteed bound. Or his wording. Asked at 4.9, earlier if he wants.
    - D5 Deficit or surplus: recommended, show it once a resting burn estimate exists, labelled as an estimate; it was dropped only through a bulk default. Asked at 2.5.
    - D6 Phone first or computer first for the connector. Recommended: hosted, phone first, at 3.1.
    - D7 One gut number and a how-sure figure, or separate meters. Harm verdicts on foods. Asked in Phase 4.
    - D8 Groups: recommended, store only group totals and meals he shares; logs stay on the device. Asked at 5.2. Also the name, real food names, the `X-User-Agent` contact for Open Food Facts, the USDA download, the group-chat link, and what "your own wellness project" parity should mean, since builders may not open that product.
  - **Triggers** — Two failed fixes of one item: stop and re-plan it. A check contradicting an assumption updates the plan first. If he says a phase is wrong at a stop, the next phase waits.
  - **Risks** — Same failure again, narrow build unseen by him: mitigated by the stops at 2.11, 3.9, 4.10, and a ledger re-run each phase. Bulk defaults hiding cuts: decisions asked one at a time. Hosting strands data: 1.2 first. Health data on a server: 5.2 keeps logs on the device; legal fit for a small app is unverified [E3]. Big files getting hard to change: split `App.tsx` and `Dashboard.tsx` when an item needs it. Connector might not reach his phone: 3.2 is a probe before the build. Private notes leaking into the public repo: the existing word check runs before any push.
  - **Assumptions** — Word searches behind "lost" and "cut" missed nothing important: unverified, checked by his read of the ledger summary. Rough time, from logged slices of 22 to 28 minutes: about 15 to 25 hours of building for roughly 40 items, plus his stops; unverified for large items.
  - **Evidence** (full links and dates in `.autopilot/plans/tracker/buildout/feasibility.md`, opened 2026-11-03)
    - E1 Open Food Facts v3 is current, browser calls allowed, 15 reads a minute, terms bar medical use — strong, live check and official docs.
    - E2 Phone Claude uses remote connectors only; a chat upload reaching a tool is undocumented; SDK 1.32.2 is on the legacy line, so 3.2 tests it — moderate, official docs, not yet tried end to end.
    - E3 Supabase free tier: 500 MB, pauses after a week idle, 2 sign-up emails an hour; FTC breach rule names diet apps — moderate, official pages; how it applies to him unverified.
    - E4 Gut and processing evidence: the published index was checked only against urine markers; the 30-plants figure is not a tested target; fibre trials showed no diversity change; specialists agree only weakly on NOVA (κ 0.32 to 0.34); only 10 of 424 Foundation Foods report soluble or insoluble fibre (recount from the CSV pending) — moderate, papers via PubMed.
    - E5 Strava API policy bars AI and MCP-style use; route files avoid it — moderate, policy text.
    - E6 Play Store: US$25 once, ID check, 12 testers for 14 days, health declaration — strong, official docs.
  - **Changes**
    - v1: slices re-ordered by his daily use instead of hackathon tiers; 11 lost requests added back; "preview" versions of groups, connector and research replaced by the real ones; a stop added after every phase, because he never got to try the first build.
