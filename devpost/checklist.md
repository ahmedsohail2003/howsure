---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast (recorded at S1, 2026-10-26; Ahmed can switch to learn at any time)

Rules for every slice:
- **Verify lines run on Windows PowerShell 5.1.** Run each listed command on its own; never chain with `&&`.
- **One Playwright or ffmpeg job at a time across both hackathon entries.** Check the other entry's progress log first.
- **Every fixture is the fictional person "Sam"** (`spec.md > Demo Fixture`). No real meals, weights, sleep times or targets, ever.
- **Local commits are not authorized** for this entry (`STATE-tracker.md`). Where a slice says `Commit:`, stage the slice's files by explicit path and log that message under "## Commits waiting for Ahmed" in `PROGRESS-tracker.md`.
- **Tiers follow `prd.md > What We're Building`.** Each tier starts only when the one before it is verified. Whatever is verified by the freeze ships.

## Slices

- [x] **1. The demo day says how sure it is (the kernel)**
  Becomes usable: Open the app, choose **Try the fictional demo**, and see Sam's Wednesday: 2,280 kcal with "Estimate score 83", a likely range (1870–2780), a very likely range (1684–3087), the meal list with each meal's source and score, and "Most uncertainty comes from Pasta bake (ready meal)". Tapping the score, a range or a meal's score opens a short explanation with **More detail**, where every source shows its typical error and "assumption" until slice 7 re-checks it.
  Why now: This is `scope.md > The Unique Kernel`, so it goes first. It also carries the bootstrapping, so every later slice has a running app, a tested maths core and a fixture to land on.
  PRD ref: `prd.md > The Core Journey` (steps 1–3, 9), `prd.md > First Open`, `prd.md > Dashboard`, `prd.md > Estimate Score and Explanations`
  Spec ref: `spec.md > Stack`, `spec.md > Where It Runs and How Someone Tries It`, `spec.md > Look and Feel`, `spec.md > Maths Core: Sources Table`, `spec.md > Maths Core: Estimates, Ranges and the Day`, `spec.md > Maths Core: Number Parsing`, `spec.md > Clock`, `spec.md > Demo Fixture`, `spec.md > Screens`, `spec.md > File Structure`
  Build:
  - Finish the hand-made scaffold: `index.html`, `src/main.tsx`, `tsconfig.json` (`allowJs` + `checkJs`), `vite.config.ts` (127.0.0.1:5273, `strictPort`), `vitest.config.ts` + `tests/vitest.setup.ts` (TZ America/Toronto), and `playwright.config.ts` (installed Chrome, 390×844 and 1920×1080 projects). Dependencies are already installed at the pinned versions.
  - The maths core: `sources.ts` (all rows "assumption"), `estimate.ts` (two ranges, score, biggest contributor, `improve()`, `macroTotals()`), `parse.ts`.
  - `fixtures/demo-week.json`, built exactly as `spec.md > Demo Fixture` describes.
  - `clock.ts`, with the demo clock starting at Thu 2026-10-22 01:30.
  - `src/ui/theme.css` tokens and `src/ui/copy.ts`.
  - Screens: the first-open screen, the dashboard headline, the macro row, the meal list, the biggest-uncertainty line, and `ExplainSheet` (meal score, day score, ranges, More detail).
  - The persistent "Sample person — fictional" banner.
  - Golden tests G1–G5, G11 and G12 in `src/kernel/__tests__/`, and `copy.test.ts`.
  Verify (mechanical):
  - `npx vitest run` passes, including every listed golden value within its stated tolerance.
  - `npx tsc --noEmit` reports 0 errors.
  - `npx playwright test tests/e2e/how-sure.spec.ts` passes. It opens the demo and asserts 2280, "Estimate score 83", 1870–2780 and 1684–3087, the pasta bake as the biggest contributor, and that the explanation sheet shows the exact meal-score sentence from `prd.md`. It also asserts the fictional banner on every view, and that no request leaves 127.0.0.1.
  Learner check: Run `npm run dev:app`, open http://127.0.0.1:5273 and choose **Try the fictional demo**. Is it obvious, without reading anything else, how much to trust Sam's 2,280 kcal and which meal is the problem? Tap the score and read the explanation: does it say what the number means in words you'd trust?
  Commit: `Show how sure the demo day is: ranges, score and explanations`

- [x] **2. Improve the weakest meal and watch the day narrow, and it all survives a reload**
  Becomes usable: Tap **Improve that entry** on the pasta bake. The edit sheet opens with its values and its note (860 kcal on the label), and a before/after preview shows the meal and the day. **Save**: the day becomes 2,380 kcal, "Estimate score 92", likely 2153–2631, very likely 2042–2775, and the biggest uncertainty moves to "Apple and peanut butter". Reload, and it's all still there.
  Why now: This is the kernel's standout moment from `scope.md > What "Working" Looks Like`. Saving belongs here because the improved meal has to survive the reload in the same journey.
  PRD ref: `prd.md > Improve That Entry`, `prd.md > Saving`, `prd.md > The Core Journey` (steps 4, 7)
  Spec ref: `spec.md > Maths Core: Estimates, Ranges and the Day` (`improve()`), `spec.md > Store`, `spec.md > Data Model`, `spec.md > Screens`
  Build:
  - `store/schema.ts` (zod) and `store/storage.ts`, with separate `howsure.demo.v1` and `howsure.mine.v1` keys.
  - `LogMealSheet` in edit/improve mode, with the live preview computed on a copy of the day.
  - Hide **Improve that entry** when `improve()` returns null (G12).
  - The storage-blocked banner from `spec.md > Important Failure Modes`.
  Verify (mechanical):
  - `npx vitest run` passes, including G11b.
  - `npx tsc --noEmit` reports 0 errors.
  - `npx playwright test tests/e2e/improve.spec.ts` passes. It asserts:
    - the preview numbers equal the post-save dashboard (2380, score 92, 2153–2631, 2042–2775);
    - the biggest contributor becomes the apple and peanut butter;
    - closing without saving changes nothing;
    - after `page.reload()` the improved values remain.
  Learner check: In the demo, improve the pasta bake using the label numbers in its note. Did the day's range visibly narrow, and does the before/after preview make it clear why? Reload the page and confirm it stayed.
  Commit: `Improve a meal's evidence and save the log on the device`

- [x] **3. Log, edit and delete meals honestly, with unknown never zero**
  Becomes usable:
  - **Log a meal** in a few taps, in this order: name, how you know, calories, date and time, then optional details (collapsed).
  - Typing "abc" or "-50" shows an inline error and keeps everything else; blank saves as unknown; 0 stays 0.
  - A partly known day reads "Known meals only — incomplete day", shows the unknown count, and lists the meal under **Missing information** with no number.
  - An all-unknown day shows "Not available yet", and an empty day shows "No meals logged yet" with **Log your first meal**.
  - Meal details show the breakdown, and **Edit** and **Delete** work.
  Why now: The kernel is only honest if the input side is: unknown must never become 0. Every later feature logs through this sheet.
  PRD ref: `prd.md > Logging a Meal`, `prd.md > Calorie Input Rules`, `prd.md > Days With Unknown Calories`, `prd.md > Meal Details, Edit and Delete`, `prd.md > States and Boundaries`
  Spec ref: `spec.md > Maths Core: Number Parsing`, `spec.md > Maths Core: Estimates, Ranges and the Day`, `spec.md > Screens`, `spec.md > Data Model`
  Build:
  - `LogMealSheet` in new mode, with the waking-day label next to the date and time (a placeholder until slice 4 wires the waking days in).
  - `MealDetails`, and the Missing information section.
  - The partial, all-unknown and empty states.
  - `parse.ts` edge-case tests: "1,501", "13,9", blank, "abc", "-50", "0".
  Verify (mechanical):
  - `npx vitest run` passes.
  - `npx tsc --noEmit` reports 0 errors.
  - `npx playwright test tests/e2e/logging.spec.ts` passes. It covers each `- [ ]` criterion under `prd.md > Logging a Meal`, `Calorie Input Rules`, `Days With Unknown Calories` and `Meal Details, Edit and Delete`.
  Learner check: Log a meal with blank calories, then try typing letters into calories. Do the messages make sense? Does the day refuse to pretend it knows the total?
  Commit: `Log, edit and delete meals with unknown never zero`

