# HowSure — food estimates, explained

HowSure is a food log where every number tells you how much to trust it.

Most calorie apps show one confident number. HowSure shows a best estimate, a **likely range**, a wider **very likely range**, and an **estimate score**. Tap any of them to see what the number means, which meal adds the most uncertainty, and where each figure comes from. Improve that one meal's evidence, for example by typing in its nutrition label instead of a photo guess, and you can watch the whole day's range narrow.

Days follow your sleep, not the clock. A snack at 12:40 AM stays on the day you were still awake for, and the sleep section shows last night's sleep and the 7-night average.

Built for the Devpost **Build With AI: Basics** hackathon with the Devpost Learn Skill Pack. The planning documents are in [`devpost/`](devpost/): scope, PRD, spec and the build checklist.

## Try it in 60 seconds

Requires Node 22.12 or newer and Chrome.

```bash
npm install
npm run dev:app
```

Open http://127.0.0.1:5273. **Start my log** opens your own empty log; for this walk-through choose **Try the fictional demo** below it. The header switch moves between the two (**Open my log** in the demo, **See the demo** in your log), and a reload opens the log you used last. In the demo, **More** › **Reset demo** puts back Sam's week as it started, asking first only if you changed it.

1. Sam's Wednesday reads **2,280 kcal** with **Estimate score 83**, likely 1,870–2,780 and very likely 1,684–3,087. "Most uncertainty comes from Pasta bake (ready meal)."
2. Tap **Estimate score 83**. The sheet explains what the score means and lists each meal's share of the uncertainty. **More detail** shows the calculation and the source behind every typical error.
3. Tap **Improve that entry**. Under **How do you know?** pick **Nutrition label (typed)**, then type over the old numbers with the label values from the pasta bake's note (860 kcal, protein 42 g, carbs 96 g, fat 33 g) and **Save**. The day becomes **2,380 kcal**, **Estimate score 92**, likely 2,153–2,631.
4. Reload the page. Everything is still there.
5. Tap **I'm going to sleep**, set the time to **4:40 AM** and **Save**, then tap **I woke up**, set **1:10 PM** and **Save**, to start a new waking day. **Previous** takes you back to Wednesday, with the 12:40 AM snack still on it.

