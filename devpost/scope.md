---
doc: scope
status: approved
---

# HowSure — Food, Weight, and Sleep Tracker

A food, weight and sleep tracker that tells you how much to trust its calorie estimates, shows what is known and missing for everything else, and says what you could do to make it more accurate.

## The Unique Kernel
**Transparency about estimates.** The app "doesn't just give me a number. It explains how much to trust it and what I can do to improve it, while staying simple to navigate."
- Every calorie estimate shows a **likely range**, and a wider **very likely range** for planning. Neither is presented as a guarantee. *(Revised 2026-10-26; the very likely range is Tier 1, accepted by Ahmed. See `## Revisions`.)*
- Every calorie estimate shows an **estimate score** with a plain explanation of exactly what it measures and how it was calculated. It is never presented as a validated probability of being correct.
- Each estimate shows its **evidence source**, its assumptions, the published study behind its typical error (or "assumption" when none was checked), and what would improve it.
- Missing information is **unknown, not zero**.
- The standout moment: improve one meal's evidence and watch the whole day's uncertainty shrink.

The bigger idea behind it is "more useful information with less mental effort". A simple overview, with deeper detail wherever you tap, "things that you didn't even think to think about before."

## Who It's For
- **First:** Ahmed, and people like him who want detailed nutrition tracking without complicated logging or navigation.
- **Today:** he uses his own personal tracker. Other apps are "riddled with ads and marketing" and give one confident number with no sense of how far off it might be.
- **Also in the vision:** family, friends (sharing and friendly competition), and anyone globally. Today's build can reach them through the guest profile (Tier 2) and, if reached, a groups preview kept on the device and a family profile (Tier 3); real groups with accounts are on the roadmap.

## The Core Loop
1. Log a meal quickly, saying how the number was obtained: weighed (minus a saved plate, Tier 2), label, a barcode lookup (Tier 2), published menu, photo estimate or description.
2. See the day as a best estimate, with its score, likely range and very likely range. (Tier 2) Net calories when workouts are logged.
3. Tap to go deeper: headline → meals → meal details → the study behind each calorie estimate.
4. See which meal adds the most uncertainty, and improve its evidence.
5. Log sleep and wake. Meals belong to the **waking day**, so an after-midnight snack stays on the day you lived. Last night's sleep length and the 7-night average sit in the sleep section.
6. (Tier 2) Look back over the week: calories with ranges, sleep averages, the gut-friendly diet score, and (Tier 3) the weight trend.

Why he comes back: it's actually useful day to day. It's simple on the surface and detailed wherever you look.

## Inspiration & Identity
- A simple app that is simple to navigate. "You have to think about it even less to navigate the app and look and find things, but you find and go through even more information with less brain computation."
- No ads, no marketing.
- Every feature earns its place with a stated reason, so there's nothing for the sake of it.

## Why This Matters to the Learner
- "Making an app that is actually useful in day to day life and gives more detail on all of the information that you want in a more easy and intuitive fashion that isn't riddled with ads and marketing."
- It rebuilds an idea he already lives with: a new app from an empty folder, carrying his tracker's ideas and none of its code or data. His own idea notes are kept privately in `devpost/ideas-verbatim.md` (gitignored).
- It is where he practises his learning goal: getting an agent to build on its own at a high standard, checking its own work and iterating until the result is thorough, with breadth and depth "in every aspect" and a real reason behind each one.

## What "Working" Looks Like
1. Open a fictional person's dashboard and immediately understand their food total, its ranges, and their waking day. (Tier 2: the person's fictional gamer-tag name.)
2. Tap the estimate score to see the explanation, the studies behind it, and which meal contributes the most uncertainty.
3. Replace that meal's rough estimate with label information. The meal and the day's totals update, and both ranges narrow.
4. Quickly add another meal and show its breakdown. (Tier 2: one found with a barcode lookup, a saved copy in the demo labelled as saved, and one weighed on a saved plate.)
5. Show that an after-midnight snack stays on the same waking day until sleep, rather than moving because the date changed.
6. See last night's sleep length and the 7-night average. (Tier 2: open the week, with calorie ranges per day and sleep averages, plus the gut-friendly diet score and its "how this is computed" panel once built.)
7. Reload: everything is still there.

**The "oh" moment:** the app doesn't just give a number. It explains how much to trust it, shows the research behind that, and tells you what to do to improve it, while staying simple to navigate.

## The POC Boundary
Everything from Ahmed's idea notes has a place. The build follows this order, and each tier starts only when the one before it is verified. Whatever is verified by the build freeze ships, and the video shows only verified features. Anything not reached is documented in the README roadmap with its design, so it's written down rather than dropped.

**Tier 1, the core (must ship):** the approved journey. Estimate scores, ranges and explanations; improving a meal; quick logging with evidence source; waking days and sleep/wake editing; **sleep length per night and the 7-night average** (Ahmed: "we do need that"); the demo and your own log; saving on the device. Also, **(accepted by Ahmed, 2026-10-26)**: the **very likely range** next to the likely range, with the study behind each source.