- [x] **4. Days follow sleep, not the clock, with sleep length and the 7-night average**
  Becomes usable:
  - The header reads "Wed · awake since 1:20 PM" while the demo clock says Thu 1:30 AM, and the 00:40 snack sits on Wednesday.
  - **I'm going to sleep**, then **I woke up**, starts a new empty waking day.
  - **previous** and **next** (and a date picker) move between days.
  - The sleep section shows last night's length and the 7-night average as "6 of 7 nights".
  Why now: Waking days are the second half of the kernel's demo. Every later per-day feature (week view, net, gut score) needs the day boundaries to be right first.
  PRD ref: `prd.md > Sleep and Waking Days`, `prd.md > Previous Days`, `prd.md > The Core Journey` (steps 6, 8)
  Spec ref: `spec.md > Maths Core: Waking Days and Sleep`, `spec.md > Clock`, `spec.md > Demo Fixture`, `spec.md > Screens`
  Build:
  - `sleepday.ts`: wake-to-wake days, the provisional day, `nightStats()` with the circular-mean wake time, and `movedMeals()`.
  - `SleepSection`, the sleep buttons (defaulting to now, with an editable date and time), and the demo clock re-anchoring for times past its now.
  - previous/next and the date picker.
  - The waking-day label in `LogMealSheet`.
  - Golden G8 and the demo snack-on-Wednesday test.
  Verify (mechanical):
  - `npx vitest run` passes, including G8.
  - `npx tsc --noEmit` reports 0 errors.
  - `npx playwright test tests/e2e/sleep-days.spec.ts` passes. It asserts:
    - the snack is on Wednesday;
    - "6 of 7 nights" is shown;
    - sleep then wake makes a new empty day;
    - previous shows Wednesday's own totals;
    - editing a meal on a previous day changes only that day.
  Learner check: In the demo, tap **I'm going to sleep**, set it to 4:40 AM, then **I woke up** at 1:15 PM. Does the new day feel right, and is Wednesday (snack included) still there with **previous**?
  Commit: `Group meals by waking day and show sleep length and averages`

- [x] **5. Switch between the demo and your own log, start empty without inventing a wake time**
  Becomes usable:
  - **Start empty** opens your own log with "Wake time not set" and **Set wake time**. Meals logged before and after midnight stay together in one provisional day.
  - The header switch moves between the demo and your log; it reads **Open my log** once your log has entries.
  - **Reset demo** restores Sam's week, asking for confirmation only if the demo was edited.
  - Your log and the demo never mix.
  Why now: This completes the first-use paths in `prd.md > First Open` and gives the judges' path (the demo) and the real-use path (your own log) clean separation before more data types arrive.
  PRD ref: `prd.md > First Open`, `prd.md > Demo and My Log`, `prd.md > Sleep and Waking Days` (provisional day)
  Spec ref: `spec.md > Store`, `spec.md > Clock`, `spec.md > Maths Core: Waking Days and Sleep`, `spec.md > Screens`
  Build:
  - The header switch with its label rule.
  - Reset demo with the edited-hash check.
  - The provisional-day UI, the **Set wake time** flow, and the regroup preview when a wake time is confirmed.
  Verify (mechanical):
  - `npx vitest run` passes.
  - `npx tsc --noEmit` reports 0 errors.
  - `npx playwright test tests/e2e/demo-and-my-log.spec.ts` passes. It covers every `- [ ]` under `prd.md > Demo and My Log`, plus the provisional-day criteria in `prd.md > Sleep and Waking Days`.
  Learner check: Choose **Start empty**, log a snack, then switch to the demo and back. Is your snack still there, and did the demo stay untouched? Try **Reset demo** after editing the demo.
  Commit: `Keep the demo and your own log separate, with a provisional day`

- [x] **6. Correct a sleep or wake time safely**
  Becomes usable:
  - Tap the wake time in the header, or **Edit** in the sleep section (on any day), to open the sleep/wake editor with explicit dates and times.
  - A wake time before its sleep start shows an inline explanation, keeps what you typed, and changes nothing.
  - A valid correction that would move meals to another day names those meals and asks first.
  Why now: `prd.md > Editing Sleep and Wake Times` says this warning is built after core steps 1–7 are verified. Slices 1–5 deliver those steps, and the correction feature isn't complete until this works.
  PRD ref: `prd.md > Editing Sleep and Wake Times`
  Spec ref: `spec.md > Maths Core: Waking Days and Sleep` (validation, `movedMeals()`), `spec.md > Screens` (`SleepEditor.tsx`)
  Build: `SleepEditor` with order validation and the moved-meals confirmation, opened from both entry points.
  Verify (mechanical):
  - `npx vitest run` passes.
  - `npx tsc --noEmit` reports 0 errors.
  - `npx playwright test tests/e2e/sleep-editor.spec.ts` passes. It covers every `- [ ]` under `prd.md > Editing Sleep and Wake Times`.
  Learner check: Move Wednesday's wake time to 6 PM. Does the app name the meals that would move before it changes anything?
  Commit: `Edit sleep and wake times with order checks and a move warning`

- [x] **7. Every source cites its study, or says "assumption"**
  Becomes usable: In **More detail**, each evidence source shows its typical error, and either a study (author, year, DOI, the one-line finding, the date it was re-checked) or the word "assumption". It's honest about which numbers are backed. The README gets a "Sources" section and a "Provenance" line naming the starting figures as Ahmed's earlier personal tracker work.
  Why now: Ahmed accepted the very likely range and the studies as Tier 1, so Tier 1 isn't complete without them. It's a research step with a visible result, done once the screens that show it exist.
  PRD ref: `prd.md > Estimate Score and Explanations` (Studies behind each source)
  Spec ref: `spec.md > Maths Core: Sources Table` (the re-check step), `spec.md > Decisions and Open Issues`
  Build:
  - Re-open each study named in the sources table, using the PubMed tool or the publisher's page.
  - Upgrade a row to `kind: 'study'` only when the study's own figure for the matching method supports the number. Otherwise keep "assumption" and show the nearest study as context.
  - Record the re-check date for each row.
  - Add the README's Sources and Provenance sections.
  Verify (mechanical):
  - `npx vitest run` passes. A sources test asserts every row has either `kind: 'assumption'`, or `kind: 'study'` with a DOI and a re-check date.
  - `npx playwright test tests/e2e/how-sure.spec.ts` passes (More detail shows a study or "assumption" for every source).
  - `git diff --stat` shows `src/kernel/sources.ts` and `README.md` changed.
  Learner check: Open **More detail** on the photo estimate. Would the citation (or the honest "assumption") give a friend confidence in the number?
  Commit: `Cite a re-checked study or say assumption for every source`

- [x] **8. The week at a glance, with sleep** (Tier 2)
  Becomes usable:
  - **Week** shows Sam's seven waking days, each with its estimate and both ranges.
  - Saturday shows "not logged" and Friday shows "known meals only".
  - Averages are labelled, e.g. "average of 5 complete days (1 incomplete left out)".
  - A sleep row shows each night, the average and the average wake time.
  - It rolls forward as days pass.
  Why now: Ahmed asked for "the weekly average of all of the stats ... updated everyday". It reuses the verified day maths, so it's the cheapest high-value Tier 2 item.
  PRD ref: `prd.md > Week View`
  Spec ref: `spec.md > Maths Core: Week Summary`, `spec.md > Screens` (`WeekView.tsx`)
  Build: `week.ts` with the source-grouped week spread (golden G10), and `WeekView` with SVG bars and range whiskers, the sleep row, and slots for net, weight and gut meters (filled once those exist).
  Verify (mechanical):
  - `npx vitest run` passes, including G10.
  - `npx tsc --noEmit` reports 0 errors.
  - `npx playwright test tests/e2e/week.spec.ts` passes. It covers every `- [ ]` under `prd.md > Week View`.
  Learner check: Open **Week** in the demo. Can you tell at a glance which days are solid, which are shaky, and which weren't logged?
  Commit: `Add the week view with ranges, labelled averages and sleep`

