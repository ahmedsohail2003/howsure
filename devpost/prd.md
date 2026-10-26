---
doc: prd
status: approved
---

# HowSure — Product Requirements

**HowSure: food estimates, explained.** A calm, simple food, weight and sleep tracker for Ahmed and people like him who want detailed nutrition tracking without complicated logging or navigation. Every calorie estimate says how much to trust it, what research or assumption that rests on, and what would make it better; other numbers say what is known and what is missing.

**Build tiers** (`scope.md > The POC Boundary`):
- **Tier 1** is the core and must ship.
- **Tier 2** holds the vision features with the most value per hour.
- **Tier 3** is the stretch list, built in order.

A tier starts only when the one before it is verified. Sections and bullets without a tier label are Tier 1. Each Tier 2 and Tier 3 feature has a **Why:** line traced to Ahmed's idea notes (`devpost/ideas-verbatim.md`, private) or his interview answers, and each deferred item names what it waits on. Tier 1 sections come from Ahmed's approved answers (Answers 1–3), cited as Source: where one applies. Anything marked **(Ahmed accepted the default, 2026-10-26)** was a reviewer's default that Ahmed accepted (`Open Questions`).
Source: `scope.md > The Unique Kernel`, `scope.md > Who It's For`.

## The Core Journey
Source: `scope.md > The Core Loop`, `scope.md > What "Working" Looks Like`.

**Tier 1, the spine:**
1. **Arrive.** The first open shows two choices: **Try the fictional demo** (primary) and **Start empty** (secondary). Both go straight to the dashboard.
2. **Read the day.** In the demo, the dashboard shows:
   - the sample person's current waking day and when it started;
   - the calorie estimate, with its likely range and estimate score underneath;
   - a protein/carbs/fat row;
   - the meal list;
   - last night's sleep length and the 7-night average, in the sleep section.

   One line says which meal adds the most uncertainty.
3. **Ask "how sure?"** Tap the day's estimate score. A short explanation says how the meals combine into the day's uncertainty, shows each meal's contribution, and names the biggest contributor and what better evidence would change. The calculation and sources sit under **More detail**.
4. **Improve the weakest meal.** Tap **Improve that entry**. The meal's edit sheet opens with its current values. Change the evidence source to the nutrition label and enter the label's numbers. A before/after preview shows the meal and the day. Save: the meal, the day's total, ranges, score and the biggest-uncertainty line all update together from the real calculation.
5. **Log a new meal** in a few taps: name, how you know, calories, date and time. Saving returns to the dashboard with everything updated. Tap the meal to see its breakdown.
6. **See the waking day hold.** The demo's after-midnight snack sits on the same waking day as the afternoon's meals, because the person hasn't slept yet. The date changing doesn't move it.
7. **Reload.** Everything is still there.
8. **Sleep and wake.** **I'm going to sleep** closes the waking day, and **I woke up** starts the next one. Earlier days stay saved and reachable, and the new night counts toward the 7-night sleep average.
9. **(Ahmed accepted the default, 2026-10-26)** Under the likely range sits a **very likely range**. Tapping either one opens the range explanation, with the planning line "Staying under a target? Count the top of the very-likely range." More detail names the **published study** behind each source's typical error.

**Tier 2 additions to the same journey:**

10. The header shows the person's **gamer-tag name**, e.g. "BraveKefir#4821".
11. Logging a meal can use a **barcode lookup** (in the demo, a saved copy labelled as saved) or a **saved plate**: weigh the plate once, then food = scale reading − plate.
12. Logging a **workout** turns the headline into **net calories**, with eaten and burned underneath. Each range is one tap away.
13. The **week view** shows each waking day's calories with both ranges, sleep per night and its averages, and (once built) the **gut-friendly diet score** with its "how this is computed" panel.
14. **Send a meal photo to your Claude.** Claude's proposal appears in HowSure's **From Claude** inbox with its stated guess. Tap **Add**, and it joins the day with a photo estimate's ranges.

Success:
- Someone watching the demo video sees the range narrow for a real reason, and understands why the after-midnight snack stays on the waking day.
- Tapping any calorie estimate, range or estimate score shows the research and assumptions behind it (Tier 2: also each gut meter, through "How this is computed").
- The video script uses only verified features.

## Screens and Layout
HowSure is one main screen, the **dashboard**, plus sheets that open over it, plus a **week view**. Tier 2 surfaces are marked; `4-spec` places Tier 3 surfaces when they are reached.

- **First-open screen.** The two choices: **Try the fictional demo** and **Start empty**.
- **Dashboard**, top to bottom:
  1. **HowSure**, the guest name (Tier 2), the label **"Sample person — fictional"** (demo mode only, always visible there), and the current waking day with its wake time. Tapping the wake time opens the **sleep/wake editor**. With no wake time yet, this shows **"Wake time not set"** with **Set wake time**.
  2. The main **calorie estimate**, with its **likely range**, **very likely range** (Ahmed accepted the default, 2026-10-26) and a tappable **estimate score** underneath. With workouts logged (Tier 2), the headline is **net calories**, with **eaten** and **burned** in smaller text as single numbers.
  3. A compact **protein / carbs / fat** row.
  4. **Missing information** (only when some meals have unknown calories): those meals, listed as things to improve.
  5. **From Claude** (Tier 2, only when there are proposals): meals proposed through the Claude connector, each with **Add** and **Dismiss**.
  6. One useful action: **"Most uncertainty comes from [meal]"**, with **Improve that entry** (see `Improve That Entry` for when it is hidden).
  7. A prominent **Log a meal** button, and **Log a workout** (Tier 2).
  8. The **meal list**. Each row shows name, time, calories, evidence source and estimate score, and no range.
  9. A small **sleep section**. It shows awake or asleep status, last night's sleep length and the 7-night average with its night count, the one relevant button (**I'm going to sleep** or **I woke up**), and **Edit**.
  10. **Previous / next** controls or a date picker to move between waking days, and **Week** (Tier 2).
- **Switching between the demo and your own log** is available after the first open. Inside the demo there is also **Reset demo**. `4-spec` places both.
- **Log a meal sheet** (also used to edit a meal): see `Logging a Meal`. It also has **Look up a barcode**, **Use a saved plate** and **Foods in this meal** (Tier 2).
- **Meal details**: breakdown, evidence source, assumptions, what would improve it, gut tags (Tier 2), **Edit** and **Delete**.
- **Estimate explanation sheet**: for one meal's score, for the day's score, or for the ranges, each with **More detail** and the study behind each source.
- **Workout list** (Tier 2): opened by tapping burned. Each row shows name, time, duration, calories burned and how you know, and the header shows burned's range. Tap a workout for its details (burned with its range, score and source), **Edit** and **Delete**.
- **Sleep/wake editor**: see `Editing Sleep and Wake Times`.
- **Week view** (Tier 2): see `Week View`.
- **Profile and privacy** (Tier 2): guest name, plates, export, delete, the Claude connector switch, and what has been sent off the device. `4-spec` places its entry, for example tapping the guest name.

## Look and Feel
Source: Ahmed's answers; `scope.md > Inspiration & Identity`.
- **Mood:** a well-organised journal. Quiet, precise, easy to scan. Calm and simple, with detail revealed by tapping rather than everything competing for attention.
- **Theme:** light. Warm off-white background, dark charcoal text, **muted teal** for primary actions, **restrained amber** for uncertainty or incomplete information.
- **Colour is never the only signal:** every colour has a text label alongside it.
- **Type:** a clean, readable font such as Segoe UI, with clear numerals and comfortable spacing.
- **Hierarchy:** the headline number (calories, or net calories once workouts are logged) has the strongest visual emphasis. Supporting detail sits behind taps rather than filling the dashboard with cards.
- **Details:** subtle borders, minimal shadows, brief animations.
- **Avoid:** ads, marketing, dashboards crowded with cards.

## Features and Behavior