6. Still on Wednesday, tap the wake time at the top (**Wed · awake since 1:20 PM**) to open the sleep and wake editor. Type **6 pm** as the wake time and **Save**: before anything changes, HowSure lists the meals that would move (the kefir and the pasta bake, to Tuesday's day). **Change the times** goes back; **Save and move** applies it.

Times can be typed as you would say them: **8**, **8am**, **8:15 pm** or **20:30**. The line under the field shows how it was read, with AM or PM. **Each night** in the sleep section lets you edit or delete any night, or **Add a missed night**, which splits a day that ran on because that night had no record. A wake before its sleep, a time later than now (in your own log) or a night that overlaps another is explained next to the field, and nothing is saved.

The demo person, Sam, is fictional, and so is every meal, sleep time and target in the demo.

### Log a usual meal again

**Log a meal** opens with **Saved** (meals you saved as usual) and **Recent** (the last different meals you logged, newest first) at the top. Tap one and it is logged at once, as a new meal with its own time and the same source and values, so a usual meal takes two taps. A short **Logged** line with **Undo** follows, just above **Log a meal**. **Amount** (×0.5, ×1, ×1.5, ×2 or a number from 0.1 to 10 that you type) scales the calories, macros and both ranges; the source stays the same, so the typical error stays the same percentage. To save a meal as usual, open it and choose **Save as a usual meal**. If you edit a meal after saving it, its details say what the saved meal still holds, and saving it again under that name updates the saved meal. **More** › **Saved meals** renames or deletes them; meals already logged never change. Saved meals are part of your log, so Export and Import carry them.

### Log a workout: net calories

Under the meals, **Workouts** › **Log a workout** takes a name, **How do you know?** (a device or watch estimate, a machine's display, or a rough guess, each with its typical error, all marked assumption), the calories burned, the start time and the duration. A blank number is unknown, never zero. A workout belongs to the waking day it started in. Once a day has a workout, the headline becomes **net calories** (eaten minus burned), with its own likely and very likely ranges and **Eaten** and **Burned** under it. Tap **Eaten** for the meals, each opening its breakdown; tap **Burned** for the workouts, with burned's own estimate score and ranges; tap net's ranges for how eaten and burned combine. The score under the headline stays the eaten score. Burned counts only the workouts you logged, not your resting burn, so net is not your full energy balance, and the app says so. In the demo, log a 300 kcal rough guess on Wednesday: the headline reads **1,980 kcal**, likely 1,455–2,505, with Eaten 2,280 and Burned 300. Sam's Monday already has a 210 kcal walk.

### Gym log

**Log a workout** › **Add gym sets** turns a workout into a gym session; **More** › **Gym log** › **Log a gym session** opens it that way. Its name is the split, such as Push. Each exercise has sets, and each set has a type (warm-up, working or drop set), a weight in kg or lb and its reps. A drop set lists its drops under it, each a lighter weight with its reps. **Add set** copies the set above, so a run of working sets is one tap each, and **Copy last session** starts from the previous session's exercises and sets (the last one with the same name when there is one). A blank weight is a set with no weight logged, such as a bodyweight set, never zero. Weights are stored in kg; switching the unit converts the weights already typed. Gym weights are shown in the unit of your latest gym session, and a new session starts in it; the weight log keeps its own unit, so you can lift in lb and weigh in in kg. **Remove exercise** on an exercise with something typed offers **Undo** until you save. The session keeps the workout's calories burned and source, so burned and net count it as any workout. On the dashboard, the day's gym sessions show right below the weight section with each exercise's top working set, and nothing shows on a day without one. **More** › **Gym log** (or **Gym log** beside the dashboard's gym section) lists every session across every date, newest first, each with its date and every set, and finds them by exercise or split. Each exercise also shows its **previous best**: the heaviest working set of that exercise in earlier sessions, with the most reps at that weight. Warm-ups and drop sets are left out, and nothing is estimated; an exercise logged before with only warm-ups or drop sets says it has no earlier working set. Coming back from a session opened in the gym log keeps your place in it.

### Estimated deficit or surplus

Add your age, sex (female, male, or prefer not to say), height (cm, or feet and inches) and weight (kg or lb) in **Profile and privacy** › **Body details**, also under **More** and from the line under the headline that invites them. Under the headline, eaten or net, one line then reads **Estimated deficit 350 kcal** or **Estimated surplus 120 kcal**, with its likely range, and opens how it is worked out. Resting burn comes from the Mifflin-St Jeor equation, times an everyday-activity factor (mostly sitting 1.2 by default, 1.375 or 1.55; it leaves workouts out, because the workouts you log are added on top, once). Burn is spread evenly over 24 hours and counted from the day's wake to the next wake, or to now on the current day, labelled **so far**. The range combines the meals', the workouts' and the equation's own spread (a 10% typical error, an assumption whose nearest study is Frankenfield et al. 2005, doi:10.1016/j.jada.2005.02.005). **Prefer not to say** uses the middle of the equation's two sex values and widens the range, and says so. Without all four details nothing is shown and nothing is guessed. Body details are kept with the log, so Export and Import carry them; the demo's stay in the demo. In the demo, add 34, female, 168 cm and 64 kg: Wednesday reads **Estimated surplus 1,453 kcal so far** at the demo's 1:30 AM, and Monday **Estimated deficit 369 kcal**.

Your daily calorie target is a target for eating, so it is always compared with calories eaten: Journal's range bar shows net once net is the headline and leaves the target off it (the target line says it is for calories eaten), Panel's ring keeps showing eaten against the target, with net in its centre labelled "kcal net" and "Ring: eaten, 95% of 2,400" under the ring, and Night's target chip reads "for eaten". A net range with an end below 0 is written "−140 to 3,140" in every look, and Journal's bar marks where 0 falls.

### Weight

The dashboard's **Weight** shows the day's weigh-in (or "No weigh-in today"), the **7-day average** with how many weigh-ins it holds, and the **trend**: the slope of a straight line fitted by least squares through the last 21 days of weigh-ins, given per week. The trend shows once there are 6 weigh-ins in those 21 days, spread over at least 4 days first to last (so weighing in each morning shows it from the 6th morning); until then it says what it still needs. It describes past weigh-ins and is not a prediction. **Log weight** takes the weight in kg or lb (30 to 300 kg, the same range as Body details; a saved weight left as it is is never re-checked, so its note or time can always change), the date and time (now, unless you change it), and an optional body fat % and note. A weigh-in belongs to the waking day it was taken in, like a meal, so correcting a wake time can move it to another day; the sleep editor's move warning lists it before you save, with the meals and workouts. Weights are stored in kg (1 lb = 0.45359237 kg), each keeping the unit it was typed in, and shown in the unit you pick. Switching the unit while editing a weigh-in converts the saved weight in the box, so the stored weight stays the same; a number typed over it is read in the unit picked, and the hint under the unit says which. The estimated deficit or surplus uses the latest weigh-in up to the end of the day it counts, and its explanation names that weigh-in; the weight in Body details counts only when there is none. Tap the weight to see every weigh-in, a chart of the last 30 days (every point on it is also in the list), and how the numbers are worked out; tap a weigh-in to edit or delete it. Weigh-ins are part of your log, so Export and Import carry them. `python3 scripts/golden.py` works out golden values for the average, the trend and its span rule on its own (`fixtures/golden-weight.json`), and the unit tests check the app against them.

### Week

**Week**, under **Previous** and **Next** at the bottom of the dashboard (also under **More**), shows the 7 waking days ending at the day on screen, with the average of every stat HowSure has: calories eaten with its likely and very likely ranges, the Estimate score, protein, carbs and fat; net calories, burned in workouts and its Estimate score, workout time, sets per gym session and the estimated deficit or surplus, once there are workouts, gym sessions or body details; sleep length, when you went to sleep and when you woke; and weight (with the dashboard's trend) and body fat, once there are weigh-ins. Each average says how many days or nights it counts, such as "average of 5 complete days (1 incomplete left out)" or "6 of 7 nights". A day with an unknown value is left out of that average and counted, never treated as zero, and a day with nothing logged says **Not logged**. A week shorter than seven days says it runs from the start of the log, and a week with nothing logged shows one line instead of empty rows. Tap an average for its day-by-day breakdown: each day's value, and whether it was counted, left out (and why) or not logged; the calories breakdown also draws each day as a bar with its range. Tap a day to open it on the dashboard. The week moves with the day on screen and rolls forward when a new waking day starts; today counts with what is logged so far, and each count that includes it says so ("average of 4 complete days and today so far"). In the demo, Sam's week averages **1,582 kcal** over 4 complete days and Wednesday so far, with Friday (an unknown meal) left out and Saturday not logged.

The calorie average groups every meal on the counted days by source, as a day does (`avg = X_total / N`, `sd_avg = sd_total / N`), so photo estimates don't "average out" across the week; golden G10 checks it. Clock times average as clock times, so 11:50 PM and 12:10 AM average to 12:00 AM. Every stat the app shows is listed once in `src/kernel/statRegistry.ts`, and a unit test fails when the saved log or a day's values hold something no stat reads; that file says how a new stat adds its week average.

### Every number opens its detail

Every number on the dashboard is one tap from where it comes from, in every look. The headline opens the meals behind it (once net is the headline, how net is worked out), and Panel's ring does the same. Tap **Protein**, **Carbs** or **Fat** (in Night, open the macro chip first) for that macro's detail: each meal's value with how you know it and its share of the known total, the daily target and how close the total is to it, and how a meal with no value is handled: it is left out and counted as missing, never as 0 g, so the total reads "at least"; a day with no meals says no meals are logged, never 0 g. Macros have no range yet; ranges cover calories only. Tap last night or the 7-night average for the sleep details: when you went to sleep and woke, the night's length (a missing time is "not logged", never 0), how the average is worked out with its count, and each night with **Edit**; an edit made there comes back to them. On a meal row, the score opens its explanation in one tap and the rest of the row opens the meal's details. A meal's details list the foods saved with it and their amounts (Sam's kefir breakfast: kefir 6 oz, rolled oats and blueberries), and for a looked-up meal how much was eaten (once the meal's source is edited to another one, the lookup says it is not used now); the meal's calories and macros stay its own totals, from its source, and the list stays as it was saved (**Edit** does not change it yet). A browser test taps every number on the dashboard in every look, "unknown" and "not logged" included, opens every disclosure to read what is in it, and fails on any number with nothing to open.

### Timeline

**Timeline**, beside **Week** at the bottom of the dashboard (also under **More**), shows the 3 waking days ending at the day on screen, or 4 with the day before. Each day with a wake time is drawn hour by hour as one row: every row starts when you woke, on one shared scale, so the days line up. A row shows the wake, a solid line at each midnight named by the new date's weekday, hour ticks, each meal as a dot and each workout as a diamond (hollow amber when its calories are unknown), each weigh-in as a square (one with no recorded time is listed, not drawn), the night that ended the day as a block with its length written above it (dashed while you are still asleep), now as a filled triangle, and a dashed **expected sleep** line, with a key to the marks drawn. Only today, while you are awake, has its rest drawn dotted from now up to expected sleep; a day that has ended stops at the wake that ended it, and its expected-sleep line stands on its own. Two waking days that start on the same date (a long daytime sleep logged as a night) each add their wake time to their name. When a night's sleep start was not logged, the time from the last entry to the next wake is a hatched stretch marked "sleep start not logged", never drawn as time awake. Expected sleep is your wake time plus your **usual day length**, a setting at the top of the timeline: 16 h until you change it (half-hour steps from 6 to 23 h; choosing 16 h again goes back to the preset), labelled "your setting, not advice", and saved in the log (a change in the demo stays in the demo). In the demo, Wednesday's expected sleep is Thu 5:20 AM, 16 h after the 1:20 PM wake, and the after-midnight snack sits on Wednesday's row after its midnight line (and, once Sam goes to sleep, before that night's sleep block). Under the drawing, **Each day** lists every entry in time order with its time and what the expected sleep is based on; the wake and the night that ended the day open that night in the sleep editor, and a meal, workout (gym sessions included) or weigh-in opens its details, with that day on screen behind it. Closing them comes back to the timeline, and closing the timeline puts back the day you were on. The day before the first wake time has no wake to draw from, so it is listed and not drawn.

## How the numbers work

- **Typical error per source.** Each way of knowing a meal's calories has a typical error: weighed 8%, nutrition label 10%, published menu 21%, description 41%, photo estimate 46%.
- **Estimate score.** `score = 100 × (1 − typical error)`. A score of 90 means "a typical error of about 10%". It is **not** a 90% chance of being right.
- **The day.** Errors from the same kind of source are added, because they tend to lean the same way. Different kinds partly cancel, combined as the root of the sum of squares. So three photo meals stay as unsure as one photo meal, rather than averaging out.
- **Ranges.** Ranges are lognormal and never go below zero. They are meant to catch about 8 in 10 (likely) and 19 in 20 (very likely) meals like this. These are **design targets**: HowSure has not measured its own hit rate.
- **Unknown is never zero.** A meal with no calories is listed under Missing information. The day says "Known meals only — incomplete day", and nothing is invented.
- **Net calories.** Burned is worked out like a day of meals: same-source workouts add, different sources combine as the root of the sum of squares, with its own score and lognormal ranges. Net = eaten − burned, and its spread is `√(sd_eaten² + sd_burned²)`, because the two are estimated separately. Net's ranges are normal (net ± 1.2816 sd and ± 1.96 sd), so they can go below zero, and net has no estimate score: a percentage of a number near zero says nothing. A workout with unknown calories is listed under Missing information and left out, as an unknown meal is.
- **Golden tests.** The maths rules above (typical errors, combining, the score and the ranges) are checked by golden values computed separately in Python (`scripts/golden.py`) and asserted in `src/kernel/__tests__/golden.test.ts`. The unknown-calories rule is checked in `src/kernel/__tests__/estimate.test.ts`.
- **Estimated deficit or surplus.** Resting burn = 10 × kg + 6.25 × cm − 5 × age + s (s = +5 men, −161 women, −78 for prefer not to say with an extra spread of 166 / √12 kcal). Everyday burn = resting × activity factor × hours counted / 24. Balance = eaten − (everyday burn + logged workouts), with spread `√(sd_eaten² + sd_workouts² + sd_everyday²)` and normal ranges, like net. Below 0 is a deficit. Golden values E1 and E2 come from `scripts/golden.py` (`fixtures/golden-energy.json`) and are asserted in `src/kernel/__tests__/energy.test.ts`.
- **Golden values for maths still to come.** `python3 scripts/golden.py` also works out the golden values for net calories (G6), weigh-minus-the-plate (G7), run pace and distance (G9) and the week average (G10) from the spec's formulas, and keeps them in `fixtures/golden.json`. `src/kernel/__tests__/golden-later.test.ts` checks the stored values against the spec. G6's kernel, `src/kernel/net.ts`, and G10's, `src/kernel/week.ts`, are built and asserted there; the others list their kernel's own test as pending until it lands.

## Sources

Every typical error is currently marked **assumption**. On 2026-10-26 each was re-checked against the nearest published study, and a figure is labelled "study" only when the study's own number, for the same method, backs it. None did. What each study found:

| Source | Typical error | Nearest study (re-checked 2026-10-26) | Why it stays an assumption |
|---|---|---|---|
| Weighed | 8% | Novotny, Gebauer & Baer 2012, *Am J Clin Nutr* 96(2):296–301, doi:10.3945/ajcn.112.035782 | Atwater factors overestimated almonds' measured energy by 32%. That is one food's energy per gram, not the error of weighing. |
| Nutrition label | 10% | Jumpertz et al. 2013, *Obesity* 21(1):164–9, doi:10.1002/oby.20185; 21 CFR 101.9(g) | 24 snack foods measured a median 4.3% above their labels (quartiles +0.2% to +13.7%). That is consistent with 10%, but it is a median and quartiles, not a typical error. |
| Nutrition label (looked up) | 12% | Jumpertz et al. 2013 (nearest); Open Food Facts data disclaimer | No study found measures barcode-database entries against measured energy. |
| Published menu | 21% | Urban et al. 2011, *JAMA* 306(3):287–93, doi:10.1001/jama.2011.993 | 269 chain-restaurant items were right on average. The spread was 134 kcal at quick-serve (about 20% of the mean) and up to 225 kcal at sit-down restaurants. |
| Photo estimate | 46% | Fridolfsson et al. 2025, *Curr Dev Nutr* 9(10):107556, doi:10.1016/j.cdnut.2025.107556 | On 52 food photos, two of three AI models (ChatGPT-4o and Claude 3.5 Sonnet) had a mean absolute percentage error of 35.8% for energy (Gemini 1.5 Pro: 64.2%), and estimates ran lower as portions grew. That is an average miss, not HowSure's spread measure. |
| Description | 41% | Block et al. 2013, *BMJ* 346:f2907, doi:10.1136/bmj.f2907 | 1,877 diners guessed their fast-food meal 175 kcal low on average, with a spread of 637 kcal on meals averaging 836 kcal. Untrained guesses can be much less sure than 41%. |
| Food database | 15% | Urban et al. 2013, *JAMA Intern Med* 173(14):1292–9, doi:10.1001/jamainternmed.2013.6163 | Non-chain restaurant meals held 19% more energy than database values: an average gap, not a per-entry error. |
| Workout: device or watch estimate | 40% | Shcherbina et al. 2017, *J Pers Med* 7(2):3, doi:10.3390/jpm7020003 | Seven wrist devices tested against lab gas analysis in 60 adults had median energy-expenditure errors from 27.4% to 92.6%; none was under 20%. 40% sits inside that range but is not a figure from the study. |
| Workout: machine display | 30% | Erdogan et al. 2010, *J Sports Sci Med* | A rowing machine's monitor read 2.3–2.9 kcal per minute too high against lab measurement. No study found gives a percentage for gym-machine displays. |
| Workout: rough guess | 50% | Willbond et al. 2010, *J Sports Med Phys Fitness* | 16 adults guessed about 825 kcal for a treadmill session that burned 200 kcal, and about 897 kcal for one that burned 300 kcal: 3 to 4 times too high. Guesses can be off by far more than 50%. |

## What leaves this machine

Nothing. The app makes no network requests beyond its own page (the browser tests check this), uses no account and no API key, and keeps your log in this browser's `localStorage`. The demo and your own log are stored separately.

### Your guest name

A new own log gets a readable random name such as "BraveKefir#4821": a clean adjective and noun (11 letters at most together), "#" and 4 digits, 16 characters at most. It shows at the top of the dashboard; tap it to open **Profile and privacy**, where it is labelled "Guest: saved on this device only" while that name is saved. **Reroll** gives a new generated name (with **Undo**), and **Rename** takes your own: the field starts with your current name and takes 1 to 16 letters or digits, spaces at either end trimmed, so a typed name never has the "#" and 4 digits. An empty name, one over 16 characters, or one with spaces or symbols inside gets a message under the field, and nothing is saved. There is no word list for a name you type: it is shown only to you, on your device. The demo keeps Sam's fixed name, "CalmLentil#3108"; Reroll and Rename are for your own log only. A log saved before names existed shows "No name yet", with no label, until you pick or type one.

When nothing of your own log is saved, opening it gives it a new generated name, saved at once: the first time you open it, and on a reload. **Delete my data** leaves nothing of your log on the device, and the emptied log starts again at once with a new generated name. That name is not saved until your first change (a meal, targets, a new name): until then Profile says "Not saved yet" in place of the label, and a reload picks another name, while going to the demo and back keeps it as it is, still unsaved. An imported file keeps its own name when it is shaped like a generated one or Rename would take it; otherwise your log keeps yours (or gets a new one if you have none), and the preview says which and leaves the name out of what the import replaces.

The word lists are `src/kernel/words.ts`. A unit test builds every adjective and noun pair and checks each word, and each pair across the join, against a short list of crude, hateful and awkward words kept in the test (sound-alikes such as "Pea" included) and against the copy word rules; the few pairs that spell such a word across the join are never made. The 4 digits are never one of a short list of hate or joke codes, such as 1488, 0088 or 0069.

### Your data: export, import, delete

In your own log, tap your name at the top (or "Your log") to open **Profile and privacy**:

- **Export my data** downloads your log as one JSON file, `howsure-log-YYYY-MM-DD.json`: the saved document with its format version. If this version can't read your saved log, the file holds the saved text unchanged, so you can always take your data out.
- **Import a log** reads a file made by Export, shows what it holds and what it replaces, and changes nothing until you confirm. Files from an older format are updated as they are imported. A file from a newer version, a file that isn't a HowSure log, and a file holding the fictional demo are refused, and nothing changes. When your log already holds something, the import keeps it as an older copy first, which you can export from the same panel.
- **Import from your earlier tracker.** Import also reads an export of the author's earlier food, weight and sleep tracker (see Provenance), told apart from a HowSure export by its shape. The preview says what it becomes (meals, days, nights, dates, targets) and everything the conversion did: every meal's time is approximate, because that tracker kept the day and not the time; which meals had no source recorded or a description cut short; which dates had no sleep recorded and join the day before; any bed time that overlapped the night before; how many weigh-ins go into the weight log and which have no recorded time; and what is not imported. Weigh-ins become weigh-ins in the weight log, in lb as the tracker kept them (stored in kg with the exact factor, 0.45359237), with body fat; one with no recorded time is placed just after the wake-up on its own date and marked approximate. When the log it replaces holds anything, the button reads **Replace my log** in the destructive style. If the imported log's last wake-up is days old, the header says when it was, and an earlier day that ran for more than 36 hours to its next wake-up (a date joined to it, say) says so under its headline. Each imported meal keeps its day, its calories and macros as stored, and all its original fields. Its details say "time approximate", give the tracker's source in its own terms, and say when its typical error is the tracker's own figure for that meal (with HowSure's figure for the source beside it), or, once its calories or source are changed, that HowSure's figure now applies. The converter is `src/import/trackerBundle.ts`, tested on a fictional export for Sam (`fixtures/tracker-bundle-sam.json`).
- **Delete my data** lists what it removes, asks first, and then removes your own log from this browser, including older copies kept by format updates and imports. The fictional demo is not affected.

### More: targets, look and full screen

**More**, at the top of the dashboard, lists the app's other places: Profile and privacy (your own log), **Targets**, **Saved meals**, **Week**, **Timeline**, **Weight**, **Look** and **Show full screen**.

- **Targets** holds your daily calories, protein, carbs and fat. A blank box means no target; 0 and negative numbers are refused. A target shows as a plain line beside the estimate score and under its macro. In the demo these are Sam's made-up targets, and a change stays in the demo.
- **Look** chooses how the dashboard is drawn. Every look shows the same numbers, details and actions. **Journal**, the default, is light and warm: the two ranges sit on one labelled bar with every number also written as text, Log a meal and the sleep button stay pinned to the bottom on a phone, and a wide screen shows the day on the left and the meals and sleep on the right. The choice applies at once and is kept on this device, apart from both logs, so Export, Import and Delete leave it alone.
- **Show full screen** shows HowSure without the browser's bars, using the whole screen. Where the browser can't or won't go full screen (for example Safari on an iPhone), the page widens instead and says so. **Exit full screen** at the top, or Esc, goes back. Nothing about it is saved.

## Run the checks

```bash
npx vitest run
npx tsc --noEmit
npx playwright test
python3 scripts/golden.py
```

The browser tests use your installed Chrome (`channel: 'chrome'`) at 390×844 and 1920×1080. Besides the maths, the checks cover the colour contrast of every text and background pair in `src/ui/theme.css`, in every state such as hover and disabled (`src/ui/__tests__/contrast.test.ts`), the copy word rules on `src/ui/copy.ts` and on every view and sheet in the browser (`tests/e2e/copy-sweep.spec.ts`), and that no user-visible text is written straight into a component instead of `copy.ts`.

### Test storage

Logs are kept per browser origin, so a test run on http://127.0.0.1:5273 would share storage with a log you use there. To keep them apart, set a storage namespace when you start the server: `VITE_HOWSURE_STORAGE_NS=dev npm run dev:app` keeps that session's logs under `howsure.dev.*` keys and never reads or writes the normal `howsure.demo.v1`, `howsure.mine.v1`, `howsure.active.v1` and `howsure.look.v1` (the chosen look). The browser tests do this for you (namespace `e2e`). The namespace uses lower-case letters, digits and dashes. Saved logs from an older format are upgraded when they load, and the original text is kept under a `….backup-vN` key first.

## Honest limitations

- **Every typical error is an assumption,** checked against its nearest study but not backed by it (see Sources).
- **The ranges are design targets.** No calibration run against reference meals has measured how often they contain the true value.
- **The method doesn't model bias.** Photo estimates and people's own descriptions both tend to run low on big plates, which the method doesn't count. So a day of photo and described meals may be less sure than it shows.
- **This is a proof of concept.** It runs locally in one browser, with no account and no sync.

## Provenance

- **Ideas.** HowSure rebuilds the ideas of a personal food, weight and sleep tracker that the author, Ahmed Sohail Butt, built for his own use in September–October 2026: a claude.ai artifact plus a Claude skill for logging food. **No code, styling or data from that prototype is used here, apart from the export-format details in the next point.** This repository was started from an empty folder on 2026-10-25.
- **Reused prior work: the tracker export format.** Import reads that tracker's export file (build-out item 2.1b), so `src/import/trackerBundle.ts` follows its record layout, its meal tag and its source codes. To apply that tracker's own floor to an imported meal's figure (never below a fifth of its default for the source), the converter holds that tracker's random and shared error for each source code. The person's data never enters this repository: it stays in the file they import on their own device, and the tests use a made-up export.
- **Reused prior work.** The starting typical-error figure for every source comes from that earlier tool: weighed 8%, label 10%, looked-up label 12%, menu 21%, food database 15%, description 41%, photo 46%, and the workout-burn figures (device 40%, machine 30%, rough guess 50%, in `src/kernel/sources.ts`, used for workouts and net calories). They are disclosed here and were re-checked against published studies (see Sources).
- **AI assistance.** This project was planned and built with AI assistance: Claude, via the Devpost Learn Skill Pack's interview-driven planning and agent-built, test-verified slices. The planning conversations' outputs are in `devpost/`.
- **Credits.** Some feature ideas came from friends who saw the earlier tracker.

## Roadmap

These are designed in `devpost/prd.md` but not built for this submission:
- plates (weigh minus the plate);
- barcode lookup;
- the rest of the privacy panel (the sent-off-device count and the connector switch; export, import and delete are built);
- a Claude connector for photo and voice logging;
- a gut-friendly diet score;
- food research via Claude;
- groups and leaderboards;
- room left as foods;
- nutrients and the processed-food share;
- meal photos;
- night tags;
- sleep import;
- optional sign-up;
- a carb budget for a second profile (arithmetic only);
- runs;
- macro ranges.

## License

MIT. See [LICENSE](LICENSE).