- [ ] **9. A gamer-tag guest name, and the profile and privacy screen** (Tier 2)
  Becomes usable:
  - Starting your own log generates a name like "BraveKefir#4821", with **Reroll** and **Rename**, labelled "Guest: saved on this device only".
  - Tapping the name opens **Profile and privacy**: the guest name, and plates (filled in slice 11).
  - The demo shows Sam's fixed name "CalmLentil#3108".
  Why now: Ahmed wanted anyone who doesn't sign up to still get a fun name. It's cheap, and it gives the profile screen that the plates, privacy and connector slices fill in.
  PRD ref: `prd.md > Guest Profile and Gamer-Tag Name`
  Spec ref: `spec.md > Maths Core: Plates and Gamer Tags`, `spec.md > Screens` (`ProfilePrivacy.tsx`)
  Build: `gamertag.ts` and `words.ts` (clean lists), the profile screen shell, and the Rename validation.
  Verify (mechanical):
  - `npx vitest run` passes (generated names match the pattern, at most 16 characters).
  - `npx playwright test tests/e2e/guest-profile.spec.ts` passes. It covers every `- [ ]` under `prd.md > Guest Profile and Gamer-Tag Name`.
  Learner check: Start your own log and reroll the name a few times. Are the names fun and clean? Rename it to something of your own.
  Commit: `Give guests a generated gamer-tag name`

- [x] **10. Workouts, and net calories with its own range** (Tier 2)
  Becomes usable:
  - **Log a workout** (name, time, duration, burned, how you know).
  - The headline becomes net calories, with eaten and burned underneath. Net's range combines both, and its explanation says resting burn isn't counted, with no deficit or surplus word.
  - Tapping burned opens the workout list, with edit and delete.
  Why now: Ahmed's Sep 28 note makes net calories the main stat. It extends the verified day maths with a second uncertain quantity.
  PRD ref: `prd.md > Workouts and Net Calories`
  Spec ref: `spec.md > Maths Core: Net Calories`, `spec.md > Maths Core: Sources Table` (burn rows), `spec.md > Screens` (`WorkoutSheet.tsx`, `WorkoutList.tsx`)
  Build: `net.ts` (golden G6), the workout sheet and list, net mode in the headline and in `ExplainSheet`, and the week view's net row.
  Verify (mechanical):
  - `npx vitest run` passes, including G6.
  - `npx tsc --noEmit` reports 0 errors.
  - `npx playwright test tests/e2e/workouts-net.spec.ts` passes. It covers every `- [ ]` under `prd.md > Workouts and Net Calories`.
  Learner check: Log a 300 kcal "rough guess" workout today. Is net calories clear, and is it obvious it isn't your full energy balance?
  Commit: `Log workouts and show net calories with a combined range`

- [ ] **11. Weigh minus the plate** (Tier 2)
  Becomes usable: Save "Blue dinner plate, 212 g" once. Then log a weighed meal by picking the plate and typing the scale reading (612 g) and 165 kcal/100 g. It saves at 660 kcal, and the details show "612 g reading − 212 g plate = 400 g × 165 kcal/100 g = 660 kcal".
  Why now: This is Ahmed's plate idea, and it makes "weighed", the best source, practical. It's needed before the Claude connector, which can name a plate.
  PRD ref: `prd.md > Plates: Weigh Minus the Plate`
  Spec ref: `spec.md > Maths Core: Plates and Gamer Tags`, `spec.md > Screens`
  Build: `plates.ts` (golden G7), the plates list in Profile and privacy, and **Use a saved plate** in the log sheet.
  Verify (mechanical):
  - `npx vitest run` passes, including G7.
  - `npx playwright test tests/e2e/plates.spec.ts` passes. It covers every `- [ ]` under `prd.md > Plates: Weigh Minus the Plate`.
  Learner check: Add a plate and log a weighed meal on it. Does the arithmetic line make the number feel trustworthy?
  Commit: `Weigh food minus a saved plate`

- [ ] **12. Look up a barcode, live** (Tier 2)
  Becomes usable:
  - **Look up a barcode** asks Open Food Facts and fills in the product and its per-100 g values. You enter the amount, and the source becomes "Nutrition label (looked up)", with the ODbL credit line.
  - Offline, or with an unknown product, you get a plain message and can still enter it by hand.
  - The demo uses a saved copy, labelled as saved.
  Why now: Ahmed's "any bagged item" idea. It's the first live integration, and it needs no key.
  PRD ref: `prd.md > Barcode Lookup (Live)`
  Spec ref: `spec.md > Lookups`, `spec.md > External Services and Dependencies`, `spec.md > Demo Fixture` (`off-cache.json`)
  Build:
  - `lookups/openFoodFacts.ts` (sending `X-User-Agent`, never an email) and `cache.ts`.
  - The barcode field in the log sheet.
  - `fixtures/off-cache.json` recorded from one live call.
  - `scripts/check-demo-lookup.mjs`.
  - The `sentCount.barcode` counter.
  Verify (mechanical):
  - `npx vitest run` passes.
  - `npm run check:demo-lookup` prints the product name and brands, and exits 0 with no brand token in the name.
  - `npx playwright test tests/e2e/barcode.spec.ts` passes. It covers every `- [ ]` under `prd.md > Barcode Lookup (Live)`, with the live call stubbed, plus one real-network test, run once, that is skipped offline.
  Learner check: Type a barcode from something in your kitchen. Does the product fill in, and does the credit line feel honest?
  Commit: `Look up barcodes from Open Food Facts with caching`

- [ ] **13. A privacy panel you can trust** (Tier 2)
  Becomes usable:
  - **Profile and privacy** shows "Saved on this device only" and "Sent off this device: N lookups (barcodes)".
  - **Export my data** downloads a JSON of everything in your log.
  - **Delete my data** (after a confirmation) removes it all, leaving the demo untouched. **Reset demo** is there too.
  Why now: Ahmed wanted control over who sees his log. With no account, visible control over local data is the honest form, and it must cover every data type built so far.
  PRD ref: `prd.md > Privacy Panel`
  Spec ref: `spec.md > Store` (Export/Delete), `spec.md > Screens` (`ProfilePrivacy.tsx`)
  Build: Export and Delete over every key and the photo store, the sent-off counter display, and the confirmation dialogs.
  Verify (mechanical):
  - `npx vitest run` passes.
  - `npx playwright test tests/e2e/privacy.spec.ts` passes. It covers every `- [ ]` under `prd.md > Privacy Panel`.
  Learner check: Export your log and open the file. Is everything there? Then delete your log and confirm the demo is untouched.
  Commit: `Add the privacy panel with export, delete and a sent-off count`

- [ ] **14. Send a meal photo to your Claude, and confirm it in HowSure** (Tier 2)
  Becomes usable:
  - With `npm run dev` running and the connector added to Claude Desktop or Claude Code, Claude can propose a meal from a photo or a description with its stated guess, list your plates, and read the viewed day.
  - Proposals appear in **From Claude**; **Add** puts one on the right waking day with a photo estimate's ranges, and **Dismiss** removes it.
  - Turning the connector off in Profile and privacy makes every tool answer "connector is off".
  Why now: Ahmed moved AI photo and voice logging into the build through a Claude MCP connector. It reuses logging, plates and privacy, which are all verified by now.
  PRD ref: `prd.md > Claude Connector: Photo and Voice Logging`
  Spec ref: `spec.md > Claude Connector: Bridge`, `spec.md > Claude Connector: MCP Server`, `spec.md > Where It Runs and How Someone Tries It`
  Build:
  - `shared/connector-schema.mjs`.
  - `connector/bridge.mjs` (127.0.0.1:5274, token, CORS, `data.json`, 403 when off).
  - `connector/mcp-server.mjs` (`propose_meal`, `list_plates`, `get_day`, with built-in instructions).
  - `scripts/dev.mjs`.
  - The `/__howsure/token` dev middleware.
  - `FromClaudeInbox`, and the connector switch.
  - The README section "Connect Claude".
  Verify (mechanical):
  - `npx vitest run tests/connector` passes. It calls the tool handlers against a test bridge on port 5284:
    - a photo proposal, then Add;
    - the weighed proposal (212 g, 612 g, 165 kcal/100 g → 660 kcal);
    - `get_day`;
    - the off state;
    - "HowSure isn't running".
  - `npx playwright test tests/e2e/connector.spec.ts` passes. It covers every `- [ ]` under `prd.md > Claude Connector: Photo and Voice Logging`.
  - After `npm run dev` is stopped with Ctrl+C, `Get-NetTCPConnection -LocalPort 5273,5274 -ErrorAction SilentlyContinue` prints nothing.
  Learner check: Add the connector to Claude (README "Connect Claude"), send Claude a photo of a generic, unbranded meal you took, and ask it to log it. Does the proposal show Claude's guess, and does **Add** do what you expect?
  Commit: `Add the Claude connector for photo and voice logging`