### First Open
Source: `scope.md > The POC Boundary` (fictional demo).
- **Try the fictional demo** loads a fictional sample person and goes to the dashboard. The demo data supports the whole journey:
  - the current waking day crosses midnight and includes an after-midnight snack;
  - meals use mixed evidence sources;
  - one rough meal is a **photo estimate** and is clearly the biggest uncertainty. Its note shows the label's values (calories and macros) for the presenter to type in by hand. They are not filled in automatically;
  - six earlier waking days, one with nothing logged, and one night with no recorded sleep start, so the 7-night sleep average and the week view have real gaps to show;
  - for Tier 2 and 3: a workout on an earlier day (the presenter logs today's live), a kefir meal and other meals with their foods listed, a saved plate, and a saved barcode lookup. The people and meals are fictional and labelled. The saved lookup is a verbatim Open Food Facts response with its fetch date, never edited or invented, chosen for a plain generic product name (checked by a command before recording).
- **Start empty** goes to your own log, with no meals and no wake time set.
- [ ] A first open shows both choices, with the demo as the primary action.
- [ ] In demo mode, "Sample person — fictional" is visible on every view.

### Demo and My Log
- After the first open, you can switch between the demo and your own log. Their data is kept separate.
- Once your own log has entries, the action is called **Open my log** instead of **Start empty**.
- Switching never changes or loses entries in either log.
- **Reset demo** restores the original fictional data and affects only the demo. If the demo has been edited, it asks for confirmation before discarding those edits.
- [ ] Log a meal in your own log, switch to the demo, then switch back: your meal is still there, and the demo never showed it.
- [ ] With entries in your own log, the switch action reads **Open my log**.
- [ ] Edit a demo meal, then tap **Reset demo**: a confirmation appears. Confirming restores the original demo data, and your own log is unchanged.

### Dashboard
Source: `scope.md > The Core Loop`.
- [ ] The calorie estimate shows a best estimate, a likely range and an estimate score, in that visual order of emphasis.
- [ ] Protein, carbs and fat show their known totals. A macro with any missing value says how many entries are missing it. On a day with meals, a macro with no values at all says "unknown".
- [ ] "Most uncertainty comes from [meal]" names the meal the calculation says contributes most, never a hard-coded one. When some meals have unknown calories, the line says explicitly that it covers the known meals.
- [ ] Each meal row shows name, time, calories (or "unknown"), evidence source and estimate score.

### Logging a Meal
Source: `scope.md > The POC Boundary` (quick manual meal logging, including how the number was obtained).
**Log a meal** opens a compact sheet, in this order:
1. **Meal name.**
2. **How do you know?** Weighed, nutrition label, published menu, photo estimate, or description. It has no default: with calories entered, Save stays disabled until one is picked, with the hint "Pick how you know, so HowSure can say how sure." With calories blank, it can stay empty.
3. **Calories**, typed in by hand.
4. **Date and time**, defaulting to now. Logging from a previous day defaults to that day. The waking day the meal will belong to is shown clearly next to it.
5. **Optional details**, collapsed at first: protein, carbs, fat, and a short source or assumptions note.
6. **Save** and **Cancel**.

**Foods in this meal (Tier 2, built with the gut score).** Inside Optional details, pick foods from the built-in food list (e.g. chicken, olive oil, broccoli, kefir), each with an amount (default one serving; g, oz or servings). The meal name pre-fills likely matches for you to confirm. Each food carries its gut tags and its fiber per 100 g (from a named USDA FoodData Central entry, credited "Source: USDA FoodData Central" in the app and README), all editable. Calories stay the meal's typed total. A meal with no foods listed counts as untagged.
**Why:** Ahmed (Sep 20) wants to record what goes into cooked food, such as olive oil, and his Sep 26 note proposes scoring the gut by logging ingredients.

- [ ] Saving returns to the dashboard, and the totals, range, score and biggest-uncertainty line are already updated.
- [ ] Blank protein, carbs or fat are saved as unknown, never as zero.
- [ ] Typing calories without picking a source keeps Save disabled and shows the hint.
- [ ] Changing the date and time to one in another waking day changes the waking-day label shown in the sheet before saving.
- [ ] Logging from a previous day defaults the date to that day.
- [ ] Cancel discards the entry and changes nothing.

### Calorie Input Rules
- **Blank:** the meal can be saved with calories **unknown**. The day is shown as incomplete, and the missing value is never treated as zero.
- **Letters or a negative number:** a clear inline error appears and Save is blocked until it is corrected or cleared to unknown. Everything else entered is preserved.
- **Zero, typed on purpose:** valid, and distinct from blank.
- [ ] Typing "abc" or "-50" shows an inline error, Save is disabled, and the name, source, date and time stay filled in.
- [ ] A meal saved with 0 calories shows 0, and the day is not marked incomplete because of it.

### Days With Unknown Calories
- **Partly known day:**
  - The known subtotal, its range and its score are shown, clearly labelled **"Known meals only — incomplete day"**. The number of meals with unknown calories appears next to that label.
  - Meals with unknown calories appear under **Missing information**, above the calculated uncertainty ranking. They can be priorities to improve, but they get no invented numerical uncertainty contribution.
  - "Most uncertainty comes from…" explicitly refers to the known meals.
- **Every meal unknown:** the meal list and the unknown count are shown, and calories, range and score say **"Not available yet"**. This is different from a day with no meals logged.
- [ ] With one unknown meal among known ones, the day shows "Known meals only — incomplete day", the count "1 meal with unknown calories", and that meal under Missing information with no number.
- [ ] The uncertainty ranking lists only known meals, and the biggest-uncertainty line says it covers the known meals.
- [ ] With every meal unknown, the meals are listed with the unknown count, and calories, range and score say "Not available yet". There is no "No meals logged yet" message.

### Meal Details, Edit and Delete
- Tapping a meal shows its breakdown:
  - calories and macros;
  - evidence source;
  - assumptions or note;
  - its estimate score and ranges;
  - what would improve it, for example "a nutrition label would lower the typical error from X% to Y%".

  It also has **Edit** and **Delete**.
- **Edit** opens the same sheet as logging, filled with the meal's current values.
- **Delete** removes the meal, and the day updates.
- [ ] Editing a meal's calories updates its row and the day's totals, range and score.
- [ ] Deleting a meal removes it from the list and from every total.

### Estimate Score and Explanations
Source: `scope.md > The Unique Kernel`.
- The percentage is labelled **Estimate score**, never "accuracy".
- **A meal's score**, explained in these words: "A 90% estimate score means this source is assigned a typical error of about 10%. It does not mean there is a 90% chance this meal is correct. The actual error could be larger."
- Each score shows whether its typical error comes from a **checked source** or an **assumption**. The typical error is the cited study's reported figure for the matching method (e.g. an AI app's estimate from a photo: energy MAPE 35.8%, Fridolfsson 2025), never a remembered or preferred value. Every source's label and study come from one sources table that `spec.md` defines, including which method "photo estimate" means.
- **The likely range** is explained separately, opened by tapping the range. It is not a guaranteed minimum and maximum.
- **Very likely range** (Ahmed accepted the default, 2026-10-26). Wherever a range is shown (the day's headline, meal details, the range explanation and the week view), a wider range also appears, meant to catch about 19 in 20 meals like it; the likely range is meant to catch about 8 in 10. Meal rows show no range. The ranges are wider for a photo estimate than for a label or a weighed entry. Widths derived from a study are labelled "HowSure's calculation from [study]", not a finding of the paper. The range explanation adds the planning line "Staying under a target? Count the top of the very-likely range." and the honesty line "Not a guarantee. Photos, menus and even nutrition labels can be off. Scan the label or weigh it to tighten this."
- **These coverage rates are design targets.** The app shows a measured hit rate ("checked on N test meals: X inside") only if a script actually ran it on reference meals whose values were known independently of HowSure (never the fictional demo or the app's own outputs). The line names the reference set, where its values came from, and the kinds of meals and sources it covers, and is not claimed for other meals.
- **Studies behind each source** (Ahmed accepted the default, 2026-10-26). More detail lists, for each evidence source, its typical error, its basis (a study with author, year and DOI, and the date it was re-checked, or "assumption"), and one plain line on what the study found.

  **Why:** Ahmed's Sep 28 note asks the app to "reference it" so people "have confidence in the actual sources". He also wants a range he can count on, which he called "for sure" (Answer 4). The very likely range is the honest replacement for "for sure": none of the 21 sources re-checked supports a guaranteed minimum and maximum for one meal (resolved in `Open Questions`).
- **The day's score**, explained in these words: "Each meal contributes calories and uncertainty. A large, uncertain meal can affect the total more than a small one. We combine those uncertainties and compare them with the day's total—we don't simply average the meal percentages." Below that come each meal's contribution, the biggest contributor, and what better evidence would change. More detail states the limit: "This assumes each meal's error is separate. Errors from the same kind of source can lean the same way: photo estimates and people's own guesses tend to run low on big plates. So a day of photo meals may be less sure than this shows."
- The main explanation stays short. The calculation and supporting sources sit under **More detail**.
- **Calories only, for now:** the range and estimate score apply to calories. Protein, carbs and fat show known totals and unknown counts, with no range.
- `spec.md` defines the combination method and its assumptions explicitly, and supplies independently calculated expected results for its tests.
- [ ] Tapping a meal's score shows the meal explanation with that meal's numbers and its checked-or-assumption label.
- [ ] Tapping the day's score shows the day explanation and a per-meal contribution list, biggest contributor first.
- [ ] More detail on the day's score lists each meal's calories and typical error, the combined result, and the source or assumption behind each typical error, and states the independence assumption and its limit.
- [ ] Tapping the likely range shows the range explanation, including that it is not a guaranteed minimum and maximum.
- [ ] The day's score comes from the combined calculation, not the average of the meal scores. It matches the expected results `spec.md` calculates for its test days. *Illustration only, not a target:* one 1,000 kcal meal at score 70 plus three 100 kcal meals at score 95 has a simple average of 88.75. If the errors were independent, the day would come out at about 77.
- [ ] A text search of the app's user-visible strings finds "accuracy" only inside cited study titles, never as a label for the score; finds no "for sure"; and every "guarantee" appears inside a negation ("not a guarantee", "not a guaranteed minimum and maximum").
- [ ] (Ahmed accepted the default, 2026-10-26) Wherever a range is shown, both the likely and the very likely range appear; meal rows show none. The very likely range is wider, and both are wider for a photo estimate than for a label of the same calories.
- [ ] (Ahmed accepted the default, 2026-10-26) More detail for a source shows its typical error and either a study (author, year, DOI, re-check date) or the word "assumption".

### Improve That Entry
Source: `scope.md > What "Working" Looks Like` (step 3).
- **Improve that entry** opens that meal's edit sheet with its current values filled in.
- The sheet highlights the evidence source, the assumptions, and what information would improve the estimate.
- You can change the source and enter revised nutrition values.
- A compact **before/after preview** shows the meal's estimate and the day's estimate, range and score.
- Changes apply only on **Save**.
- After saving, the meal, daily total, range, estimate score and biggest-uncertainty message update together. Every change comes from the actual calculation. The range is never forced to narrow when the new information doesn't justify it.
- If the biggest contributor already uses the source with the lowest typical error, the line reads "Most uncertainty comes from [meal]. It already uses the most reliable source." and **Improve that entry** is hidden. The meal's details say "No better source in HowSure."
- [ ] In the demo, re-logging the photo-estimate meal from its note's label values visibly narrows the day's range and raises the day's score. The preview's numbers match what the dashboard shows after Save.
- [ ] Closing the sheet without saving leaves everything unchanged.
- [ ] After Save, the biggest-uncertainty line names whichever meal now contributes most.
- [ ] On a day where the biggest contributor already uses the best source, no **Improve that entry** button appears.

### Sleep and Waking Days
Source: `scope.md > The POC Boundary` (meals grouped by waking day); Answer 4 ("the Sleep length and averages we do need that").
- The sleep section shows the current status and one button: **I'm going to sleep** when awake, **I woke up** when asleep.
- Both default to now, and the date and time can be edited.
- Going to sleep closes the current waking day. Waking up starts the next. Every logged sleep ends the waking day, so naps aren't logged for now (Ahmed accepted the default, 2026-10-26).
- A meal belongs to the waking day it was eaten in, whatever the calendar date.
- **Sleep length:** the sleep section shows last night's sleep length and the 7-night average sleep length with its night count (e.g. "6 of 7 nights"). A night with a missing sleep or wake time shows "not logged" and is left out of the average.
- **Before a wake time is set** (Start empty): meals can be logged straight away. They keep their dates and times, in a **provisional day** that doesn't reset at midnight. When sleep or wake times are confirmed and would regroup those meals, the affected meals are previewed before the change applies. Nothing disappears.
- [ ] In the demo, a snack logged after midnight, before sleep, appears on the same waking day as that afternoon's meals.
- [ ] After **I'm going to sleep** then **I woke up**, the dashboard shows a new, empty waking day, and the previous day is reachable with **previous** or the date picker.
- [ ] The sleep section shows last night's length and the 7-night average labelled with its night count.
- [ ] A night with no recorded sleep start (the demo seeds one) shows "not logged" and is left out of the 7-night average, whose count includes only recorded nights.
- [ ] In Start empty, the header shows "Wake time not set" with **Set wake time**. Meals logged before and after midnight stay together in one provisional day.
- [ ] Setting a wake time that would regroup provisional meals previews which meals move before applying. After applying, every meal is still present.

### Editing Sleep and Wake Times
- Open the **sleep/wake editor** by tapping the wake time in the header, or with **Edit** in the sleep section, including when viewing a previous day.
- It uses explicit dates and times, so overnight sleep is unambiguous.
- For a recorded sleep period, waking must happen after that period's sleep start. If the order is invalid, an inline explanation appears, the inputs are kept, and the saved record stays unchanged.
- Before saving a valid correction that changes which day meals belong to, the editor names the meals that would move and asks for confirmation.
- **Build order:** this warning is built after core journey steps 1–7 are verified. The correction feature isn't complete until the warning works, and it must be verified before the final review.
- [ ] Tapping the wake time, or **Edit** in the sleep section (on today or a previous day), opens the editor with that period's dates and times.
- [ ] Setting a wake time before its sleep start shows an inline explanation, keeps the typed values, and leaves the saved record unchanged.
- [ ] A valid correction that would move a meal to another day names that meal and asks for confirmation. Cancelling changes nothing, and confirming moves it.

### Previous Days
- Earlier waking days stay saved, are reachable through previous/next controls at the bottom of the dashboard or a date picker, and can be edited.
- [ ] From today, **previous** or the date picker shows yesterday's waking day with its own meals, totals and score. Editing a meal there updates that day only.

### Saving
- Everything is saved on the device and survives a reload, separately for the demo and for your own log.
- [ ] After logging, editing or deleting a meal, logging or editing sleep, or switching logs, a page reload shows the same data.

### Week View
**Tier 2.** Source: `scope.md > The POC Boundary`.
**Why:** Ahmed asked for "the weekly average of all of the stats. And it gets updated everyday" (Sep 26) and for sleep on the dashboard (Sep 24). Sleep length and its 7-night average are Tier 1 because he said they are needed now; the full week is still built only after Tier 1 is verified, as he asked in Answer 2.
- The week view shows the seven waking days ending at the day being viewed. It rolls forward as days pass, so it is "updated every day".
- **Calories:** each logged day shows its estimate with **both ranges**. Unlogged days look visibly different from logged days with zero calories. An incomplete day shows its known subtotal, marked "incomplete".
- **Averages:** calories, protein, carbs and fat. A day counts toward an average only if that value is known for every meal that day. Other days are left out and counted, e.g. "average of 5 complete days (1 incomplete left out)". If no day qualifies, the average says "Not available yet". The calorie average also shows its likely range (method in `spec.md`), with the line "Weekly totals are steadier than single meals, but photo estimates tend to run low on big plates."
- **Sleep:** each night's sleep length, the week's average sleep length and the average wake time. Each states how many nights it includes. A night with a missing sleep or wake time is shown as "not logged", never as 0 h. Average wake time is a clock average that wraps at midnight.
- **Gut-friendly diet score** (once built): the week's three meters (see `Gut-Friendly Diet Score`).
- **Net calories and weight** appear here when those features are on (Tier 2 workouts, Tier 3 weight).
- [ ] Seven days are shown. Each logged day has its estimate and both ranges, and the demo's unlogged day is clearly marked as not logged.
- [ ] Every average is labelled with its count, e.g. "average of 5 complete days (1 incomplete left out)" or "6 of 7 nights".
- [ ] A day with one unknown-calorie meal is left out of the calorie average and counted in its label.
- [ ] Wake times of 23:50 and 00:10 average to 00:00, not 12:00.
- [ ] Moving to the next waking day shifts the week by one day.

### Guest Profile and Gamer-Tag Name
**Tier 2.**
**Why:** Ahmed: "If the user doesn't sign up give them a generic username. Not like user-12381931 ... but something random that still works like those random Xbox gamer tags."
- On first use of your own log, the app generates a name: a clean adjective + noun (11 letters at most) + "#" + 4 random digits, 16 characters at most. Examples: "BraveKefir#4821", "SneakyMiso#0937".
- **Reroll** gives a new name. **Rename** lets you type your own: letters and digits, 16 characters at most.
- The name is labelled **"Guest: saved on this device only"**.
- The demo person has a fixed fictional gamer-tag name saved in the demo data, next to "Sample person — fictional". Reroll and Rename apply only to your own log.
- [ ] Starting your own log shows a generated name matching the pattern (letters + "#" + 4 digits, at most 16 characters).
- [ ] Reroll changes it. Rename accepts "Ahmed2026" and rejects an empty name or one over 16 characters, with an inline message.
- [ ] The name survives a reload.

### Workouts and Net Calories
**Tier 2.**
**Why:** Ahmed (Sep 28): "the main calorie stat should be net calories", with "number of calories consumed" and "number of calories burned so far" in smaller text. Each one drills down: consumed → meals → the meal breakdown; burned → "the main workouts". He also wants net to show "if you're in a deficit or in a surplus" (resolved in `Open Questions`).
- **Log a workout:** name, date and time, duration, calories burned, and **"How do you know?"**: a device or watch estimate, a machine's display, or a rough guess. A burned estimate has its own typical error and range, like food. Each typical error is marked "assumption" until `spec.md` cites a checked source. A workout belongs to the waking day it started in, like a meal.
- **With at least one workout that day,** the headline is **net calories = eaten − logged workouts**, and its range combines both uncertainties. Eaten and burned show in smaller text underneath as single numbers. Tapping the net range opens its explanation, which shows eaten's and burned's ranges and how they combine. Tapping eaten opens the meal list; tapping burned opens the workout list, which shows burned's range.
- **No deficit or surplus verdict** (Ahmed accepted the default, 2026-10-26). Net's explanation says: "Not your full energy balance: your body's resting burn isn't counted, so net alone can't show whether you ate more or less than you burned."
- **Scores:** the score under the headline is the eaten score, labelled "Eaten: estimate score N". Net shows its ranges but no score, because a percentage of a number near zero says nothing. Burned shows its own score in the workout list. The biggest-uncertainty line and **Improve that entry** cover meals only.
- **With no workouts,** the headline stays calories eaten (Tier 1).
- The demo's workout is on an earlier day, so the Tier 1 journey keeps its eaten headline; the presenter logs today's workout live (journey step 12).
- [ ] Log a 300 kcal "rough guess" workout: the headline switches to net calories, eaten and burned appear underneath, and tapping burned shows the workout and burned's range.
- [ ] The net range is wider than the eaten range alone.
- [ ] With a workout logged, the score under the headline is labelled as the eaten score, and adding the workout doesn't change it.
- [ ] (Ahmed accepted the default, 2026-10-26) With a workout logged, net's explanation shows the resting-burn note, and the app never says deficit or surplus.
- [ ] Deleting the only workout from the workout list brings back the eaten headline.

### Gut-Friendly Diet Score
**Tier 2, last.**
**Why:** Ahmed (Sep 26) asked for a gut microbiome score with an accuracy percentage like the calorie score's, "as accurate as possible, but also being transparent about how inaccurate it could be". Kefir counting comes from his 2026-10-26 answer. Research (re-checked 2026-10-26) found a published diet index for gut microbiota. The honest version scores the **diet**, not the person's bacteria. Research-driven change (Ahmed accepted the default, 2026-10-26): the index has no validation that supports a confidence %, so coverage counts, evidence labels and the limits panel take its place.
- **Name** (Ahmed accepted the default, 2026-10-26): "Gut-Friendly Diet Score", subtitled on every screen **"Scores the foods you logged, not your gut bacteria."**
- **Three meters, side by side and never blended into one number:**
  1. **Diet index, 0–14.** Adapted from the Dietary Index for Gut Microbiota (DI-GM; Kase et al. 2024, *Nutrients*, doi:10.3390/nu16071045). On each logged day:
     - **1 point for each beneficial food present:** fermented dairy (kefir, yogurt), chickpeas, soy/tofu, whole grains, fiber ≥ 25 g, cranberries, avocado, broccoli, coffee, green tea.
     - **1 point for each of these absent:** red meat, processed meat, refined grains, fat ≥ 40% of calories.
     - **Unknown is not absent.** An "absent" point is checked only when every meal that day is tagged; the fat point also needs fat and calories known for every meal that day. The fiber point is earned when known fiber already reaches 25 g (from listed foods or a lookup), and is not earned when fiber is known for every meal and stays under 25 g. Otherwise the component shows "not checked" and earns nothing, and the meter says how many weren't checked, e.g. "3 components not checked this week".

     The meter is the average over logged days in the last 7. Days with nothing logged are excluded, so they can't earn "absent" points. Its face reads "adapted from DI-GM (Kase 2024); see How this is computed".
  2. **Plant variety.** Distinct plant types logged in the last 7 days, shown as "N plant types this week (American Gut compared 10 or fewer vs more than 30)". Source: McDonald et al. 2018, *mSystems*. This is the closest measure to Ahmed's Sep 26 fiber-diversity request: it counts distinct plant sources, not fiber types.
  3. **Fermented servings per day,** averaged over logged days in the last 7, like the diet index, using the study's serving sizes: kefir, yogurt or kombucha 6 oz; kimchi or sauerkraut ¼ cup. Reference line: "Stanford study arm: about 6 servings/day by the end of its maintenance phase", not presented as a target. Source: Wastyk et al. 2021, *Cell*.
- **Evidence on the face:** each meter shows **"based on N of M meals tagged"** and a short evidence label linking to How this is computed: "Evidence: early, associations only" (diet index), "Evidence: observational, self-reported" (plants), "Evidence: one small trial" (fermented).
- **Tap a meter for its breakdown.** Diet index: each logged day's 14 components, marked earned, not earned or not checked. Plant variety: the plants counted this week and the meal each came from. Fermented: each fermented food with its amount and servings. A wrong tag can be fixed from the breakdown.
- **Tagging:** each food listed in a meal (`Logging a Meal > Foods in this meal`) is auto-tagged from the built-in food list (plant type, fermented, the index's food groups), and every tag can be edited. A meal with no foods listed counts as untagged.
- **"How this is computed"** lists every rule with its source, and states:
  - the departures from the paper: any serving counts and each logged day is scored on its own, while the paper used sex-specific medians from the mean of two recall days. Fiber ≥ 25 g is borrowed from Reynolds 2019 (doi:10.1016/S0140-6736(18)31809-9). The fat ≥ 40% cutoff is the paper's own;
  - the original DI-GM paper checked the index only against indirect urine markers (r ≈ 0.2), and a general diet-quality index (HEI-2015) tracked them somewhat more strongly; later stool studies are cross-sectional associations, not validation;
  - the 30-plant finding is observational and self-reported. American Gut asked people to estimate the plants in an average week; HowSure counts what you logged, so the two numbers are not the same measure;
  - fiber trials did not raise diversity;
  - the fermented-food trial had 18 people per arm, and its primary immune outcome did not change;
  - the index was built from studies of adults without IBD, so it is not a guide for any gut condition.
- **App choices,** labelled as app choices: cheese counts as fermented dairy and sweetened yogurt counts, both following the paper (Ahmed accepted the default, 2026-10-26); which foods count as plants.
- [ ] On a logged day with no other fermented dairy, adding 6 oz kefir raises that day's diet-index points by 1 and its fermented servings by 1; the weekly fermented meter rises by 1 divided by the number of logged days in the window.
- [ ] A day with nothing logged doesn't change the diet-index average.
- [ ] A logged day with one untagged meal earns no "absent" points.
- [ ] A day where one meal's fat is blank gets no high-fat point, and the breakdown shows "not checked".
- [ ] Tapping plant variety lists every plant counted, and removing a wrong tag there lowers the count.
- [ ] Each meter shows "based on N of M meals tagged" and its evidence label, and the subtitle "Scores the foods you logged, not your gut bacteria." is visible.
- [ ] "How this is computed" lists each rule with its DOI or the label "app choice", and the limits above. No meter value is shown as a percentage, and no gut-score text contains "accuracy" or "gut health".

### Plates: Weigh Minus the Plate
**Tier 2.**
**Why:** Ahmed (Sep 20): weigh "all of the plates that I have at home ... and attach the weight to it", so the app can "subtract the plate's mass from the actual food". Recognising the plate in a photo is your Claude's job, through `Claude Connector: Photo and Voice Logging`.
- **My plates:** add a plate with a name and its empty weight in grams.
- **Use a saved plate:** when logging with "Weighed", pick a plate and type the scale reading. Food weight = reading − plate. Calories = food weight × calories per 100 g (typed from a label, or from a barcode lookup) ÷ 100.
- The meal's breakdown shows the arithmetic, e.g. "612 g reading − 212 g plate = 400 g × 165 kcal/100 g = 660 kcal".
- [ ] With a 212 g plate and a 612 g reading at 165 kcal/100 g, the meal saves at 660 kcal, and its details show the arithmetic line.
- [ ] A reading lighter than the plate shows an inline error, and Save is blocked.

### Barcode Lookup (Live)
**Tier 2.**
**Why:** Ahmed (Sep 20): for any bagged item with a nutrition label, the app should get the precise values from there (paraphrased for the public doc). This is a live integration that works with no account.
- **Look up a barcode:** type a barcode. The app asks the public Open Food Facts database and shows the product name exactly as the database gives it, calories and macros per 100 g, and the serving size if there is one. The source becomes "Nutrition label (looked up)".
- **Its own typical error:** looked-up values are entered by contributors, so they carry their own typical error, marked "assumption". They never borrow the packaged-label study's error unless the amount was weighed or the whole package was eaten.
- **Amount eaten** is its own input: weighed (e.g. with a saved plate), the whole package, or an estimated portion, which widens the range. With no serving size, the amount is entered in grams.
- **Incomplete product:** what exists is filled in, the rest is unknown, and missing calories are asked for by hand.
- **Labels:** the meal's details show the barcode, the product name, a link to its Open Food Facts page, and "From Open Food Facts, fetched [date]". A saved result says "Saved lookup, fetched [date]".
- **Credit:** "Data: Open Food Facts contributors (openfoodfacts.org), Open Database License (ODbL). Not checked by HowSure.", with both links. The saved demo copy carries the same credit inside the file and in the README, which says the data is not under the app's code licence. Product images are not fetched.
- **Caching:** every result is cached. The demo uses a saved copy, labelled as saved, so the video never depends on the network.
- **Errors:** "not found", offline or rate-limited each show a plain message, and manual entry still works.
- **Privacy:** a lookup sends the barcode digits to Open Food Facts, plus what any web request carries (your IP address and browser details). The app identifies itself by name, version and repo URL, never a personal email.
- [ ] A known barcode fills in the product name and per-100 g values, and the meal saves with source "Nutrition label (looked up)", its fetch date and the credit line.
- [ ] A saved result shows "Saved lookup, fetched [date]".
- [ ] With the network off, the lookup shows a plain message, and the meal can still be logged by hand.
- [ ] Each live lookup adds 1 to a saved sent-off-device counter; cached lookups don't (checked in the saved data).

### Privacy Panel
**Tier 2.**
**Why:** Ahmed (Sep 23) wants to be able to make his log private (accepted default: the note's context stays out of these public docs). With no account, the honest version is visible control over local data.
- It shows:
  - "Saved on this device only";
  - **"Sent off this device: N lookups"**, listing the kinds (barcodes, and food searches once `Food Search` exists), plus what is stored online when sign-up is on;
  - **Claude connector: on/off** (once built), with what Claude can read (the viewed day's meals and totals, the plates), that what it reads goes to your own Claude account, and that it can only propose meals (and, once built, save food research);
  - **Export my data** (a JSON file);
  - **Delete my data**, which asks for confirmation;
  - **Reset demo**.
- **Delete**, once confirmed, removes everything HowSure stored for your own log on this device: meals, sleep, workouts (including runs and their routes), weigh-ins, plates, guest name, saved lookups, photos, second profiles and readings, night tags, gym sessions, Claude proposals, food research, and groups with their shared meals. If sign-up is on, it says what remains online. The demo is unaffected. **Export** covers the same list.
- [ ] Export downloads a JSON file containing every item on that list that exists.
- [ ] Delete, once confirmed, removes every item on that list from your own log. The demo is unaffected.
- [ ] The "sent off this device" count goes up by one per live lookup and stays the same for cached ones.

### Claude Connector: Photo and Voice Logging
**Tier 2, item 7.**
**Why:** Ahmed (Sep 20) wants to log a meal by taking a photo or describing it, with the AI looking up restaurant values, subtracting a known plate, and always stating its guess for him to confirm. He also wants HowSure to connect to Claude the way other wellness apps do (Sep 24). On 2026-10-26 he said: "make it so that an MCP with Claude can do it." HowSure provides the connector; the user's own Claude does the seeing, listening and researching. HowSure needs no AI key, and no photo is sent anywhere by HowSure.
- **The connector.** HowSure ships a small **MCP server** (a connector that Claude Desktop or Claude Code can add) that runs on the same computer as HowSure. The README has step-by-step setup, as Ahmed's Sep 24 note asks (teach people how to add it as a connector).
- **What Claude can do through it:**
  - `propose_meal`: name, date and time, calories, optional protein, carbs and fat, evidence source (photo estimate, description, published menu, label, or weighed), Claude's stated guess of the food and the place, its assumptions, and the link to any menu or label page it used. A weighed proposal names a saved plate and gives the scale reading and calories per 100 g, and HowSure does the plate arithmetic.
  - `list_plates`: the saved plates, so Claude can name the plate in a photo and HowSure subtracts its weight.
  - `get_day`: the viewed day's meals and totals, so Claude can check for double counting before proposing.
- **Proposals, not entries.** Everything Claude sends arrives in a **From Claude** inbox on the dashboard, marked "proposed by Claude". Each shows Claude's guess in its own words ("Claude's guess: chicken shawarma plate, a local takeout"). It becomes a meal only when you tap **Add**, and you can edit it first or **Dismiss** it. (Ahmed, Sep 20: it should always confirm with you.)
- **Honest ranges.** A photo estimate keeps the photo estimate's typical error and wide ranges. It is never upgraded because an AI produced it. A Claude proposal that cites a published menu or label page gets that source's typical error, and the page link shows in the meal's details.
- **Voice.** Voice works through Claude's own voice input, where the Claude app you use offers it: you say the meal to Claude, and it calls `propose_meal`.
- **Photo guidance.** The connector's built-in instructions tell Claude to ask for one plate per photo, food spread out, and a zoomed-out shot (Ahmed's Sep 20 tips), and to check `get_day` so nothing is counted twice.
- **Privacy.** The privacy panel shows the connector as on or off, and lists what Claude can read through it (the viewed day's meals and totals, the plates) and that it can only *propose* meals. Turning it off stops every connector tool. Photos, voice, and anything Claude reads through the connector go to the user's own Claude account under Claude's terms; photos and voice never pass through HowSure.
- **Demo.** The video uses a photo of a generic, unbranded food that Ahmed takes himself, and the proposal goes to the fictional demo person's day. The connector's tools are also tested without Claude, by calling them directly with fixture data.
- [ ] Calling `propose_meal` with a photo-estimate meal makes it appear in the From Claude inbox with Claude's guess, and the day's totals don't change until **Add**. **Add** puts it on the right waking day with the photo estimate's ranges, and **Dismiss** removes it.
- [ ] A weighed proposal naming the 212 g saved plate, with a 612 g reading and 165 kcal/100 g, shows "612 g reading − 212 g plate = 400 g × 165 kcal/100 g = 660 kcal" and adds at 660 kcal.
- [ ] `get_day` returns the viewed day's meals and totals.
- [ ] The privacy panel lists what Claude can read through the connector. With the connector turned off there, every connector tool returns "connector is off", and nothing reaches the inbox.
- [ ] Without the connector set up, no From Claude section appears, and the Tier 1 checks still pass.

### 3-Day Timeline
**Tier 3, stretch 3.**
**Why:** Ahmed (Sep 18): a 3-day view "of all the times at all times", with a marker for when you woke up, an "expected sleep time exactly 16 hours from wake up", and "how much you slept from which time to which time".
- Three waking days are drawn hour by hour, with midnight lines, sleep blocks (with their lengths), wake markers, and meals as dots. Option: a 4-day view that adds the day before (Sep 18).
- **Expected sleep** is marked at wake time + your usual day length, preset to 16 h from Ahmed's note and editable, labelled "your setting, not advice".
- [ ] The demo's after-midnight snack appears as a dot after the midnight line and before that night's sleep block.
- [ ] With a usual day length of 16 h, the expected-sleep marker sits 16 h after the wake marker.

### Room Left, in Foods
**Tier 3, stretch 4.**
**Why:** Ahmed (Sep 28): a fast-food and dessert budget "in terms of, like actual fast foods". It shrinks live, keeps room for meals still to come using your average per meal, and says when you've "exceeded". A friend's dessert tip (Oct 2) becomes a saved treat.
- Set a daily calorie target (your own number) and your usual meals per day.
- **Room left** = target − the *top* of the very likely range eaten so far − (meals still to come × your average per meal). Meals still to come = usual meals per day − meals logged this waking day, never below 0. Average per meal is your average over the last 7 logged days (known meals only), or a number you type.
- It is shown as generic foods ("a cheeseburger and medium fries", "a small soft-serve cone") and your own **saved treats** (e.g. "homemade protein ice cream", with your calories), which can use any name you type. The built-in list is generic (app choice, accepted default: it keeps the public demo and video free of trademarks and implied endorsement). Each generic food's calories come from a named USDA FoodData Central entry (bulk download, public domain CC0), shown as approximate with the entry in the details, and credited "Source: USDA FoodData Central" in the app and README.
- When only the top of the very likely range is over the target, it says **"No room left if you count the top of the range"**. **"Exceeded today's target by about X–Y kcal"** appears only when the whole likely range is over.
- **Optional sugar and fat targets** (your own numbers). Room left shows the known amount only, labelled "known amount; N meals missing sugar", and says "Exceeded today's sugar target" when known sugar passes it. No range, because macro ranges are not built yet. Fat uses the optional fat field; sugar appears once `Nutrients From Lookups` supplies it.
- [ ] With a 2,400 target, the room left uses the top of the very likely range, and the explanation shows each subtraction.
- [ ] A saved treat appears in the room-left list when it fits, and disappears when it doesn't.

### Weight Log
**Tier 3, stretch 5** (Ahmed accepted the default, 2026-10-26).
**Why:** Ahmed's tracker is a food and weight tracker (Sep 24), and his gym-log idea sits below the weight (Sep 24).
- Log weigh-ins: date, time, kg or lb. A 7-day average trend line shows under the weigh-ins, with the note "daily weight swings with water and food; watch the trend".
- [ ] Logging 7 weigh-ins shows the trend line and the 7-day average. With fewer than 7 weigh-ins, the label reads "average of N weigh-ins".

### Nutrients From Lookups
**Tier 3, stretch 6.**
**Why:** Ahmed asked for micronutrients (Sep 26), omega-3 (Sep 28) and a sodium question (Oct 3).
- Fiber, sugar, sodium and the other nutrients come from label or barcode data when present. Otherwise they show **"unknown"**, never zero.
- **Omega-3** is usually missing from labels, so the app also shows "fatty-fish meals this week" from tags.
- **Sodium** shows the general limit from a guideline named and re-checked in `spec.md` (body, year, value), labelled "general guideline for adults; individual needs vary". The guideline's own heavy-sweating wording is shown only if it has some; sweat-loss information from other sources waits for `Sweat Sodium Note`. Until it is checked, no guideline line is shown. It never raises the limit automatically.
- [ ] A looked-up product with sodium shows it. A typed meal without it shows "unknown", and the day's sodium total is labelled as the known amount.

### Processed-Food Share
**Tier 3, stretch 7.**
**Why:** Ahmed (Sep 26) wanted the gut analysis to use processed versus unprocessed foods. This share shows that directly, separate from the diet index.
- The app shows the share of the day's known calories from **ultra-processed foods (NOVA group 4)**. The NOVA group comes from the barcode lookup when the database has it, or from your tag. A looked-up group is labelled "NOVA group as estimated by Open Food Facts; not checked by HowSure". Calories with no NOVA group are shown as an "unknown share", not left out silently. The NOVA citation, and how Open Food Facts derives its group, are checked in `spec.md`.
- [ ] A day with one NOVA-4 product of 400 kcal out of 1,600 known kcal shows "25% of known calories ultra-processed", plus the unknown share.

### Meal Photos on This Device
**Tier 3, stretch 8.**
**Why:** Ahmed (Sep 26): "adding photos of the food to the place where it tracks the food".
- You can attach a photo to a meal. It is stored on this device only and never uploaded. Delete removes it with the meal.
- [ ] The photo shows in the meal's details after a reload, and the privacy panel's sent count doesn't change.

### Night Tags
**Tier 3, stretch 9.**
**Why:** Ahmed (Sep 23) wants to compare his nights against things he tried, without the app suggesting anything to take.
- Tag a night with your own words, e.g. "kefir" or "room warm". The week view shows sleep length on tagged vs untagged nights, with counts, and the line "a few nights prove nothing". The app never suggests a supplement or a dose.
- [ ] With 3 tagged and 4 untagged nights, both averages show with "3 nights" and "4 nights".

### Sleep File Import
**Tier 3, stretch 10.**
**Why:** Ahmed asked for live integrations. Wearable APIs need reviews or real accounts (see `Deferred From the POC`), so a manual file is the offline bridge, not a live connection or wearable sync. It accepts a CSV or JSON of sleep and wake times in HowSure's documented format.
- **Import sleep file** shows a preview of the nights it found and asks for confirmation. Overlapping nights follow the sleep/wake editor's rules. A sample file for the fictional person is included.
- [ ] Importing the sample file adds its nights, and the week's sleep average updates.

### Optional Sign-Up
**Tier 3, stretch 11** (ranked late because it waits on Ahmed's Supabase project). Built only if Ahmed creates a free Supabase project himself and puts its URL and publishable key in `.env.local`, which agents never read.
**Why:** Ahmed: "Have the accounts". The guest name already covers people who don't sign up.
- **Save my account** links your guest profile to an email. Without the keys, the app stays fully local and hides the option. The video shows the guest flow.
- **What goes online** (Ahmed accepted the default, 2026-10-26): only the guest name, in a Supabase profiles row under row-level security (each user reads and changes only their own row). Meals, sleep, weight and readings stay on the device. When signed in, the label reads "Name saved to your account; your log stays on this device". The app makes no security or compliance claims.
- [ ] Without `.env.local` keys, no sign-up button appears and everything works locally.
- [ ] With keys, Ahmed himself links a guest profile to his own email and confirms that his profile row appears; the agent never does this step. If he won't do it before the freeze, this item moves to Deferred.

### Food Search
**Tier 3, stretch 12.** Needs Ahmed's own free USDA data.gov key.
**Why:** Ahmed (Sep 20) wants foods looked up rather than guessed. His example was a restaurant order (covered by the Claude connector, which can cite a published menu). This search covers whole foods like kefir and kimchi, and answers his 2026-10-26 request for live integrations.
- Search USDA FoodData Central by name and pick a result. The source becomes "Food database". Credit: "USDA FoodData Central". Results are cached, with a demo copy saved.
- **The key** (Ahmed accepted the default, 2026-10-26): a key used by a browser app ships inside the built site's JavaScript, where anyone can read and reuse it, so it is used only in local runs, and any public demo gets saved results. The key never goes in the repo. The no-key alternative is a bundled offline subset of USDA's public-domain bulk data, after Ahmed approves the download.
- [ ] Searching "kefir" lists results, and picking one fills in per-100 g values with the credit line.

### Second Profile and Carb Budget
**Tier 3, stretch 13.**
**Why:** Ahmed (Sep 28) asked for a carb budget someone can follow from a number their clinician gave, plus a plain log of readings next to meals. Only the safe version is built.
- You can add a second profile on this device. Its **carb budget** is a number the person's clinician gave, typed in. The app only does arithmetic on the budget (accepted default: no list of foods that fit).
- The carb room left shows only when every meal that day has known carbs. Otherwise it reads "Not available: N meals have unknown carbs". Carb totals are labelled "point estimates, no range yet; photo estimates can be far off".
- A **readings log** records blood pressure or glucose as plain numbers with times, next to that day's meals. There are no thresholds, interpretation, alerts or doses, and a fixed note says "Not medical advice. Not for insulin dosing."
- The demo uses only a fictional profile.
- [ ] The carb budget shows "budget from your clinician: X g", and the room left in carbs updates as meals with known carbs are logged.
- [ ] One meal with unknown carbs hides the carb room left and shows "Not available: 1 meal has unknown carbs".
- [ ] Readings show as typed numbers with no colour-coding or labels like "high" or "normal".

### Gym Log
**Tier 3, stretch 14.**
**Why:** Ahmed's gym notes (Sep 15, Sep 24) ask for set-level logging, and it runs entirely on the device, needing no key or backend.
- By typed entry: split, sets, weight per set, warm-up vs working set, drop set. It extends Tier 2 workouts.
- [ ] A logged session shows each set with its weight and type (warm-up, working or drop set), and survives a reload.

### 3D
**Tier 3, stretch 15.**
**Why:** Ahmed (Sep 24) wants 3D animations to make the UI look better, and (Oct 13) a 3D interactive view of the charts.
- Brief 3D animations that polish the UI, kept brief to match `Look and Feel`, and an optional 3D view of the week charts as a toggle. The plain view stays the default.
- [ ] The 3D toggle is off by default, and turning it off restores the plain chart.

### Food Research via Claude
**Tier 3, stretch 1.**
**Why:** Ahmed (Sep 26) wants deep research per food (ingredients, contaminants such as plasticizers and pesticides, and fiber types), so that whenever a food is logged the app can "check that and know how harmful or unharmful or just not known that thing is". On 2026-10-26 he asked for this through Claude as well. The honest version stores research with its sources and evidence grade, and never turns it into a good/bad score.
- **The connector tool** `save_food_research`: a food name and a list of findings. Each finding has a plain claim, an **evidence grade** (systematic review, randomized trial, observational study, regulator statement, or "no good evidence found"), a source title and link, and the date checked. A finding **without a source link is rejected** with the message "every finding needs a source"; a "no good evidence found" finding links to where Claude searched. That keeps unsourced "allegedly" claims out.
- **What HowSure shows:** a **Research** section on any meal containing that food. Findings are grouped by evidence grade, labelled "Researched by your Claude on [date]; not checked by HowSure", with a "what this covers" line. "No good evidence found" is shown as a finding in its own right, so "not known" is visible, as Ahmed asked.
- **Fiber types:** research can include a food's fiber types with their source, shown in the meal's details next to its gut tags.
- **There is no harm score, colour or verdict.** Findings are listed, not added up.
- Research is saved per food and reused on later meals with that food. **Refresh** shows a ready-made request to give your Claude; HowSure can't start Claude itself. New research replaces the old.
- [ ] Saving research with one sourced finding and one unsourced finding rejects the call and names the unsourced one.
- [ ] Saved research shows each finding's grade, source link and date, and the label "Researched by your Claude on [date]; not checked by HowSure", on every meal containing that food.
- [ ] The Research section shows no score or colour scale, and HowSure's own text in it never uses "safe", "toxic" or "harmful" (a finding's sourced claim may).

### Groups, Sharing and Leaderboards
**Tier 3, stretch 2. Accounts and a shared database come later.**
**Why:** Ahmed (Sep 28) wants a "Strava" for food: groups (family, friends), sharing meals with their macro breakdown, and leaderboards. On Sep 23 he wanted to control who can see his log. On 2026-10-26 he said the feature should be in place, and only "making the accounts and having the database" can come after.
- **Everything except the network is built:**
  - **groups:** create one, name it, invite by code;
  - **sharing:** opted in per meal;
  - **the shared feed;**
  - **unsharing**, which revokes;
  - **leaderboards;**
  - **privacy defaults.**

  Behind them is one connection layer that today keeps everything on this device. Accounts and a shared database plug into that same layer later.
- **Honest labelling:**
  - Until accounts exist, every group screen carries the banner **"Groups preview: nothing leaves this device. Real groups need accounts (coming later)."**
  - Invite codes say "works once accounts exist".
  - The demo group's members are **fictional demo members**, labelled on every row.
- **Sharing a meal** is opt-in per meal. A preview shows exactly what would be shared: name, calories with both ranges, macros, estimate score, and the photo only if attached and ticked. **Weight, sleep and run routes are never shared** by default, and each needs its own switch. **Live location is not collected** in this build; a route exists only if you import a GPX file (`Runs`).
- **Unshare** removes a meal from the group feed at once. This is the revocable part of Ahmed's Sep 23 wish.
- **Weekly leaderboards** (Ahmed's Sep 28 list, plus two that reward honesty):
  - most calories burned (from logged workouts);
  - best macros, meaning closest to each member's *own* protein, carbs and fat targets, typed in their profile (members with none show "no targets set"). This definition is an app choice, labelled;
  - logging consistency (days logged out of 7);
  - "how sure" (average day estimate score).

  Each board shows only its own weekly number for each member, never meals they didn't share. There is **no "least calories consumed" board**, because it rewards restriction.
- [ ] Sharing a meal shows the preview first. Weight and sleep are absent from it unless their switch is on.
- [ ] Unsharing a meal removes it from the group feed immediately.
- [ ] The demo group shows its fictional members, each labelled "fictional demo member"; every group screen shows the preview banner; invite codes say "works once accounts exist"; and no group action makes a network request (checked in the browser's network log).
- [ ] Each of the four leaderboards ranks the demo members for the week. No board ranks by fewest calories.

### Runs
**Tier 3, stretch 16.**
**Why:** Ahmed (Sep 28): beyond food, a Strava-like view of runs, with location only if you want it.
- Log a run as a workout with distance and duration, and HowSure works out the pace. A route can be imported from a GPX file (the format running watches and apps export), and the route map is shown only if you import one. The route stays on this device. The sample GPX file is generated, never a real recorded run. Live GPS tracking waits for the phone app.
- [ ] A 5 km run in 30 min shows a pace of 6:00 per km. Importing the sample GPX file shows its route and distance.

### Ranges for Protein, Carbs and Fat
**Tier 3, stretch 17.**
**Why:** Ahmed said protein, like calories, should sit "within that range" (2026-10-26). This needs its own error per source. The photo study found protein errors near 61%, against about 36% for calories (Fridolfsson 2025), so the calorie widths can't be reused.
- Each macro with a known value gets its own likely and very likely range from its own per-source error. Any error not yet checked is marked "assumption". Unknown macros stay unknown.
- [ ] A photo-estimate meal with 40 g protein shows a protein range wider (relative to its value) than its calorie range.

### Sweat Sodium Note
**Tier 3, stretch 18.**
**Why:** Ahmed (Oct 3) asked whether heavy sweating raises the sodium you can have, and asked for research.
- On a day with a logged workout, the sodium line adds an information note with the typical range of sodium lost in sweat, from a re-checked exercise-science source chosen in `4-spec`. It is information, never a new limit. If no source can be confirmed, the note is not shown.
- [ ] With a workout logged and a confirmed source, the note appears with its citation, and the sodium limit itself does not change.

## States and Boundaries
- **First use:** the two-choice screen (see `First Open`).
- **Demo mode:** "Sample person — fictional" is always visible, and the data is fictional. Its data is separate from your own log, and **Reset demo** affects only the demo.
- **Your own log before a wake time is set:** "Wake time not set" with **Set wake time**. Meals go into a provisional day that doesn't reset at midnight.
- **A day with no meals:** "No meals logged yet" and a prominent **Log your first meal**. Totals, ranges and the estimate score say **"Not available yet"**, never zeros or a perfect score. The biggest-uncertainty line is hidden. The waking-day header and sleep controls still work.
- **A partly known day:** "Known meals only — incomplete day", with the unknown count and a Missing information list (see `Days With Unknown Calories`).
- **A day where every meal is unknown:** meals and unknown count shown; calories, range and score "Not available yet".
- **Invalid calorie input:** an inline error, Save blocked, other fields kept (see `Calorie Input Rules`).
- **Invalid sleep/wake order:** an inline explanation, inputs kept, saved record unchanged.
- **A sleep correction that moves meals:** the meals are named and confirmation is asked first.
- **Better evidence that doesn't help much:** the range changes only as much as the calculation says, even if that is very little.
- **The biggest contributor already uses the best source:** the line says so, and **Improve that entry** is hidden.
- **A night with a missing sleep or wake time:** "not logged", never 0 h, and left out of sleep averages.
- **(Tier 2) A live lookup that fails** (offline, not found, rate-limited): a plain message, and manual entry still works.
- **(Tier 2) Untagged meals in the gut score:** counted as "untagged" in "based on N of M meals tagged", never as zero, and the components they affect show "not checked".
- **(Tier 2) Net calories:** net's explanation carries the resting-burn note, and there is no deficit or surplus word (Ahmed accepted the default, 2026-10-26).
- **Persistence:** everything stays on this device. Only lookups leave it: barcodes (Tier 2) and food searches (Tier 3), and the privacy panel counts each one. With the Claude connector on (Tier 2), what Claude reads through it goes to your own Claude account, as the privacy panel says. Groups (Tier 3) are a preview that sends nothing. There is no account unless the optional sign-up (Tier 3) is set up, and then only the guest name goes online (Ahmed accepted the default, 2026-10-26).

## Product Decisions
- **Name: HowSure**, tagline "Food estimates, explained."
- **Include every idea from the notes** (Ahmed, 2026-10-26: "Just everything I asked for include it"). Each idea is in a build tier or on the designed roadmap, with a stated reason.
- **"Estimate score", not "accuracy".** A 90% score means a typical error of about 10%, not a 90% chance of being right, and the app says so.
- **Two ranges** (the very likely range is Tier 1, accepted by Ahmed). The likely range is meant to catch about 8 in 10 meals and the very likely range about 19 in 20 (design targets until measured). "Count the top of the very-likely range" is the honest way to plan with a safety margin: none of the 21 sources re-checked supports a guaranteed range for one meal, and even a calibrated range promises its rate only on average.
- **Every source's typical error cites a re-checked study's own figure for that method, or says "assumption".**
- **The day's uncertainty is combined, not averaged,** because a large uncertain meal matters more than a small one. The method's illustration numbers are not acceptance targets; `spec.md` calculates the expected results.
- **Ranges and scores cover calories only, for now.** (Tier 2) Net calories combines the eaten and burned uncertainties. (Tier 3) `Ranges for Protein, Carbs and Fat` adds macro ranges, each from its own per-source error.
- **(Tier 2) AI logging goes through the user's own Claude** (Ahmed, 2026-10-26). HowSure ships a connector and has no AI key. Claude only proposes meals, and you confirm each one.
- **(Tier 3) Groups are built on the device first,** labelled as a preview (Ahmed, 2026-10-26). Accounts and a shared database come later.
- **Evidence sources:** weighed, nutrition label (typed, or looked up in Tier 2 with its own typical error), published menu, photo estimate, description, plus (Tier 3) a food database. "How do you know?" has no default.
- **Blank calories can be saved as unknown, and a typed zero stays distinct.**
- **Unknown meals are never given an invented uncertainty.** They sit under Missing information, and partial days say "Known meals only — incomplete day". Averages leave out incomplete days and say how many.
- **Improving a meal goes through its edit sheet,** with a before/after preview, and applies only on Save. The range is never forced to narrow.
- **No invented wake time.** Start empty shows "Wake time not set". Meals wait in a provisional day, and regrouping is previewed.
- **Sleep and wake times are edited with explicit dates,** with order checks, and with confirmation before meals move.
- **Sleep length and its 7-night average are Tier 1** (Answer 4: "we do need that").
- **The demo and your own log are separate.** You can switch between them, and Reset demo touches only the demo, with confirmation.
- **The demo is the primary first action,** so anyone can see the full journey with no setup.
- **(Tier 2) Guests get a gamer-tag name,** saved on the device only. The demo's is fixed.
- **(Tier 2) The gut score scores the diet, not the microbiome.** It has three separate meters with sources, coverage counts and evidence labels, and no % (Ahmed accepted the default, 2026-10-26).
- **(Tier 2) The headline is net calories once workouts are logged** (Ahmed's Sep 28 note), with no deficit or surplus word (Ahmed accepted the default, 2026-10-26).
- **Live integrations:** the live integration today is the Open Food Facts barcode lookup (Tier 2), plus USDA food search (Tier 3) if Ahmed supplies a key. Sleep file import (Tier 3) is a manual file in HowSure's own documented CSV/JSON format, not a live connection or wearable sync. Wearable sync is designed for the roadmap.
- **Visual direction:** light, journal-like, teal for actions, amber for uncertainty, colour always paired with text.

## What We're Building
**Tier 1 (must ship):**
- The first-open choice, a fictional demo that supports the whole journey, switching between the demo and your own log, and Reset demo.
- The dashboard, as laid out above.
- Meal logging, editing and deleting, with evidence source, date and time, unknown handling and input rules.
- Estimate scores and likely ranges (calories) for each meal and for the day, with their explanations, plus the Missing information list for unknown meals.
- (Ahmed accepted the default, 2026-10-26) The very likely range, with the study behind each source.
- The biggest-uncertainty line and **Improve that entry**, with a before/after preview.
- Sleep and wake logging, waking days, the provisional day before a wake time is set, previous days, and the sleep/wake editor with its order check and move-confirmation. The confirmation is built after core steps 1–7 and verified before the final review.
- Sleep length for each recorded night, and the 7-night average sleep length with its night count (e.g. "6 of 7 nights"), in the dashboard's sleep section. A night with a missing sleep or wake time shows "not logged" and is left out of the average.
- Saving on the device.

**Tier 2, in this order** (accepted by Ahmed, 2026-10-26):
1. `Week View`;
2. `Guest Profile and Gamer-Tag Name`;
3. `Workouts and Net Calories`;
4. `Plates: Weigh Minus the Plate`;
5. `Barcode Lookup (Live)`;
6. `Privacy Panel`;
7. `Claude Connector: Photo and Voice Logging`;
8. `Gut-Friendly Diet Score`, with `Foods in this meal` (last, because it is the largest item).

**Tier 3, in this order:**
1. `Food Research via Claude`;
2. `Groups, Sharing and Leaderboards` (accounts and a shared database later);
3. `3-Day Timeline`;
4. `Room Left, in Foods`;
5. `Weight Log`;
6. `Nutrients From Lookups`;
7. `Processed-Food Share`;
8. `Meal Photos on This Device`;
9. `Night Tags`;
10. `Sleep File Import`;
11. `Optional Sign-Up`;
12. `Food Search`;
13. `Second Profile and Carb Budget`;
14. `Gym Log`;
15. `3D`;
16. `Runs`;
17. `Ranges for Protein, Carbs and Fat`;
18. `Sweat Sodium Note`.

Whatever is verified by the build freeze ships, and the video script uses only verified features. Anything unbuilt goes to the README roadmap with its design from this PRD.

## Deferred From the POC
These are designed but not built today. Each names what it waits on. Deferring is not rejecting.
- **Accounts and a shared database for groups** (Sep 23, Sep 28). `Groups, Sharing and Leaderboards` (Tier 3, stretch 2) is built on the device behind one connection layer. Real members, working invite codes and syncing need accounts and a backend, which come later (Ahmed, 2026-10-26).
- **Wearable sync** (Sep 18, Sep 28). The Fitbit Web API shuts down in late Oct / early Nov 2026, and its successor, the Google Health API, needs a security review and a real account. Oura needs a real account. Withings needs a server-side secret. Apple Health and Health Connect are native-only. The sleep file import is today's bridge (Ahmed agreed to defer, 2026-10-26).
- **An AI that reshapes the dashboard, and connectors for other chat apps** (Sep 24). These need a key and a backend. Design: the AI may only propose a layout (show, hide or reorder cards) that is checked against a fixed list. It never writes code. The Claude connector for logging and research is in the build (`Claude Connector: Photo and Voice Logging`, Tier 2; `Food Research via Claude`, Tier 3); Ahmed agreed to defer the rest, 2026-10-26.
- **Live GPS run tracking.** Tracking location during a run, with the screen off, is a phone-app job (`4-spec` confirms). `Runs` imports routes from files today.
- **What two friends suggested** (Sep 26 group-chat link, never opened), **and what a friend suggested for the burned drill-down** (Sep 28). They wait on Ahmed saying what they were; then each gets a tier.

## Possible Later Enhancements
- An installable phone app built from the same web app, then a Play Store listing (Sep 24). A health app listing needs a privacy policy and the store's health declarations.

## Non-Goals
- **No claims of certainty:** never call the score "accuracy", and never present a range as guaranteed or "for sure". Saying a range is *not* guaranteed is fine, and so is "count the top of the very likely range".
- **No microbiome claims:** the gut score never claims to measure, estimate or predict your gut bacteria, diversity or "gut health". It carries no %.
- **No medical interpretation or dosing advice:** no thresholds, alerts, doses or "high/normal" labels on readings. It isn't safe for a tracker to give these.
- **No "least calories consumed" competitions** (Ahmed accepted, 2026-10-26): they reward restriction.
- **No real personal or family data** in the repo, the demo or the video, and no friends' or relatives' names or health details in these docs.
- **No invented numbers:** no invented wake times, no uncertainty contribution for unknown meals, no zeros standing in for missing values, and no hit rate that no script measured.
- **No brand names chosen by HowSure** (app choice): the built-in food list, the demo's meals and the video narration use generic or fictional names. A product name returned by a lookup, and anything you type, is shown as given; the demo's saved lookup is chosen for a generic product name.
- **No ads or marketing.**

## Open Questions
**Resolved with Ahmed, 2026-10-26.** He accepted the defaults for the seven questions ("everything else looks good"):
- tier order, with the very likely range and its studies in Tier 1;
- two ranges with "count the top of the very-likely range";
- net calories with the resting-burn note and no deficit or surplus word;
- a gut score with coverage counts instead of a %, named "Gut-Friendly Diet Score", with cheese and sweetened yogurt counting;
- sign-up only if he creates the Supabase project; a USDA key in local runs only;
- no friends' or relatives' names or health details in public docs;
- generic foods; a carb budget that is arithmetic only; no naps for now; no "least calories" board.

He deferred wearable sync and the AI dashboard. He moved into the build: AI photo and voice logging and food research (through a Claude connector), groups, sharing and leaderboards (on the device; accounts and a database later), runs, protein/carb/fat ranges, and the sweat sodium note.

**Still open, waiting on Ahmed** (not blocking): what the two friends in the Sep 26 group-chat link suggested, and what a friend said about workouts on Sep 28.

**For `4-spec`:**
- the one sources table: the typical error for each evidence source (the study's own figure for the matching method, and which method "photo estimate" means), the sources for burned-calorie estimates, and a separate typical error for "Nutrition label (looked up)", each "assumption" until checked;
- the combining method for the day, the week's calorie average and net calories, with independently calculated expected results. It states the independence assumption and either keeps a shared, non-cancelling part of the error for photo and description sources or explains why it leaves it out;
- the two-range model: likely about 8 in 10, very likely about 19 in 20, with source-dependent widths;
- the range and score when the day's known total is 0 kcal (for example, "Not available yet");
- the food list's format, size and source (named USDA FoodData Central entries for calories and fiber); downloading any USDA bulk file needs Ahmed's approval first;
- the NOVA citation for `Processed-Food Share`, and how Open Food Facts derives its NOVA group;
- the sodium guideline for `Nutrients From Lookups` (body, year, value), re-checked;
- Open Food Facts requests identify the app by name, version and public repo URL, never a personal email address;
- the Claude connector: how the MCP server hands proposals to the browser app (a small local bridge, its port, and how the app picks proposals up), the tool schemas, the connector's built-in instructions, which log (demo or your own) receives proposals, how the bridge refuses requests from anything but the connector and the app, and how the tools are tested without Claude;
- the research tool's validation (every finding needs a source link; the allowed evidence grades);
- the groups connection layer, so accounts and a database can plug in later without UI changes, and the fictional demo members' data;
- the GPX parsing for `Runs`; the per-source macro errors for `Ranges for Protein, Carbs and Fat`; the sweat-sodium source, re-checked;
- what "now" means in demo mode; which day a meal belongs to inside a recorded sleep or after a very long time awake; and where the demo / my-log switch, Reset demo, the entry to Profile and privacy, and the entry to Groups (Tier 3) sit.

## Revisions
- **2026-10-26.** Ahmed reopened the approved PRD to include every idea from his notes (`devpost/ideas-verbatim.md`):
  - accounts, with a generated guest name;
  - live integrations;
  - a gut score;
  - sleep length and averages now;
  - a range he can count on.

  Every addition was researched with re-checked sources (2026-10-26) and placed in Tier 2 or 3, or on the designed roadmap, with a **Why:** line. The weekly overview became `Week View` (Tier 2); it is still built only after the core journey is verified, as Ahmed asked. The range gained a very likely band. The Non-Goals were rewritten to match.
- **2026-10-26, review pass.** Applied a 102-finding review in one pass: names and health details removed, sleep length and its 7-night average moved to Tier 1, claims narrowed to calorie estimates, unknown-not-zero rules extended to the gut score, week averages and carb budget, and Ahmed's decisions set to marked defaults with 7 grouped questions.
- **2026-10-26, Ahmed's decisions.** He accepted the defaults for all seven questions. He kept wearable sync, the AI dashboard, and accounts with a database for groups deferred, and moved the rest of the deferred list into the build:
  - `Claude Connector: Photo and Voice Logging` (Tier 2, item 7);
  - `Food Research via Claude`, and `Groups, Sharing and Leaderboards` without accounts or a database (Tier 3, items 1–2);
  - `Runs`, `Ranges for Protein, Carbs and Fat` and `Sweat Sodium Note` (Tier 3, items 16–18).
- **2026-10-26, pre-ship privacy pass (Ahmed approved option B).** The carb-budget feature's **Why:** names no condition and no person, and "Family Profile and Carb Budget" is renamed "Second Profile and Carb Budget". Behaviour is unchanged (Tier 3, not built).