**Tier 2, the vision features with the most value per hour** (order accepted by Ahmed, 2026-10-26):
1. A **weekly overview** of every stat, updated daily.
2. A **guest profile** with a generated gamer-tag name (e.g. "BraveKefir#4821"), with reroll and rename.
3. **Net calories:** logged workouts with their own burned-calorie estimate and range.
4. A **plate list:** weigh a plate once, then food = scale reading − plate.
5. A **barcode lookup**, live from a public food database.
6. A **privacy panel:** export and delete your data, and see exactly what leaves the device: lookups only, unless you turn on the Claude connector or the optional sign-up.
7. A **Claude connector** (MCP): send a meal photo or say it to your own Claude, and it proposes the meal with its stated guess for you to confirm. It can use your saved plates and published menus.
8. A **gut-friendly diet score**, built from a published diet index and a list of the foods in each meal. Kefir counts. It is last because it is the largest item.

**Tier 3, stretch, in this order:**
1. Food research through the Claude connector: ingredient, contaminant and fiber-type findings, each with its source and evidence grade, never a score.
2. Groups, meal sharing (opt-in per meal, unshare to revoke) and leaderboards (most burned, best macros, consistency, "how sure"). Built on the device and labelled as a preview; accounts and a shared database come later.
3. A 3-day timeline (or 4-day, adding the day before) with wake and sleep markers and an "expected sleep" marker preset to 16 h after waking, which you can change.
4. A room-left budget shown as foods, including your own saved treats, with optional sugar and fat targets.
5. A weight log with trend.
6. Micronutrients, omega-3 and sodium from looked-up foods.
7. The share of calories from ultra-processed foods.
8. Meal photos stored on the device.
9. Night tags, e.g. "kefir" or "room warm".
10. Sleep file import, in HowSure's own file format.
11. Optional real sign-up (ranked late because it waits on Ahmed's Supabase project).
12. A food-database search.
13. A second profile with a clinician-given carb budget and a plain readings log.
14. A gym log with set types (warm-up and working sets, drop sets).
15. 3D: brief UI animations, and an optional 3D view of the charts; the plain view stays the default.
16. Runs: distance, duration and pace, with a route from a GPX file.
17. Ranges for protein, carbs and fat.
18. A sweat sodium note on workout days, as information from a re-checked source, never a new limit.

## Later
Designed, and on the README roadmap, but not built today. Ahmed agreed to defer the first four (2026-10-26); the last waits on his answer.
- Accounts and a shared database behind groups. The group features themselves are in Tier 3.
- Wearable sync: the Google Health API (Google's new name for the Fitbit Web API), Oura, Withings.
- An AI that reshapes the dashboard, and connectors for chat apps other than Claude.
- The phone app (Play Store), and live GPS run tracking with it.
- What two friends suggested in a shared group-chat link (Sep 26), and a friend's workout suggestion (Sep 28). Ahmed needs to say what they were.

## Explicitly Cut
- **Ranges presented as guaranteed or "for sure"** (accepted by Ahmed, 2026-10-26). None of the 21 sources re-checked supports a guaranteed minimum and maximum for one meal, and every meal-level study shows big outliers. The honest version is the wider "very likely" range plus "count the top of it" for planning.
- **Medical interpretation or dosing.** No thresholds, alerts or doses. A carb budget only does arithmetic on a number a clinician gave (accepted default: no list of foods that "fit" it).
- **A gut score that claims to measure your microbiome.** The score rates the logged diet against published research, not your bacteria, and it carries no confidence % (accepted default: coverage counts take the place of the % he asked for).
- **A "least calories consumed" leaderboard** (accepted by Ahmed, 2026-10-26). It rewards restriction.
- **Real personal or family data in the public repo or demo.** The demo person is fictional, and these docs name no friends or relatives.

## Revisions
- **2026-10-26.** Ahmed reopened the approved scope to include every idea from his notes (`devpost/ideas-verbatim.md`): accounts (with a generated guest name), live integrations, a gut score, sleep length and averages now, and a range he can count on. Each was researched with re-checked sources. The POC boundary became build tiers. "Invented gut-health scores" moved from Cut to a research-based diet score. Accounts and integrations moved from Cut to Tier 2/3, in the versions that work with a fictional person.
- **2026-10-26, review pass.** Applied a 102-finding review: names and health details removed, sleep length and its 7-night average moved to Tier 1, tier labels added to the loop and success steps, claims narrowed to calorie estimates, gym log and 3D moved from Later to Tier 3. Ahmed's decisions follow marked defaults (`prd.md > Open Questions`).
- **2026-10-26, Ahmed's decisions.** He accepted all the defaults. He deferred only wearable sync, the AI dashboard, accounts and a database for groups, and the phone app. AI photo and voice logging and food research are built through a Claude connector, groups are built on the device, and runs, macro ranges and the sweat sodium note joined Tier 3.
- **2026-10-26, pre-ship privacy pass (Ahmed approved).** "Family profile" renamed "Second profile", so the public docs tie no condition to any person. The feature is unchanged (Tier 3, not built).