- [ ] **15. The gut-friendly diet score** (Tier 2)
  Becomes usable:
  - **Foods in this meal** lists each meal's foods, auto-tagged from the built-in list and editable.
  - The week view shows three separate meters:
    - the diet index (0–14, adapted from DI-GM);
    - plant types this week;
    - fermented servings per day (kefir counts).
  - Each meter shows "based on N of M meals tagged", under the subtitle "Scores the foods you logged, not your gut bacteria."
  - **How this is computed** lists every rule with its DOI and its limits.
  Why now: This is Ahmed's gut-score idea in its research-backed form. It's last in Tier 2 because it's the largest item.
  PRD ref: `prd.md > Gut-Friendly Diet Score`
  Spec ref: `spec.md > Maths Core: Gut-Friendly Diet Score`, `spec.md > Screens` (`GutPanel.tsx`), `spec.md > Decisions and Open Issues` (USDA bulk download, approved by Ahmed 2026-10-26)
  Build:
  - Download `FoodData_Central_foundation_food_csv_2026-04-30.zip` (approved, 3,825,741 bytes) into a scratch folder.
  - Build `fixtures/foods.json` (about 150 foods, each citing its FDC id).
  - `gut/digm.ts`, `plants.ts`, `fermented.ts`, `amounts.ts`, with one unit test per fiber-point branch.
  - The **Foods in this meal** editor, `GutPanel` with How this is computed, and the USDA credit in the app and `THIRD_PARTY_LICENSES.md`.
  Verify (mechanical):
  - `npx vitest run` passes, including the kefir point, the excluded empty day and the fiber branches.
  - `npx tsc --noEmit` reports 0 errors.
  - `npx playwright test tests/e2e/gut-score.spec.ts` passes. It covers every `- [ ]` under `prd.md > Gut-Friendly Diet Score`, and the copy sweep finds no "%", "accuracy" or "gut health" on the gut screens.
  Learner check: Log kefir in your own log. Did the fermented meter and the diet index move the way you'd expect? Open **How this is computed**: is it honest about what the score can't tell you?
  Commit: `Add the gut-friendly diet score with sources and coverage counts`

- [ ] **16. Food research saved by your Claude** (Tier 3, stretch 1)
  Becomes usable: Claude's `save_food_research` saves findings for a food, each with an evidence grade, a source link and a date. A finding without a source is rejected by name. Meals with that food show a **Research** section, labelled "Researched by your Claude on [date]; not checked by HowSure", with no score and no verdict words.
  Why now: Ahmed asked for deep research per food through Claude. It reuses the connector from slice 14.
  PRD ref: `prd.md > Food Research via Claude`
  Spec ref: `spec.md > Claude Connector: MCP Server` (`save_food_research`), `spec.md > Claude Connector: Bridge`, `spec.md > Screens`
  Build: The research tool and its validation, the bridge's `/research` endpoints, `ResearchSection`, and the ready-made "refresh" request text.
  Verify (mechanical):
  - `npx vitest run tests/connector` passes (sourced and unsourced findings).
  - `npx playwright test tests/e2e/research.spec.ts` passes. It covers every `- [ ]` under `prd.md > Food Research via Claude`.
  Learner check: Ask Claude to research kefir for HowSure. Are the findings grouped and sourced the way you'd want?
  Commit: `Save food research from Claude with sources and evidence grades`

- [ ] **17. Groups, sharing and leaderboards (preview on the device)** (Tier 3, stretch 2)
  Becomes usable:
  - Create a group, and get an invite code (labelled "works once accounts exist").
  - Share a meal after a preview (weight, sleep and routes are never shared by default), and unshare it.
  - See four weekly leaderboards with the fictional demo members: most burned, best macros, consistency, "how sure".
  - Every group screen says "Groups preview: nothing leaves this device."
  Why now: Ahmed wants the full feature in place, with only accounts and a database later.
  PRD ref: `prd.md > Groups, Sharing and Leaderboards`
  Spec ref: `spec.md > Groups Layer (Tier 3)`
  Build: `social/backend.ts` and `localPreview.ts`, `fixtures/demo-group.json`, and the group, feed, share-preview and leaderboard screens.
  Verify (mechanical):
  - `npx vitest run` passes (leaderboard maths).
  - `npx playwright test tests/e2e/groups.spec.ts` passes. It covers every `- [ ]` under `prd.md > Groups, Sharing and Leaderboards`, including no network requests from any group action.
  Learner check: Share one meal with the demo group and look at the leaderboards. Is it obvious the members are fictional and nothing left your computer?
  Commit: `Add groups, sharing and leaderboards as an on-device preview`

- [x] **18. The 3-day timeline** (Tier 3, stretch 3)
  Becomes usable: Three waking days drawn hour by hour, with midnight lines, sleep blocks and their lengths, wake markers and meals as dots. An "expected sleep" marker sits 16 h after waking (your setting, labelled "your setting, not advice").
  Why now: Ahmed's Sep 18 view idea makes the waking-day rule visible at a glance.
  PRD ref: `prd.md > 3-Day Timeline`
  Spec ref: `spec.md > Screens` (Tier 3 screens), `spec.md > Maths Core: Waking Days and Sleep`
  Build: `Timeline3Day.tsx` (SVG), and the usual-day-length setting.
  Verify (mechanical): `npx playwright test tests/e2e/timeline.spec.ts` passes. It covers every `- [ ]` under `prd.md > 3-Day Timeline`.
  Learner check: Open the timeline in the demo. Is the after-midnight snack obviously part of Wednesday?
  Commit: `Add the 3-day timeline with sleep blocks and markers`

- [ ] **19. Room left, in foods** (Tier 3, stretch 4)
  Becomes usable: With your own calorie target, **Room left** subtracts the top of the very likely range and room for meals still to come. It's shown as generic foods and your saved treats, and says "Exceeded today's target by about X–Y kcal" when over.
  Why now: Ahmed's fast-food and dessert budget idea, made honest about uncertainty.
  PRD ref: `prd.md > Room Left, in Foods`
  Spec ref: `spec.md > Other Tier 3 Pieces` (`budget.ts`), `spec.md > Data Model` (profile targets)
  Build: `budget.ts` with tests, the saved treats, and the `RoomLeft` screen.
  Verify (mechanical):
  - `npx vitest run` passes.
  - `npx playwright test tests/e2e/room-left.spec.ts` passes. It covers every `- [ ]` under `prd.md > Room Left, in Foods`.
  Learner check: Set a target and save a treat. Does the room-left list feel useful, and honest about uncertainty?
  Commit: `Show room left as foods using the top of the very likely range`

- [x] **20. Weight log with trend** (Tier 3, stretch 5)
  Becomes usable: Log weigh-ins, and see a 7-day average trend line with the note "daily weight swings with water and food; watch the trend".
  Why now: Weight is in the app's name.
  PRD ref: `prd.md > Weight Log`
  Spec ref: `spec.md > Other Tier 3 Pieces` (`weight.ts`), `spec.md > Data Model`
  Build: `weight.ts` with tests, `WeightLog`, and the week view's weight row.
  Verify (mechanical):
  - `npx vitest run` passes.
  - `npx playwright test tests/e2e/weight.spec.ts` passes. It covers every `- [ ]` under `prd.md > Weight Log`.
  Learner check: Log a week of fictional weigh-ins. Does the trend line read clearly?
  Commit: `Add weigh-ins with a 7-day trend`

