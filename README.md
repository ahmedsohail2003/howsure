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

The demo person, Sam, is fictional, and so is every meal, sleep time and target in the demo.

## How the numbers work

- **Typical error per source.** Each way of knowing a meal's calories has a typical error: weighed 8%, nutrition label 10%, published menu 21%, description 41%, photo estimate 46%.
- **Estimate score.** `score = 100 × (1 − typical error)`. A score of 90 means "a typical error of about 10%". It is **not** a 90% chance of being right.
- **The day.** Errors from the same kind of source are added, because they tend to lean the same way. Different kinds partly cancel, combined as the root of the sum of squares. So three photo meals stay as unsure as one photo meal, rather than averaging out.
- **Ranges.** Ranges are lognormal and never go below zero. They are meant to catch about 8 in 10 (likely) and 19 in 20 (very likely) meals like this. These are **design targets**: HowSure has not measured its own hit rate.
- **Unknown is never zero.** A meal with no calories is listed under Missing information. The day says "Known meals only — incomplete day", and nothing is invented.
- **Golden tests.** The maths rules above (typical errors, combining, the score and the ranges) are checked by golden values computed separately in Python (`scripts/golden.py`) and asserted in `src/kernel/__tests__/golden.test.ts`. The unknown-calories rule is checked in `src/kernel/__tests__/estimate.test.ts`.
- **Golden values for maths still to come.** `python3 scripts/golden.py` also works out the golden values for net calories (G6), weigh-minus-the-plate (G7), run pace and distance (G9) and the week average (G10) from the spec's formulas, and keeps them in `fixtures/golden.json`. Their kernels aren't built yet, so `src/kernel/__tests__/golden-later.test.ts` checks the stored values against the spec and lists each kernel's own test as pending until it lands.

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

## What leaves this machine

Nothing. The app makes no network requests beyond its own page (the browser tests check this), uses no account and no API key, and keeps your log in this browser's `localStorage`. The demo and your own log are stored separately.

### Your data: export, import, delete

In your own log, tap your name at the top (or "Your log") to open **Profile and privacy**:

- **Export my data** downloads your log as one JSON file, `howsure-log-YYYY-MM-DD.json`: the saved document with its format version. If this version can't read your saved log, the file holds the saved text unchanged, so you can always take your data out.
- **Import a log** reads a file made by Export, shows what it holds and what it replaces, and changes nothing until you confirm. Files from an older format are updated as they are imported. A file from a newer version, a file that isn't a HowSure log, and a file holding the fictional demo are refused, and nothing changes.
- **Delete my data** lists what it removes, asks first, and then removes your own log from this browser, including older copies kept by format updates. The fictional demo is not affected.

### More: targets, look and full screen

**More**, at the top of the dashboard, lists the app's other places: Profile and privacy (your own log), **Targets**, **Look** and **Show full screen**.

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

- **Ideas.** HowSure rebuilds the ideas of a personal food, weight and sleep tracker that the author, Ahmed Sohail Butt, built for his own use in September–October 2026: a claude.ai artifact plus a Claude skill for logging food. **No code, styling or data from that prototype is used here.** This repository was started from an empty folder on 2026-10-25.
- **Reused prior work.** The starting typical-error figure for every source comes from that earlier tool: weighed 8%, label 10%, looked-up label 12%, menu 21%, food database 15%, description 41%, photo 46%, and the workout-burn figures (device 40%, machine 30%, rough guess 50%, in `src/kernel/sources.ts` but not used until workouts are built). They are disclosed here and were re-checked against published studies (see Sources).
- **AI assistance.** This project was planned and built with AI assistance: Claude, via the Devpost Learn Skill Pack's interview-driven planning and agent-built, test-verified slices. The planning conversations' outputs are in `devpost/`.
- **Credits.** Some feature ideas came from friends who saw the earlier tracker.

## Roadmap

Planned for this submission but not finished in time, to be built next:
- the sleep/wake editor, with its warning before meals move to another day.

These are designed in `devpost/prd.md` but not built for this submission:
- the week view and averages;
- gamer-tag guest names;
- workouts and net calories;
- plates (weigh minus the plate);
- barcode lookup;
- the rest of the privacy panel (the sent-off-device count and the connector switch; export, import and delete are built);
- a Claude connector for photo and voice logging;
- a gut-friendly diet score;
- food research via Claude;
- groups and leaderboards;
- a 3-day timeline;
- room left as foods;
- a weight log;
- nutrients and the processed-food share;
- meal photos;
- night tags;
- sleep import;
- optional sign-up;
- a carb budget for a second profile (arithmetic only);
- a gym log;
- runs;
- macro ranges.

## License

MIT. See [LICENSE](LICENSE).