- [ ] **21. Nutrients and the processed-food share from lookups** (Tier 3, stretches 6–7)
  Becomes usable:
  - Fiber, sugar, sodium and other nutrients from labels and lookups, shown as "unknown" when missing.
  - Omega-3 as "fatty-fish meals this week".
  - The share of known calories from NOVA-4 foods, plus the unknown share.
  Why now: Ahmed's micronutrient, omega-3 and "how processed" ideas, using data the lookups already return.
  PRD ref: `prd.md > Nutrients From Lookups`, `prd.md > Processed-Food Share`
  Spec ref: `spec.md > Other Tier 3 Pieces` (`nova.ts`), `spec.md > Lookups`, `spec.md > Decisions and Open Issues` (the sodium guideline and NOVA re-checks)
  Build: The nutrient fields, `nova.ts`, and the re-checked sodium guideline and NOVA wording (no line is shown until it's confirmed).
  Verify (mechanical):
  - `npx vitest run` passes.
  - `npx playwright test tests/e2e/nutrients.spec.ts` passes. It covers every `- [ ]` under both PRD headings.
  Learner check: Look up a packaged food. Do the nutrient and processed-share lines make sense, and is "unknown" clear?
  Commit: `Show nutrients and the processed-food share from lookups`

- [ ] **22. Meal photos on the device, and night tags** (Tier 3, stretches 8–9)
  Becomes usable:
  - Attach a photo to a meal, stored on this device only.
  - Tag nights (e.g. "kefir"), and compare sleep length on tagged vs untagged nights, with counts and "a few nights prove nothing".
  Why now: Two small on-device features from Ahmed's notes, next to each other in the tier order.
  PRD ref: `prd.md > Meal Photos on This Device`, `prd.md > Night Tags`
  Spec ref: `spec.md > Store` (IndexedDB photos), `spec.md > Data Model` (sleep tags)
  Build: The photo attach and storage, the night tag editor, and the tagged/untagged comparison in the week view.
  Verify (mechanical): `npx playwright test tests/e2e/photos-tags.spec.ts` passes. It covers every `- [ ]` under both PRD headings, including that the sent-off count doesn't change.
  Learner check: Attach a photo and reload. Tag three nights. Is the comparison honest about how little it proves?
  Commit: `Store meal photos on the device and compare tagged nights`

- [ ] **23. Import a sleep file** (Tier 3, stretch 10)
  Becomes usable: **Import sleep file** previews the nights in a CSV or JSON (HowSure's documented format) and adds them after a confirmation. A sample file for Sam is included.
  Why now: It's the honest bridge for wearable data while wearable sync is deferred.
  PRD ref: `prd.md > Sleep File Import`
  Spec ref: `spec.md > Other Tier 3 Pieces`, `spec.md > Maths Core: Waking Days and Sleep` (validation)
  Build: `sleepImport.ts` with tests, `fixtures/sample-sleep.csv`, and the preview dialog.
  Verify (mechanical):
  - `npx vitest run` passes.
  - `npx playwright test tests/e2e/sleep-import.spec.ts` passes. It covers every `- [ ]` under `prd.md > Sleep File Import`.
  Learner check: Import the sample file. Does the preview make you confident before you confirm?
  Commit: `Import sleep from a file with a preview`

- [ ] **24. Optional sign-up and food search, only with Ahmed's keys** (Tier 3, stretches 11–12)
  Becomes usable:
  - If Ahmed created a Supabase project and put its keys in `.env.local`: **Save my account** links the guest profile to his email (he does that check himself).
  - If he added a USDA key: **Search foods** finds whole foods like kefir. Public demos use saved results.
  - Without keys, both stay hidden and everything works locally.
  Why now: Both wait on keys only Ahmed can create. Without them, they move to the README roadmap.
  PRD ref: `prd.md > Optional Sign-Up`, `prd.md > Food Search`
  Spec ref: `spec.md > Other Tier 3 Pieces`, `spec.md > Lookups`, `spec.md > External Services and Dependencies`
  Build: `supabase-js`, pinned when this slice starts and gated on `VITE_SUPABASE_URL`; `lookups/usda.ts`, gated on `VITE_USDA_KEY`. Agents never read `.env` files.
  Verify (mechanical):
  - `npx playwright test tests/e2e/keys-absent.spec.ts` passes: with no keys, no sign-up or search button appears.
  - With keys present, Ahmed runs the sign-up check himself, and the search test runs.
  Learner check: (Only if you made the keys.) Link your guest profile to your email and confirm your profile row appears; search "kefir".
  Commit: `Add optional sign-up and food search behind your own keys`

- [ ] **25. A second profile with a clinician-given carb budget** (Tier 3, stretch 13)
  Becomes usable: Add a second profile on this device. Its carb budget is a typed number from the person's clinician, with arithmetic only. A readings log shows plain numbers and times, with no colours or "high/normal" labels, and the fixed note "Not medical advice. Not for insulin dosing."
  Why now: This is the arithmetic-only version of Ahmed's carb-budget idea. The demo uses only a fictional profile.
  PRD ref: `prd.md > Second Profile and Carb Budget`
  Spec ref: `spec.md > Other Tier 3 Pieces`, `spec.md > Data Model`
  Build: `carbs.ts` with tests, `SecondProfile.tsx`, and the readings log.
  Verify (mechanical):
  - `npx vitest run` passes.
  - `npx playwright test tests/e2e/second-profile.spec.ts` passes. It covers every `- [ ]` under `prd.md > Second Profile and Carb Budget`, and the copy sweep finds no "high", "normal", "dose" or "alert".
  Learner check: Set up a fictional second profile. Does it stay strictly arithmetic, with no advice?
  Commit: `Add a second profile with a clinician-given carb budget`

- [x] **26. Gym log with set types** (Tier 3, stretch 14)
  Becomes usable: Log a session: split, sets, weight per set, warm-up vs working sets, and drop sets, attached to a workout.
  Why now: Ahmed's Sep 24 note: "I feel I should really add that."
  PRD ref: `prd.md > Gym Log`
  Spec ref: `spec.md > Other Tier 3 Pieces`, `spec.md > Data Model`
  Build: `GymLog.tsx`, and the set data on workouts.
  Verify (mechanical): `npx playwright test tests/e2e/gym.spec.ts` passes. It covers every `- [ ]` under `prd.md > Gym Log`.
  Learner check: Log a fictional push day with a warm-up set and two working sets. Is it quick enough to do every session?
  Commit: `Log gym sessions with set types`

- [ ] **27. 3D touches** (Tier 3, stretch 15)
  Becomes usable: Brief UI animations, and an optional 3D view of the week chart (CSS 3D transforms). The plain view stays the default, and nothing moves under reduced motion.
  Why now: Ahmed's "3D interactive view ... Why not?", and only once everything with more value is done.
  PRD ref: `prd.md > 3D`
  Spec ref: `spec.md > Other Tier 3 Pieces`, `spec.md > Look and Feel`
  Build: The 3D toggle on the week chart, and animation polish of 150 ms or less.
  Verify (mechanical): `npx playwright test tests/e2e/three-d.spec.ts` passes. It covers every `- [ ]` under `prd.md > 3D`, including the plain default and the reduced-motion check.
  Learner check: Flip the week chart into 3D and back. Is it fun without getting in the way?
  Commit: `Add an optional 3D week view`

- [ ] **28. Runs, with a route from a file** (Tier 3, stretch 16)
  Becomes usable: Log a run (distance and duration, with pace worked out: 5 km in 30 min shows 6:00/km), and import a route from a GPX file to see its map and distance. The sample route is generated.
  Why now: Ahmed's Strava-like run idea, on the device. Live GPS waits for the phone app.
  PRD ref: `prd.md > Runs`
  Spec ref: `spec.md > Other Tier 3 Pieces` (`runs.ts`, `lookups/gpx.ts`)
  Build: `runs.ts` (golden G9 plus a distance golden), `gpx.ts`, the run view, and `fixtures/sample-route.gpx`.
  Verify (mechanical):
  - `npx vitest run` passes, including G9.
  - `npx playwright test tests/e2e/runs.spec.ts` passes. It covers every `- [ ]` under `prd.md > Runs`.
  Learner check: Import the sample route. Does the pace and distance look right?
  Commit: `Log runs with pace and routes from GPX files`

- [ ] **29. Ranges for protein, carbs and fat, and the sweat sodium note** (Tier 3, stretches 17–18)
  Becomes usable:
  - Each macro with a value gets its own likely and very likely range where its source has a checked or assumed error; others say "no range yet".
  - On workout days, a sodium note gives the typical sweat-loss range from a re-checked source, as information and never as a new limit. It's hidden if no source is confirmed.
  Why now: Ahmed said protein should sit "within that range" too, and asked about sweat sodium. Both build on the verified range maths.
  PRD ref: `prd.md > Ranges for Protein, Carbs and Fat`, `prd.md > Sweat Sodium Note`
  Spec ref: `spec.md > Maths Core: Sources Table` (macro errors), `spec.md > Maths Core: Estimates, Ranges and the Day`, `spec.md > Other Tier 3 Pieces`
  Build: The per-macro ranges (photo protein 61%, from Fridolfsson 2025; others assumption), the re-checked sweat-sodium source, and the note.
  Verify (mechanical):
  - `npx vitest run` passes. A photo-estimate meal with 40 g protein has a relatively wider protein range than calorie range.
  - `npx playwright test tests/e2e/macro-ranges.spec.ts` passes. It covers every `- [ ]` under both PRD headings.
  Learner check: Open a photo-estimate meal's protein. Does the wider range match your sense of how rough a photo is?
  Commit: `Add macro ranges and the sweat sodium note`

## Hands-on Checkpoints

- [ ] Early usable behavior explored: after slice 2 (the kernel and the Improve moment, the heart of the demo). Moved into the 2:30 PM sitting at Ahmed's request (see Revisions).
- [ ] Integrated core journey: after slice 7. All of Tier 1, which must ship, tried end to end: demo, improve, log, sleep and wake, your own log, sources.
- [ ] Final kick-the-tires exploration and feedback completed.

## Final Review

- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence:
Route and stops:
Edit outcome:
Reflection:
Activity mode:

## Revisions
- Early hands-on checkpoint (after slice 2) moved into the 2:30 PM sitting, together with the integrated and final reviews — Ahmed was studying for his 1:30 PM test and asked to keep building ("Skip the early checkpoint for now; I'll try everything at the 2:30 sitting. Keep building."); a frozen slice 2 copy was offered on port 5373 and not used.
- Slices 5 and 6 deferred (time), pending Ahmed's OK at the 2:30 PM sitting — their browser verification could not run between 12:58 and 1:45 PM (the other entry's video capture) and the feature freeze is 1:15 PM. Already built by earlier slices: Start empty with "Wake time not set", the header switch between the demo and your own log with separate storage, and wake-to-wake days. Not built: Reset demo, the "Open my log" label, the regroup preview when the first wake time is set (slice 5), and the sleep/wake editor with its order check and move warning (slice 6). The README lists them under Roadmap.
- Slice 7 result: every source stays "assumption" — the strict re-check (2026-10-26, two researchers plus a skeptic re-opening every citation) found no study whose own figure, for the matching method, backs the starting number. Each row now shows its nearest study, DOI and re-check date. Two findings point the other way: untrained descriptions (Block 2013) and exercise guesses (Willbond 2010) can be far less sure than 41% and 50%.
- `Meal.source` widened to allow `null` (slice 3) — a blank meal saved with nothing under "How do you know?" has no source; the day's maths counts only meals with both calories and a source.
- `movedMeals(meals, before, after)` takes the meals as its first argument (slice 4), unlike the spec's `movedMeals(before, after)` — a day is identified by the wake that starts it, so the function needs the meals to list.
- `npm run dev` runs Vite alone (same as `npm run dev:app`), and the `check:demo-lookup` script was removed — `scripts/dev.mjs` (Vite plus the Claude bridge) and `scripts/check-demo-lookup.mjs` belong to the Tier 2 connector and barcode slices, which weren't built, so the scripts pointed at missing files.
- Pre-ship privacy pass (audit, 2026-10-26; Ahmed approved option B): the carb-budget feature's reason no longer names a condition or a person, "Family profile" is renamed "Second profile" across scope, PRD, spec, checklist and README, and a `.gitignore` comment was made neutral. The feature is unchanged (Tier 3, not built).
- Scope of this submission (Ahmed, 2026-10-26): slices 5 and 6 stay deferred, and Tier 2 and Tier 3 (slices 8–29) were not started before the feature freeze. None of them is part of this submission; they are listed in the README Roadmap, with their designs in `prd.md`.
- Pre-ship audit fixes (2026-10-26): README steps 3 and 5 made exact (pick Nutrition label; sleep 4:40 AM, wake 1:10 PM), the golden-test claim narrowed to the maths rules, the photo hint no longer mentions an unbuilt connector, on-screen study context names no AI products, and the storage warning no longer offers an Export that isn't built.
- Test debt from slice 1 closed (build-out, 2026-11-05): `src/ui/__tests__/contrast.test.ts` now exists. It reads `theme.css` and checks every text colour against every light background at 4.5:1, and `--teal`, `--amber` and `--line-strong` against what surrounds them at 3:1. It found one failing pair: the amber fill of the uncertainty-share bar sat on a `--line` track at 2.77:1, so the track is now `--amber-bg` (3.25:1) with a `--line` border. It also works out, for every element the screens draw and every mix of states (hover and disabled together included), which colour and background the cascade gives it. That found a second failing pair: a disabled primary button under the mouse took the dark hover fill but kept the grey disabled text (1.23:1). The button hover rules now skip disabled buttons, and a browser test hovers the disabled Save buttons to confirm it. `tests/e2e/copy-sweep.spec.ts`, named in `spec.md > Screens`, now exists and applies the word rules to every view and sheet in the browser. A unit test also fails on user-visible text written straight into a UI file instead of `copy.ts`, including text passed to a component through a prop. Its known limit: a single word held in a variable or object before it is rendered isn't followed; the browser sweep still checks what renders.
- Golden cases G6, G7, G9 and G10: their values exist, but their assertions wait. Each one tests a kernel that isn't built yet: `net.ts` (slice 10), `plates.ts` (slice 11), `runs.ts` (slice 28) and `week.ts` (slice 8). Asserting them now would mean testing code that doesn't exist, or a stand-in that would pass without proving anything. So `scripts/golden.py` computes them from the spec's formulas with fictional inputs, and writes them to `fixtures/golden.json`. It also re-checks G1–G5, G11 and G12. `src/kernel/__tests__/golden-later.test.ts` checks the stored values against the numbers printed in `spec.md`, and lists each kernel's own test as `it.todo`. The slice that builds each kernel replaces its todo with real assertions on the same file. G9 adds a second pace case and a distance golden. The spec names haversine but no Earth radius, so it uses 6,371 km, recorded in the file.
- Slice 5 built (build-out, 2026-11-05), with the first open reshaped by the owner's decision that your own log is the main path: **Start my log** is the primary first-open action and the fictional demo a side door below it, each one tap. The header switch reads **Open my log** in the demo and **See the demo** in your own log (instead of the spec's Start empty / Try the fictional demo pair), and a reload opens the log used last (with no saved choice, a saved own log first, then a saved demo). **Reset demo** sits in the demo's More menu rather than beside the switch, which has no room on a phone. Its edited check compares the projection `{ profile, meals, sleeps, workouts, plates }` with sorted keys (and items in id order) directly against a fresh demo read back through the same save path, rather than a hash of it: the same answer without collisions. **Set wake time** offers today or yesterday with a time starting at 7:00 AM, and when meals exist it shows the regroup preview (which meals move into the new day and which stay before it) before saving. `tests/e2e/demo-and-my-log.spec.ts` runs every journey in each look.
- Repeat a usual meal (build-out, 2026-11-05), which no slice owned: **Log a meal** opens with **Saved** (meals saved as usual, in name order) and **Recent** (the last distinct meals logged, newest first, deduplicated by name and values, leaving out what Saved already offers), so a usual meal is logged in two taps, as a fresh meal with its own id and time. A short Logged line with Undo follows in the action bar, so it is in view however far the page was scrolled. The amount (×0.5, ×1, ×1.5, ×2 or a typed multiplier from 0.1 to 10) scales calories, macros and food amounts through `src/kernel/portion.ts`; the source and so the typical error fraction stay the same, so the spread and both ranges scale with the calories, and one meal at ×2 counts the same as that meal logged twice. Saved meals live in the log document under an optional `savedMeals` field (no format version bump; a log saved before it loads unchanged), so Export and Import carry them, and Reset demo's edited check now includes them. They are saved from a meal's details and renamed or deleted from **More** › **Saved meals** or from Log a meal; logged meals never change.
- Slice 10 workouts and net calories built (build-out, 2026-11-05), except the week view's net row, which waits for the week view (slice 8), so its boxes stay open. **Log a workout** sits in a Workouts section under the meals (on the Night timeline, workouts are points among the meals) and takes a name, **How do you know?** (device or watch estimate 40%, machine display 30%, rough guess 50%, each marked assumption, no default), calories burned, start time and duration; blank is unknown, never 0, and known calories need a source, as for a meal. A workout belongs to the waking day it started in, and is edited and deleted from its details. `src/kernel/net.ts` groups burned by source like a day (its own score and lognormal ranges) and gives net = eaten − burned with `sd = √(sd_eaten² + sd_burned²)` and normal ranges; G6 is asserted in `golden-later.test.ts`. With a workout on the day the headline is net, with **Eaten** (opens the meals, each opening its breakdown) and **Burned** (opens the workout list with burned's score and ranges) under it, and net's ranges open the net explanation with the resting-burn note. A day whose workouts all have unknown calories shows net as "Not available yet" rather than counting them as 0. The calorie target stays a target for eating: Journal's bar shows net and leaves the target marker off (the target line says it is for calories eaten), Panel's ring keeps eaten against the target, with net in its centre labelled "kcal net" and what the ring shows written under it, and Night's target chip says "for eaten". A net range with an end below 0 reads "lo to hi" in every look, and Journal's net bar marks 0. The workout list is a sheet rather than a dashboard drawer, and the tests are `tests/e2e/workouts.spec.ts` and a workout journey in `tests/e2e/looks.spec.ts`, each in every look. The saved shape needed no format version bump: the demo and the frozen version 1 logs already hold workouts in this shape, and the schema now checks them. Deficit or surplus, once a resting-burn estimate exists, comes in a later build-out item at the owner's request.
- Estimated deficit or surplus (build-out, 2026-11-05): the owner's later decision changed slice 10's "no deficit or surplus word". Net itself still carries none, but with age, sex, height and weight in **Profile and privacy** › **Body details** (also under **More**, and from the line that invites them under the headline), one line under the headline reads **Estimated deficit N kcal** or **Estimated surplus N kcal** with its likely range, and opens how it is worked out. Resting burn is Mifflin-St Jeor times an everyday-activity factor (1.2 by default, 1.375 or 1.55; workouts are added on top, once), spread over 24 hours and counted from the day's wake to the next wake or to now ("so far"). The range combines the meals', the workouts' and the equation's own spread (10%, an assumption with Frankenfield et al. 2005 as its nearest study); prefer not to say uses the midpoint of the two sex values with a wider range. Without the four details nothing is shown and nothing is guessed. Body details are an optional `profile.body` (no format version bump), carried by Export and Import and counted by Reset demo's edited check. Goldens E1 and E2 are in `scripts/golden.py` (`fixtures/golden-energy.json`), asserted in `src/kernel/__tests__/energy.test.ts`; `tests/e2e/balance.spec.ts` runs it in each look. Weight comes from body details; once a log holds weigh-ins, the latest one up to the day's end is used instead, and the explanation names it.
- Slice 6 built (build-out, 2026-11-05), with the two gaps it left open: adding a missed night and deleting a wrong one. The sleep and wake editor (`SleepEditor.tsx`) opens from the header's wake time, **Edit last night** in the sleep section (**Edit the night before Wed**, say, on an earlier day or when nothing was logged for last night, and the row under it names that night the same way; **Edit this sleep** while a sleep is going on; in the Night look, the timeline's wake point, marked Edit; its last point opens the night that ended the day), **Edit** on each night and on a sleep still going on, **Add a missed night**, and a link in **Set wake time** for the whole night. Each time has its own date field and a time field that takes shorthand (`8`, `8am`, `8:15 pm`, `20:30`), read by one parser (`parseClockTime()` in `src/kernel/parse.ts`) and shown back with AM or PM; the same field now serves **I'm going to sleep**, **I woke up** and **Set wake time**, so "I woke at 8" is: I woke up (or tap the wake time), type 8, Save; the editor opens with focus on the wake time (the sleep time for a new night), ready to type over. The order check is the kernel's `validateSleep()`, which now names the night an overlap runs into, leaves no room after a sleep still going on, and asks for a wake time when later nights exist; each message sits next to its field. Before an edit, a new night or a deletion changes an entry's waking day, a move warning lists each meal (and workout) with where it comes from and goes, using `movedBy()`, a generalised `movedMeals()`; nothing moves, no warning. Deleting asks first, with the same list, and **I woke up** shows the same list of what moves to the new day. With nothing logged for last night, the editor opened from the wake time says to use **Add a missed night**, which starts on the nearest date with no wake recorded. In the demo, whose clock moves forward to a later time, the date fields stop a day after its clock. `tests/e2e/sleep-editor.spec.ts` runs every journey in each look.
- Slice 20 built (build-out, 2026-11-05), except the week view's weight row, which waits for the week view (slice 8); its box stays unticked until then. Weigh-ins live in the log document under an optional `weighIns` field, `{ id, at, kg }` as the data model has it, plus the unit it was typed in, an optional body fat % and note, and for an import a mark that its time was not recorded (no format version bump; `fixtures/saved/v1-mine.json` loads and saves back unchanged). `settings.weightUnit` is how weights are shown. A weigh-in belongs to the waking day it was taken in, by the meals' rule. Beside the PRD's 7-day average, labelled with its count, the dashboard shows a trend: the least-squares slope over the last 21 days, per week, once there are 6 weigh-ins in that window spanning at least 4 days (so weighing in each morning shows it from the 6th), otherwise what it still needs; it is called a trend and never a prediction. The trend line is drawn in the weight details' chart of the last 30 days, with every point also in the list beside it, rather than under the weigh-ins on the dashboard. `scripts/golden.py` works out the average, the trend and its span rule (`fixtures/golden-weight.json`) and `src/kernel/__tests__/weight.test.ts` asserts them. `tests/e2e/weight.spec.ts` runs the journey in each look. `src/import/trackerWeighIns.ts` is ready for the tracker import, which does not call it yet: it reads the tracker's weigh-ins with pounds converted with the factor 0.45359237, body fat kept, the record's time when it has one, otherwise one minute after the first wake recorded on its calendar date (noon when there is none), marked as a time not recorded, and a second record on one date gets its own id. On an earlier day the weight details say they stand at the end of that day, and their latest weigh-in, average, trend and chart all do. Weigh-ins are dated entries like meals and workouts, so the sleep editor's move warning, its delete confirmation, **I woke up** and **Set wake time** list one that would change day.
- Slice 26 gym log built (build-out, 2026-11-06), with the sets grouped by exercise rather than the spec's flat `sets` list, and the session found across many dates. A gym session is a workout with an optional `gym` part (`{ unit, exercises: [{ name, sets: [{ kind, weightKg, reps, drops? }] }] }`; no format version bump, carried by Export and Import and counted by Reset demo's edited check), so its calories burned and source count in burned and net as for any workout, and its name is the split. **Add gym sets** sits in Log a workout; **More** › **Gym log** lists every session newest first, with every set, a search by exercise or split, and **Log a gym session**. Each set has a type in words (warm-up, working or drop set), a weight in kg or lb (stored in kg; blank is no weight, never 0; switching the unit converts what is typed) and reps; a drop set lists its drops. **Add set** copies the set above and **Copy last session** starts from the previous session. Each exercise shows its previous best, the best working set from earlier sessions (heaviest, then most reps; warm-ups and drop sets left out, nothing estimated). The dashboard shows the day's gym sessions right below the weight section in every look, and nothing on a day without one. Gym weights show in the unit of the latest gym session (with none yet, the weight log's), and saving a session never changes the weight log's unit (`settings.weightUnit`). An exercise logged before with only warm-ups or drop sets says it has no earlier working set. `tests/e2e/gym.spec.ts` runs each journey in every look.
- Slice 8 built (build-out, 2026-11-06), widened to the average of every stat, which also fills the week view's net row (slice 10) and weight row (slice 20), so those two slices are now complete. **Week** sits under previous and next (and under **More**) and opens a sheet with the 7 waking days ending at the day on screen (fewer only from the start of a log, which the heading says, on today or an earlier day); the current day counts with what is logged so far and says so, in a note and in each count that includes it ("average of 4 complete days and today so far"). `src/kernel/week.ts` holds the maths: the calorie average over complete days with the week's meals grouped by source (golden G10, asserted in `golden-later.test.ts`), macros and the days' Estimate scores over the days where every meal has the value, burned in workouts, net and the estimated deficit or surplus (a day with no workouts counts 0, a workout with unknown calories leaves its day out; the balance's resting-burn spread is added straight across days, as one equation for one person, and the breakdown says so), workout time, and sleep length, sleep time and wake time over complete nights with the clock times as circular means, like the dashboard's 7-night figures. Burned's Estimate score (the one beside burned in the workout list) is the mean of the days whose workouts are all known. Weight averages every weigh-in in the week once and shows the dashboard's trend; body fat and sets per gym session follow the same rules. Every average names its count ("average of 5 complete days (1 incomplete left out)", "6 of 7 nights", "average of 4 weigh-ins on 3 of 7 days") and opens a day-by-day breakdown listing each day's value and whether it was counted, left out and why, or not logged; a day opens on the dashboard. The calorie breakdown draws the spec's SVG bars with range whiskers (dashed for known meals only, none for not logged), and every number on it is also in the list. Instead of fixed slots for later meters, `src/kernel/statRegistry.ts` lists every stat once with the saved fields and day values it reads, and lists what is not a stat with a reason; `src/ui/__tests__/week-view.test.ts` fails when the saved log's schema or a day's values (read one level into the day's estimate, burned, net and macros) hold anything no stat reads (and the numbers of the weight and balance views, so a figure derived from existing data needs a stat too), and TypeScript fails until a registered stat has its week row (`src/ui/weekStats.ts`), so the gut meters and any later stat must add one. `tests/e2e/week.spec.ts` covers every check under `prd.md > Week View` in each look.
- Every dashboard number opens its detail (build-out, 2026-11-06), which no slice owned. Each macro (Journal's row, Panel's tiles, the macros under Night's chip) opens its own detail: each meal's value with its source and share of the known total, the target, and that a meal with no value is left out and counted as missing (the total then reads "at least"; a day with no meals says no meals are logged, never 0 g); there is no macro range yet, as `prd.md` keeps macro ranges for Tier 3. Last night and the 7-night average open new sleep details with the night's two times, its length, the average's count and each night with Edit. The headline number opens the meals behind it (net: the net explanation), unknown counts open what they count, Journal's target line opens the targets editor, and Panel's share of the day's uncertainty opens the day explanation. The meal row's score is its own button, so the meal-score explanation is one tap from the dashboard in every look, while the rest of the row still opens the meal's details. A meal's details now list the `foods` and the `lookup` stored on it (saved before but shown nowhere), with their amounts; the foods carry no values of their own, so the meal's totals stay the ones saved with it, and a lookup the meal's source no longer uses (after an edit) says so. Every dashboard number carries `data-opens`, naming what it opens; `tests/e2e/tap-through.spec.ts` taps each one in every look (the words "unknown" and "not logged" count as numbers) and fails on a number without it, and opens every disclosure to check what is inside. No saved format change. The **Foods in this meal** editor of the gut-friendly diet score (slice 15) is still to come; this only shows the foods already saved.
- Import from the author's earlier tracker (build-out, 2026-11-05): Profile and privacy's Import also reads an export of that tracker, told apart from a HowSure export by its shape, and converts it into your own log (`src/import/trackerBundle.ts`). The preview says what it becomes and everything the conversion did before anything is replaced, and an import over a log that holds anything keeps it as an older copy first. Each meal keeps its stored day, calories and macros and every original field under one `imported` key. Its time is placed in its waking day by its meal type and marked approximate. A meal can now carry its own typical error (`Meal.typicalError`): an imported meal uses the tracker's figure for it, with that tracker's floor, and its details say so beside HowSure's figure for the source. The tracker's independent-restaurant code maps to Food database. When the current day's wake is more than a day old, the header says when the last wake-up was and offers to set today's wake time, the estimated deficit or surplus waits for the next wake instead of counting days of resting burn (any earlier day that runs for more than 36 hours to its next wake, a night likely missing, isn't counted either), and an empty day that comes more than a day after the log's latest meals links to them. An imported meal whose calories or source are changed later drops the tracker's figure, and its details say so; Improve never suggests the source a meal already has. Weigh-ins go into the weight log (slice 20) through `src/import/trackerWeighIns.ts`: lb to kg exactly, body fat kept, the recorded time or one placed just after that date's wake and marked approximate, shown in lb. An ended day that ran for more than 36 hours says so under its headline in every look, and while the current day's wake is days old, the sleep section on an earlier day names that wake ("Now: no sleep logged since the wake-up on Sat 17 Oct") instead of reading as the viewed day's own. **Replace my log** uses the destructive style. Tests use a fictional export for Sam (`fixtures/tracker-bundle-sam.json`).
- Slice 18 built (build-out, 2026-11-06), with the PRD's 4-day option made real. **Timeline** sits beside **Week** under previous and next (and under **More**) and opens a sheet with the 3 waking days ending at the day on screen, or 4 with the day before (fewer only from the start of a log, which its heading says). `Timeline3Day.tsx` draws each day with a wake time as one row on a shared scale, starting at its wake, so the days line up: an SVG for the track, hour ticks, midnight lines (named by the new date's weekday), the wake bar (at the start, and at the closing wake), the dashed expected-sleep line and the marks (a dot per meal and a diamond per workout, hollow amber with unknown calories; a square per weigh-in, not drawn when its time was not recorded; a filled triangle for now, a shape no entry uses; the rest of today dotted from now up to expected sleep, never past it, on the current day only and while awake; a mark too close to the one before moves just above or below the track), with the night that ended the day as a block, its length written above it (dashed while still asleep). Its legend names only the kinds of mark drawn, so a timeline ending on an earlier day has no key for now. A night with no sleep start is a hatched stretch from the last entry to the closing wake, marked "sleep start not logged", so an unknown sleep is never drawn as time awake. The drawing is aria-hidden; under it, **Each day** lists every entry in time order (gym sessions and weigh-ins included, which the PRD's line did not name), and each one opens its details (the wake and the closing night open the sleep editor), with its day on screen behind it, coming back to the timeline at that entry. Expected sleep is `expectedSleepMs()` in `src/kernel/sleepday.ts`: the wake plus the usual day length, counted as hours that pass. The usual day length is an optional `profile.usualDayHours` (6 to 23 h in half hours, 16 h until set; no format version bump; carried by Export and Import; counted by Reset demo's edited check as its own line; choosing 16 h again removes it, back on the preset), chosen at the top of the timeline and labelled "your setting, not advice". The day before the first wake time has no wake to draw from, so it is listed and not drawn. The per-day list starts from the Night look's point builder (`nightTimeline.ts`). `tests/e2e/timeline.spec.ts` covers both PRD checks in each look.
