---
doc: spec
status: approved
---

# HowSure — Technical Spec

Implements `prd.md` (approved 2026-10-26). Headings below are what `5-build` slices along. Tier labels follow `prd.md > What We're Building`. **Unlabelled sections are Tier 1, as in `prd.md`.** A Tier 2 or 3 label sits on the first line under a heading, or on the bullet, row or folder it applies to, so heading names stay stable.

## How This Works, In Plain Language
HowSure is a web page that runs in your browser on your own computer. It has four parts:

1. **The app (what you see).** A React page. Everything you log (meals, sleep, workouts, plates) is kept in the browser's `localStorage`, a sticky note the browser keeps for one site. The demo person's data and your own log sit on two separate sticky notes, so they never mix. Close the tab, come back tomorrow, and the page reads the sticky note back.
2. **The maths core (the "how sure" engine).** A set of small, pure functions with no screen code. Give them meals and they hand back totals, ranges and estimate scores. Give them sleep times and they say which waking day each meal belongs to. Because they're pure, every one is tested against numbers worked out separately, by hand or in a separate Python script, before the screens use them.
3. **The Claude connector (Tier 2).** Two tiny programs that run on your computer only when you want Claude to help:
   - an **MCP server**, which is the plug Claude Desktop or Claude Code connects to;
   - a **local bridge**, a mini-server on `127.0.0.1` (your own computer) that holds Claude's proposals until the app picks them up.

   When you send Claude a meal photo, Claude looks at it, calls the connector's `propose_meal`, and the proposal waits in the bridge. The app checks the bridge every few seconds while it's open and shows the proposal in **From Claude**. Nothing becomes a meal until you tap **Add**.
4. **Lookups (Tier 2–3).** The app asks the public Open Food Facts database about a barcode. It saves every answer, so the demo never depends on the network.

Why this shape and not something bigger: there are no accounts, no database server and no API keys. The demo works for anyone, and a judge or teammate can run it from a fresh clone. The only extra process, the bridge, exists because a browser page can't receive messages from Claude by itself. Groups get the same treatment: they're built against a plug-in layer that today keeps everything on the device, so accounts and a real database can plug in later without changing a screen.

## The Core Journey Through the System
PRD ref: `prd.md > The Core Journey`.

1. **Arrive.** The app finds no saved state, so it shows the first-open screen. **Try the fictional demo** copies `fixtures/demo-week.json` into the demo sticky note and starts the **demo clock** at the fixture's moment: Wednesday's waking day, Thu 2026-10-22 01:30 local.
2. **Read the day.** `sleepday.assignDays()` puts each meal on its waking day: the snack at 00:40 sits on Wednesday, because Wednesday's waking day runs from Wednesday's wake to Thursday's wake. `estimate.combineDay()` returns the total, the estimate score, both ranges and the biggest contributor, and `estimate.macroTotals()` the protein/carbs/fat row. The dashboard draws them.
3. **Ask "how sure?"** Tapping the score opens the explanation sheet. It reads `combineDay()`'s per-source groups and per-meal contributions, plus each source's study from `sources.ts`.
4. **Improve.** **Improve that entry** opens the meal's edit sheet. As you type, the preview runs `combineDay()` on a *copy* of the day with the edited meal. On **Save**, the copy replaces the original in the sticky note, and the dashboard re-renders from the same function. That's why the preview and the result always match.
5. **Log a meal.** The sheet's values go through `parse.ts`: "1,501" becomes 1501, "abc" is an error, and blank means unknown. The meal is then validated by a `zod` schema and saved.
6. **The waking day holds.** The demo clock shows Thu 01:30, but the header shows "Wed · awake since 1:20 PM", because no sleep has been logged since that wake.
7. **Reload.** The app reads the sticky note back, and the demo clock continues from where it was.
8. **Sleep and wake.** **I'm going to sleep** adds a sleep record with no wake time yet. **I woke up** fills in its wake time, which starts a new waking day, and the dashboard moves to it (`Clock` covers times later than the demo's "now"). `sleepday.nightStats()` gives last night's length and the 7-night average.
9. **Ranges.** `combineDay()` returns both the likely (`z80`) and very likely (`z95`) ranges. Tapping either opens `ExplainSheet` (ranges), which shows the planning line and the study behind each source from `sources.ts`.

Tier 2 additions travel the same path:
- the week view calls `week.summarise()`;
- net calories calls `net.combine()`;
- the gut meters call `gut/*.ts`;
- a barcode lookup goes through `lookups/openFoodFacts.ts` and its cache;
- a Claude proposal travels Claude → MCP server → bridge → the app's inbox poll → **Add** → the same save path as step 5.

## Stack
| Piece | Choice and pinned version | Why (accepted by Ahmed, 2026-10-26) | Docs |
|---|---|---|---|
| Language | TypeScript `typescript@7.0.2` (`tsc --noEmit` for type checks) | Typed data shapes catch mismatches between the maths core and the screens | https://www.typescriptlang.org/docs/ |
| UI | `react@19.3.1`, `react-dom@19.3.1` | Same shape as his EmberHacks build; lots of screen state (sheets, lists, week view) | https://react.dev/ |
| Dev server and build | `vite@8.3.5`, `@vitejs/plugin-react@6.1.2` | Fast local dev; no framework beyond React | https://vite.dev/guide/ |
| Data validation | `zod@4.6.7` | One set of schemas: `shared/connector-schema.mjs` holds the proposal and meal-input schemas, used by the bridge and the MCP server, and `src/store/schema.ts` imports them for saved data and imports | https://zod.dev/ |
| Claude connector (Tier 2) | `@modelcontextprotocol/sdk@1.32.2` (stdio server); its peer range for zod is `^3.25 \|\| ^4.0` | The official MCP SDK; Claude Desktop and Claude Code launch stdio servers | https://modelcontextprotocol.io/docs |
| Unit tests | `vitest@5.0.5` | Runs the pure maths core; no browser needed | https://vitest.dev/guide/ |
| Browser tests and video capture | `@playwright/test@1.64.1`, using the installed Chrome (`channel: 'chrome'`), so no browser download. Recording video also needs Playwright's ffmpeg (open item under `## Decisions and Open Issues`) | Clicks through every PRD checkbox; the same driver records the demo | https://playwright.dev/docs/intro |
| Types | `@types/react@19.3.0`, `@types/react-dom@19.3.0`, `@types/node@22.20.5` | Editor and `tsc` types. Node types match the Node 22 runtime (latest 22.x by `npm view`, 2026-10-26; Vite 8.3.5 accepts `^20.19.0 \|\| >=22.12.0`), so `tsc` flags APIs newer than the runtime | — |

- **Runtime:** Node `22.14.0` (installed and checked; Vite 8 needs ≥ 22.12, Vitest 5 needs ^22.12) and npm `10.9.2`.
- **TypeScript config:** `tsconfig.json` sets `"allowJs": true, "checkJs": true` and includes `shared/**/*.mjs` and `connector/**/*.mjs`, so the app's imports of `shared/connector-schema.mjs` type-check (no TS7016) and the connector code is checked too. The shared file stays JavaScript because Node 22.14 can't run `.ts` without an experimental flag.
- **No other runtime libraries:**
  - charts are hand-drawn SVG;
  - styling is one plain CSS file with design tokens;
  - views switch on state, with no router;
  - the bridge uses Node's built-in `http` module;
  - GPX (Tier 3) is parsed in the browser by `src/lookups/gpx.ts` with `DOMParser`;
  - 3D (Tier 3) uses CSS 3D transforms on the existing SVG, or a library pinned when that slice starts, like `supabase-js`.
- **Checked today:** versions came from `npm view` on 2026-10-26, along with the compatibility checks (engines and peer dependencies).
- **Flagged to check early in the build:**
  - `typescript@7.0.2` is the new native compiler. If `tsc --noEmit` misbehaves with Vite's types or with `allowJs`, fall back to the latest 5.x and record it under `## Decisions and Open Issues`.
  - `@modelcontextprotocol/sdk@1.32.2` is 3 days old. If its stdio server fails, pin the previous 1.32.x.

## Where It Runs and How Someone Tries It
- **Runs:** locally in Chrome, on Windows, macOS or Linux, with Node ≥ 22.12. No API keys are needed for Tiers 1–2.
- **Ports:** HowSure uses **5273** (Vite) and **5274** (bridge), outside 5173–5180, so it never collides with the other entry's Vite on 5173. `vite.config.ts` sets `server: { host: '127.0.0.1', port: 5273, strictPort: true }`; Vite's default would silently move to the next free port. The app and the MCP server call `http://127.0.0.1:5274`, never `localhost`, because on this machine `localhost` resolves to `::1` first.
- **Start it:**
  1. `npm install`
  2. `npm run dev`. `scripts/dev.mjs` starts Vite (http://127.0.0.1:5273) and the bridge (http://127.0.0.1:5274) with `process.execPath` and no shell:
     ```js
     spawn(process.execPath, [fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url))], { stdio: 'inherit' })
     spawn(process.execPath, [fileURLToPath(new URL('../connector/bridge.mjs', import.meta.url))], { stdio: 'inherit' })
     ```
     When either child exits, it kills the other and calls `process.exit(code ?? 1)`; on SIGINT or SIGTERM it kills both. (On Windows, `spawn('npx')` gives ENOENT, `spawn('npx.cmd')` gives EINVAL, and `shell: true` leaves Vite holding its port after Ctrl+C.) Check: after Ctrl+C, `Get-NetTCPConnection -LocalPort 5273,5274 -ErrorAction SilentlyContinue` prints nothing.
  3. Open http://127.0.0.1:5273 and choose **Try the fictional demo**.
- **App only, without the bridge:** `npm run dev:app` (Vite alone). Everything works except the Claude connector, and no From Claude section appears.
- **Tests:**
  - `npm run test` → `vitest run`. `vitest.config.ts`: `test: { include: ['src/**/__tests__/**/*.test.ts', 'tests/connector/**/*.test.ts'], setupFiles: ['tests/vitest.setup.ts'] }`. The setup file sets `process.env.TZ = 'America/Toronto'`, so day labels don't depend on the machine.
  - `npm run typecheck` → `tsc --noEmit`;
  - `npm run e2e` → `playwright test`. `playwright.config.ts`: `testDir: 'tests/e2e'`; `use: { channel: 'chrome', baseURL: 'http://127.0.0.1:5273', timezoneId: 'America/Toronto' }`; `webServer: { command: 'npm run dev:app', url: 'http://127.0.0.1:5273', reuseExistingServer: false, env }`; projects at 390×844 and 1920×1080. `env` gives Vite `HOWSURE_BRIDGE_PORT=5284` and a temp `HOWSURE_DATA_DIR`, and the connector e2e starts its own bridge with the same values, so tests never touch the real inbox.

  **One Playwright or ffmpeg job at a time across both entries.** This computer has 16 GB of RAM; check the other entry's progress log before starting one.
- **Claude connector setup** (README section "Connect Claude", with screenshots). The bridge must be running (`npm run dev`).
  - **Claude Code**, from the repo root in PowerShell: `claude mcp add howsure -- node "$PWD\connector\mcp-server.mjs"` (syntax `claude mcp add [options] <name> -- <command> [args...]`, default scope local).
  - **Claude Desktop:** *Settings → Developer → Edit Config* (the file is `$env:AppData\Claude\claude_desktop_config.json`). Add the server with forward slashes (or `\\`) in the path, then restart Claude:
    ```json
    { "mcpServers": { "howsure": { "command": "node", "args": ["C:/Users/you/food-log-how-sure/connector/mcp-server.mjs"] } } }
    ```
    If Desktop can't find `node`, use `"command": "C:/Program Files/nodejs/node.exe"`.
- **Demo recording:** `npm run demo:record` → `playwright test --config demo/playwright.demo.config.ts`. That config uses `testDir: '.'`, `outputDir: 'out'` and `use: { channel: 'chrome', baseURL: 'http://127.0.0.1:5273', timezoneId: 'America/Toronto', viewport: { width: 1920, height: 1080 }, video: { mode: 'on', size: { width: 1920, height: 1080 } } }`. Without `size`, Playwright scales the video down to fit 800×800. Before recording, `npm run check:demo-lookup` must pass and no other Playwright or ffmpeg job may be running (see above). The Claude connector segment is captured separately as a screen recording of Claude Desktop, using a generic meal photo Ahmed takes himself.
- **Deployment:** none (Ahmed's choice). Submission is the demo video plus the public GitHub repo. A hosted copy couldn't run the connector anyway.

## Look and Feel
Carries `prd.md > Look and Feel` and `scope.md > Inspiration & Identity` into tokens in `src/ui/theme.css`:
- **Colours:**

  | Token | Value | Use |
  |---|---|---|
  | `--bg` | `#FAF7F2` | warm off-white background |
  | `--surface` | `#FFFFFF` | sheets and panels |
  | `--ink` | `#2B2B2B` | charcoal text |
  | `--ink-soft` | `#5E5A55` | secondary text |
  | `--line` | `#E6E0D6` | subtle borders |
  | `--teal` | `#2F7F7A` | primary action fills, borders and icons |
  | `--teal-ink` | `#2A736E` | teal text and links |
  | `--amber` | `#B7791F` | uncertainty and incomplete information: fills, borders and icons |
  | `--amber-ink` | `#8A5A12` | amber text labels |
  | `--amber-bg` | `#FBF1E1` | amber backgrounds |

  Every amber or teal signal also carries a text label, never colour alone. Text in teal or amber uses the `-ink` tokens: `--amber` and `--teal` fall below 4.5:1 as text (3.41 and 4.43 on `--bg`), while `--amber-ink` gives 5.53 on `--bg`, 5.28 on `--amber-bg` and 5.91 on white, and `--teal-ink` 5.20, 4.97 and 5.56. White text on `--teal` buttons is 4.73 (ratios computed in Python, 2026-10-26). **Contrast is a test:** `src/ui/__tests__/contrast.test.ts` computes the WCAG ratio for every text/background pair in `theme.css` (fails below 4.5:1) and for the `--teal` and `--amber` signal colours against their backgrounds (fails below 3:1).
- **Type:** `font-family: "Segoe UI", system-ui, -apple-system, sans-serif`. Numbers use `font-variant-numeric: tabular-nums`. The headline number is 44 px with weight 600; body text is 16 px on a 1.5 line height; secondary text is 14 px. No web fonts and no CDN.
- **Density:** calm and journal-like.
  - spacing on an 8 px scale;
  - one column on phones (390 px), and the same column centred at 640 px max on desktop;
  - borders at 1 px `--line`, shadows only on sheets (`0 2px 12px rgba(0,0,0,.08)`);
  - transitions of 150 ms or less, and none under `prefers-reduced-motion`.
- **Copy tone:** plain and precise, never salesy. All user-visible copy lives in `src/ui/copy.ts` (study titles in `sources.ts`), and the word rules are tests (see `### Screens`).
  - "Estimate score", never "accuracy";
  - "likely" and "very likely", never "for sure";
  - "unknown", never 0.
- **Hierarchy:** the headline number dominates. Everything else is one tap deep, matching `prd.md > Screens and Layout`.

## Components

### Maths Core: Sources Table
`src/kernel/sources.ts`. The single sources table. Each entry: `{ id, label, typicalError, macroErrors?, basis: { kind: 'study' | 'assumption', cite?, doi?, finding?, checked? } }`.

Starting values are Ahmed's earlier personal tracker figures, disclosed in the README as prior work, as Ahmed accepted:

| id | Label | Typical error | Starts as | Re-check against (build slice) |
|---|---|---|---|---|
| `weighed` | Weighed | 8% | assumption | Novotny 2012 (Atwater factors overestimated measured almond energy by 32%) shows weighing doesn't make calories exact; the 8% stays an assumption unless a study supports it |
| `label` | Nutrition label (typed) | 10% | assumption | Jumpertz 2013 (snack labels: median +4.3%, IQR 0.2–13.7%); 21 CFR 101.9(g) |
| `label_lookup` | Nutrition label (looked up) (Tier 2) | 12% | assumption | Same as label, plus database-entry error (Open Food Facts makes no accuracy promise) |
| `menu` | Published menu | 21% | assumption | Urban 2011 *JAMA* (269 restaurant items; SD 225 kcal sit-down, 134 quick-serve) |
| `photo` | Photo estimate | 46% | assumption | Fridolfsson 2025 (AI photo energy MAPE 35.8%) |
| `description` | Description | 41% | assumption | Urban 2013 (non-chain meals 19% above database values); self-report literature |
| `food_db` | Food database (Tier 3) | 15% | assumption | USDA FoodData Central entries plus portion error |
| `burn_device` | Device or watch estimate (Tier 2) | 40% | assumption | Shcherbina 2017 *J Pers Med* (wrist devices' energy-expenditure error) |
| `burn_machine` | Machine display (Tier 2) | 30% | assumption | to be researched |
| `burn_guess` | Rough guess (Tier 2) | 50% | assumption | to be researched |

- **What "photo estimate" means:** calories estimated from a meal photo by an AI (another app, or your Claude through the connector), matching Fridolfsson 2025's AI-photo method. A person's own guess with no label, menu or scale is `description`. The same line shows as a hint under **How do you know?**
- **Looked-up amounts (Tier 2):** a `label_lookup` meal uses 12% when the amount was weighed or the whole package was eaten. For an estimated portion, its error is √(0.12² + 0.41²) = 42.72%: the lookup's error combined in quadrature with `description`'s 41% for the amount. That reuse is marked "assumption", and the meal stays grouped under `label_lookup`.

**The re-check step** (Tier 1 slice "sources re-check"): open each study with the PubMed tool or the publisher's page. A row becomes `kind: 'study'` only when the study's own figure for the matching method supports the number; record the citation, DOI, a one-line finding and the date checked. Otherwise the row stays "assumption", with its nearest study shown as context.

**Macro errors (Tier 3):** photo protein MAPE 60.7–61.7% (Fridolfsson 2025: 60.7% ChatGPT-4o, 61.7% Claude 3.5 Sonnet). A macro range is shown only for a source and macro pair with a value in `macroErrors`; any other pair shows its known total with no range, labelled "no range yet". The Tier 3 slice re-checks photo protein, photo carbs and fat (Fridolfsson 2025, if it reports them) and label macros (21 CFR 101.9(g)); each stays "assumption" until checked.

PRD ref: `prd.md > Estimate Score and Explanations`, `prd.md > Workouts and Net Calories`, `prd.md > Barcode Lookup (Live)`.

### Maths Core: Estimates, Ranges and the Day
`src/kernel/estimate.ts`. The method Ahmed agreed on: same-source errors add up, and different sources partly cancel.
- **Per item:** an estimate `x` (kcal) and typical error `e` (a fraction, from `sources.ts`, including the looked-up-amount rule), so its absolute spread is `sd = x · e`.
- **Per day:**
  1. Group the known-calorie items by source id, and add each group's spreads straight: `sd_g = Σ sd_i`, because errors from the same method lean the same way.
  2. Combine the groups as the root of the sum of squares: `sd_day = √(Σ sd_g²)`.
  3. Then `e_day = sd_day / X`, where `X` is the known total.
- **Estimate score:** `score = clamp(Math.round(100 · (1 − e)), 0, 100)`, rounding half up; the Python generator uses `math.floor(x + 0.5)`. It is shown only when `X > 0`; otherwise "Not available yet".
- **Ranges** (lognormal, never below 0), with `z80 = 1.2816` and `z95 = 1.9600`:
  - likely `[X / (1+e)^z80, X · (1+e)^z80]`;
  - very likely `[X / (1+e)^z95, X · (1+e)^z95]`;
  - ends are displayed with `Math.round`.
- **Biggest contributor:** the meal with the largest share of `sd_day²`. A meal's share is its group's `sd_g²` split in proportion to its `sd_i` within the group. Ties go to the larger kcal, then the earlier `eatenAt`, then the lower id. Only meals with known calories are ranked; unknown ones are listed under Missing information.
- **"What would improve it"** (`improve(day, mealId)`, computed, never hard-coded):
  - `bestSource` is the meal source (`weighed`, `label`, `label_lookup`, `menu`, `photo`, `description`, `food_db`) with the lowest `typicalError` in `sources.ts`, computed so it follows the re-check.
  - The suggestion is `label` if its error is lower than the meal's, otherwise `bestSource` if its error is lower, otherwise none. With today's table: photo, description, menu, food_db and label_lookup → label; label → weighed; weighed → none.
  - It returns the suggested source with the meal's new typical error and the day's new score, or `null`. With `null`, the dashboard line reads "Most uncertainty comes from [meal]. It already uses the most reliable source.", **Improve that entry** is hidden, and `MealDetails` says "No better source in HowSure."
- **Macro totals:** `macroTotals(meals)` returns `{ protein | carbs | fat: { known, missing, allUnknown } }`. Blank is unknown, never 0 (unit tests). The dashboard's `MacroRow` shows the known total, how many entries are missing that macro, or "unknown" when a day with meals has no values for it.
- **More detail text** includes:
  - "These ranges are design targets, meant to catch about 8 in 10 and 19 in 20 meals like this. HowSure hasn't measured its own hit rate."
  - The limit, replacing `prd.md`'s draft wording (which assumed separate errors): "Errors from the same kind of source are added, because they tend to lean the same way. Different kinds partly cancel. Photo estimates and people's own descriptions can both run low on big plates, which this doesn't count, so a day of photo and described meals may be less sure than this shows."
  - Why there's no shared part between photo and description: no study re-checked gives a correlation between photo and description errors, so any value would be invented. The limit text states the gap instead.

**Golden expected values**, computed independently in Python on 2026-10-26 (the build commits the generator as `scripts/golden.py`, standard library only, never imported by the app) and copied into `src/kernel/__tests__/golden.test.ts`:

| Case | Input | Expected |
|---|---|---|
| G1 | one label meal, 500 kcal | e 10%, score 90, likely 443–565, very likely 415–603. Improve suggests weighed: e 8%, score 92, likely 453–552, very likely 430–581 |
| G2 | three photo meals, 600 kcal each (one source) | total 1800, e 46.00%, score 54, likely 1108–2924, very likely 857–3779; the tie-break names the earliest meal |
| G3 | photo, description and menu, 600 kcal each | e 21.70%, score 78, likely 1399–2315, very likely 1225–2645 |
| G4 | 1000 kcal photo + 3 × 100 kcal label | total 1300, e 35.46%, score 65, likely 881–1918, very likely 717–2357; biggest contributor is the photo meal |
| G4b | G4 after improving the photo meal to label | e 10.00%, score 90, likely 1151–1469, very likely 1078–1567 |
| G5 | three photo meals, if treated as independent (documentation only) | e 26.56%, score 73. Shows why the method keeps same-source errors added |
| G11 | the demo's Wednesday (`### Demo Fixture`), before Improve | total 2280, e 16.72%, score 83, likely 1870–2780, very likely 1684–3087; biggest contributor "Pasta bake (ready meal)"; Improve suggests label |
| G11b | G11 after re-logging the pasta bake from its note (label, 860 kcal) | total 2380, e 8.14%, score 92, likely 2153–2631, very likely 2042–2775; biggest contributor now "Apple and peanut butter" (description) |
| G12 | weighed meal 700 kcal + label meal 150 kcal | e 6.82%, score 93, likely 781–925, very likely 747–967; biggest contributor is the weighed meal, so `improve` is `null` and **Improve that entry** is hidden |

Tolerance: ±1 kcal on range ends and ±0.01 percentage points on `e`. PRD ref: `prd.md > Estimate Score and Explanations`, `prd.md > Improve That Entry`, `prd.md > Days With Unknown Calories`, `prd.md > Dashboard`.

### Maths Core: Net Calories
**Tier 2.** `src/kernel/net.ts`.
- `N = X_eaten − B_burned`, and `sd_N = √(sd_eaten² + sd_burned²)`: eaten and burned are independent.
- Burned uses the same per-source grouping as meals. `net.combine()` also returns burned's own score and ranges, which `WorkoutList` shows.
- **Range** (normal, because net can be near or below 0): likely `N ± 1.2816 · sd_N`, very likely `N ± 1.96 · sd_N`.
- **No score for net.** The estimate score stays on calories eaten.
- **The note:** "Not your full energy balance: your body's resting burn isn't counted, so net alone can't show whether you ate more or less than you burned." There is never a deficit or surplus word.
- **The explanation** (`ExplainSheet`, net mode) shows eaten's range, burned's range and how they combine (`sd_N` above).
- **Golden G6:** eaten 1800 (sd 828) − burned 300 (device, e .40, sd 120) gives net 1500, sd 836.7, likely 428–2572, very likely −140–3140.

PRD ref: `prd.md > Workouts and Net Calories`.

### Maths Core: Waking Days and Sleep
`src/kernel/sleepday.ts`.
- **Sleep records:** `{ id, sleepStart: ISO | null, wake: ISO | null }`, kept in time order.
- **A waking day** runs from one wake up to (not including) the next. A meal at time `t` belongs to the day whose wake is the latest wake ≤ `t`. So a 3 AM snack during a recorded sleep joins the day that was ending (PRD open question, resolved).
- **The current day:** the waking day of the latest wake, or the provisional day when there is no wake. The dashboard opens on it, and after **I woke up** it moves to the new, empty day.
- **The provisional day:** meals before the first wake, or all meals when there is no wake yet ("Wake time not set").
- **No automatic split.** A day continues until the next wake, however long it runs.
- **Current status:** awake if the latest record has a wake time (or there are none); asleep if it has a sleep start and no wake.
- **Validation:**
  - `wake > sleepStart` within a record;
  - `sleepStart > the previous record's wake`;
  - records never overlap;
  - in your own log, a time later than now is rejected (the demo advances its clock instead; see `Clock`).

  A failure returns an inline message and the saved record stays unchanged.
- **`movedMeals(before, after)`** lists the meals whose day changes. It powers the confirmation before a sleep correction and the provisional-day preview.
- **`nightStats(records, lastN = 7)`:** each night's length (`wake − sleepStart`), with "not logged" for a record missing a sleep start. It returns the average over complete nights with its count ("6 of 7 nights"), and the average wake time as a **circular mean**:
  - each wake time in minutes becomes an angle `A = 2π · minutes / 1440`;
  - `m = Math.round(Math.atan2(Σ sin A, Σ cos A) · 1440 / (2π))`, then `m = ((m % 1440) + 1440) % 1440`, because JS `%` keeps the sign;
  - if the resultant length `√(S² + C²) / n` is below 0.2, it shows "Wake times vary too much to average".
- **Golden values:**
  - G8: the average of 23:50 and 00:10 is 00:00, and of 13:10 and 13:30 is 13:20 (the raw value is 799.99…, so round, never floor).
  - G8c: 23:30 and 23:50 → 23:40.
  - G8d: 06:00 and 18:00 → no average (resultant 0).
  - Demo: the snack at Thu 00:40 belongs to Wed's day (wake Wed 13:20).

PRD ref: `prd.md > Sleep and Waking Days`, `prd.md > Editing Sleep and Wake Times`, `prd.md > Previous Days`.

### Maths Core: Week Summary
**Tier 2.** `src/kernel/week.ts`. Covers the seven waking days ending at the viewed day.
- **Per day:**
  - `logged`, `incomplete` (some meals unknown), or `not logged`;
  - the estimate and both ranges for complete days;
  - "known meals only" subtotals for incomplete days.
- **Calorie average:** over complete days only, labelled "average of N complete days (M incomplete left out)". Group every meal across those N days by source, add within each source, and combine sources by the root of the sum of squares to get `sd_total`. Then `avg = X_total / N`, `sd_avg = sd_total / N`, `e_avg = sd_avg / avg`, and the ranges use the same lognormal shape as a day. That way photo bias doesn't "average out" across the week; treating days as independent would understate the spread.
- **Macro averages:** leave out days with any meal missing that macro, and say how many were left out.
- **Sleep:** from `nightStats`.
- **Net and weight:** `summarise()` returns an optional `net` row (Tier 2, when the week has workouts) and an optional `weight` row (Tier 3, once `Weight Log` exists), each labelled with its tier.
- **Golden G10:** complete days G4 and G3 plus one incomplete day (left out) give average 1550, sd 393.4, e 25.38%, likely 1160–2071, very likely 995–2415, labelled "average of 2 complete days (1 incomplete left out)". The days-independent method would give e 19.49%, so the test tells them apart. Same tolerances as the day.

PRD ref: `prd.md > Week View`.

### Maths Core: Number Parsing
`src/kernel/parse.ts`. `parseAmount(s)` works on the trimmed text:
- empty → `unknown`;
- `^\d{1,3}(,\d{3})+(\.\d+)?$` → commas stripped (`"1,501" = 1501`);
- `^\d+,\d{1,2}$` → decimal comma (`"13,9" = 13.9`);
- `^\d+(\.\d+)?$` → the number;
- anything else, including letters, a minus sign, `"1,5012"`, `"1.501,5"`, `"1 501"` and `"1,2,3"` → an error object with "Use digits, e.g. 1501 or 13.9".

`0` is a valid zero, distinct from blank.

PRD ref: `prd.md > Calorie Input Rules`.

### Maths Core: Plates and Gamer Tags
**Tier 2.**
- `src/kernel/plates.ts`: `foodGrams = reading − plate`. A reading at or below the plate is an error. `kcal = foodGrams · kcalPer100 / 100`, and it returns the arithmetic line. It also resolves a weighed Claude proposal's `plateName` against the saved plates; an unknown name returns "No saved plate called [name]." Golden G7: a 612 g reading with a 212 g plate at 165 kcal/100 g gives 400 g and 660 kcal.
- `src/kernel/gamertag.ts`: adjective + noun, together at most 11 letters (from curated lists in `src/kernel/words.ts`, about 60 + 60, all clean), + `#` + 4 digits from `crypto.getRandomValues`, 16 characters at most. **Rename** replaces the whole name with 1–16 letters or digits, and the `#NNNN` suffix is dropped.

PRD ref: `prd.md > Plates: Weigh Minus the Plate`, `prd.md > Guest Profile and Gamer-Tag Name`.

### Maths Core: Gut-Friendly Diet Score
**Tier 2, last.** `src/kernel/gut/digm.ts`, `plants.ts`, `fermented.ts`, `amounts.ts`, with data in `fixtures/foods.json`. Rules exactly as `prd.md > Gut-Friendly Diet Score` and `research-verified` (Kase 2024, McDonald 2018, Wastyk 2021).
- **Amounts:** `gut/amounts.ts` resolves each listed food to grams: `g` as typed, `oz` × 28.3495, servings × the food's `servingG`. Fermented servings are grams ÷ the food's `fermented.servingG` (the study's size), so 6 oz of kefir adds 1 serving.
- **Tags:** a food's tags come from `foods.json`, then the meal's `tagOverrides` (`add`, `remove`). Edits in a meter's breakdown write `tagOverrides` on that meal, so removing a wrong plant tag lowers the plant count.
- **Diet index:**
  - each logged day scores 0–14: 10 beneficial foods present, plus 4 unfavourable ones absent;
  - fat ≥ 40% of known kcal;
  - the **fiber point** follows `prd.md`'s three-way rule: earned if known fiber already reaches 25 g; not earned if every meal's fiber is known and the total is under 25 g; otherwise "not checked". A meal's fiber is known from `meals.fiberG` (a lookup's `fiber_100g` × grams eaten) or, when it lists foods, from Σ grams × `fiberPer100` / 100. One unit test per branch;
  - days with nothing logged are excluded;
  - the score is the mean over logged days in the last 7.
- **Plants:** distinct species-level names over 7 days, normalised through the food list ("red onion" → "onion").
- **Fermented:** servings per day as a 7-day average, using the study's serving sizes (6 oz yogurt, kefir or kombucha; ¼ cup kimchi or sauerkraut; 2 oz brine drink).
- **Coverage:** "based on N of M meals tagged".
- **The food list** (`fixtures/foods.json`): about 150 common foods, each `{ name, species, plant: bool, servingG, fermented?: {type, servingG}, digm: [...flags], kcalPer100, fiberPer100, fatPer100, source: 'USDA FDC <fdcId>' }`. Values come from named USDA FoodData Central entries, credited "Source: USDA FoodData Central" in the app and README (public domain, CC0). Building it from the FDC bulk download needs Ahmed's approval first (`## Decisions and Open Issues`).

PRD ref: `prd.md > Gut-Friendly Diet Score`, `prd.md > Logging a Meal` (Foods in this meal).

### Store
`src/store/storage.ts`, `src/store/schema.ts`.
- **Two keys:** `howsure.demo.v1` and `howsure.mine.v1`. Each is one JSON document validated by a `zod` schema: `{ version, profile, meals, sleeps, workouts, plates, lookups, sentCount, proposals, research, groups, settings, clock?, weighIns?, familyProfiles?, readings? }`. Keys for Tier 2 and 3 features are added with their slice (`## Data Model` has each shape); `clock` exists only in the demo document.
- **Saving:** every change writes the whole document, synchronously, inside `try/catch`.
- **Load:** a failed parse shows "Couldn't read saved data". It never silently wipes; Export still works.
- **Photos (Tier 3):** IndexedDB `howsure-photos`, keyed by meal id.
- **Switching** between demo and mine just changes which key is active, so neither is touched.
- **Reset demo** reloads the fixture, asking for confirmation only when the demo has been edited. "Edited" means a hash of `{ profile, meals, sleeps, workouts, plates }`, serialized in a fixed key order, differs from the same projection of `fixtures/demo-week.json` (converted as on demo start). The clock, the lookup cache, `sentCount` and proposals don't count, so an untouched demo resets with no confirmation (e2e check).
- **Export / Delete (Tier 2):** cover every key and the photo store for your own log, which is every item in `prd.md > Privacy Panel`. The bridge also holds connector data on this device, so:
  - **Export** adds any pending bridge items (`GET /proposals`, `GET /research`);
  - **Delete**, with the bridge running, calls `DELETE /snapshot`, `DELETE /proposals` and `DELETE /research`. With the bridge down it says "Claude connector data will be cleared next time HowSure starts", sets `settings.pendingBridgeClear`, and clears on the next successful poll;
  - the Privacy Panel e2e covers both.

PRD ref: `prd.md > Saving`, `prd.md > Demo and My Log`, `prd.md > Privacy Panel`.

### Clock
`src/clock.ts`.
- `now()` returns real time for your own log.
- For the demo: `demoEpochFixture + (Date.now() − demoEpochReal)`, with both values stored in the demo document's `clock`. A reload keeps the timeline continuous, and Reset demo restarts it at the fixture's Thu 2026-10-22 01:30.
- **Advancing the demo:** saving a sleep or wake time later than the demo's now re-anchors the clock at that time (`demoEpochFixture` = that time, `demoEpochReal` = `Date.now()`). So the presenter can set **I'm going to sleep** to 04:40 and **I woke up** to 13:10, and the dashboard shows the new, empty day. Your own log rejects future times inline instead. An e2e test runs the demo sleep → wake path with edited times.
- **Time zones:** fixture times are wall-clock strings with no offset (e.g. `"2026-10-21T13:20:00"`), which ECMAScript parses as local time. On demo start and Reset demo they're converted to full ISO strings with the local offset, the format your own log stores. Day labels use local getters. Tests pin `America/Toronto` (`## Where It Runs and How Someone Tries It`).
- Playwright tests use `page.clock` for fixed times.

PRD ref: `prd.md > First Open`.

### Demo Fixture
`fixtures/demo-week.json`: the fictional person "Sam", fixed gamer tag "CalmLentil#3108", target 2,400 kcal and 130 g protein, labelled fictional. It covers seven waking days, Thu 2026-10-15 to Wed 2026-10-21, and the demo clock starts at Thu 2026-10-22 01:30, awake.

**Wednesday** (wake Wed 13:20, after sleeping from Wed 04:35):

| Time | Meal | Source | kcal | P / C / F (g) | Foods listed |
|---|---|---|---|---|---|
| Wed 13:50 | Kefir with oats and blueberries | label | 410 | 20 / 62 / 9 | kefir 6 oz, rolled oats, blueberries |
| Wed 17:30 | Pasta bake (ready meal) | photo | 760 | 34 / 84 / 30 | none (its note is below) |
| Wed 21:10 | Chicken, rice and broccoli | weighed | 480 | 44 / 50 / 10 | chicken breast, white rice, broccoli |
| Wed 23:15 | Lentil soup from the café | menu | 330 | 18 / 46 / 8 | lentils, onion, carrot |
| Thu 00:40 | Apple and peanut butter | description | 300 | 8 / 30 / 17 | apple, peanut butter |

- **The photo meal's note:** "Label on the box (whole package): 860 kcal, protein 42 g, carbs 96 g, fat 33 g." It isn't filled in automatically. The dashboard values before and after Improve are G11 and G11b.
- **Earlier days:** Sat 2026-10-17 has nothing logged. Fri 2026-10-16 has one meal with unknown calories, so the week shows an incomplete day. The others have 2–4 meals in mixed sources, most with foods listed. Mon 2026-10-19 has a workout: "Brisk walk", 45 min, 210 kcal, `burn_device`. Tue 2026-10-20 has one meal from the saved barcode lookup (amount: whole package).
- **Sleep:** wakes fall between 13:00 and 13:30 and sleep starts between 04:00 and 05:00. The record ending with Tue's wake (13:05) has no sleep start, so the sleep section reads "6 of 7 nights".
- **Plates:** "Blue dinner plate", 212 g.
- **`fixtures/off-cache.json`:** `{ credit, items: { [barcode]: { fetchedAt, response } } }`, where `response` is the verbatim Open Food Facts JSON (never edited) and `credit` is the ODbL line from `### Lookups`. `npm run check:demo-lookup` (`scripts/check-demo-lookup.mjs`, offline) prints each `product_name` with its `brands`, and fails if the name is empty or contains a brand token. Recording waits until it passes.

PRD ref: `prd.md > First Open`.

### Screens
`src/ui/`. Views switch on state, with no router. Every user-visible string comes from `src/ui/copy.ts` (study titles from `sources.ts`).
- **`App.tsx`:** chooses the first-open screen or the dashboard, and holds the active log, viewed day and open sheet. While the demo log is active, it renders a persistent banner, **"Sample person — fictional"**, above every view and inside every sheet header. An e2e test opens each view and sheet in demo mode and checks the text is visible.
- **`Dashboard.tsx`:** the layout in `prd.md > Screens and Layout`, items 1–10.
  - The guest name opens **Profile and privacy**.
  - The header switch: in the demo, its action reads **Start empty** when `howsure.mine.v1` has no meals, sleeps or workouts, and **Open my log** otherwise; in your own log it reads **Try the fictional demo**. **Reset demo** sits next to it inside the demo. e2e checks the label both ways.
  - `MacroRow` renders `macroTotals()`.
  - The biggest-uncertainty line and **Improve that entry** follow `improve()`.
  - **Week** sits next to previous/next.
- **`HeadlineEstimate.tsx`:** the calorie or net headline, both ranges, and the score button.
- **`MealList.tsx`**, **`MealDetails.tsx`** (what would improve it, or "No better source in HowSure.").
- **`LogMealSheet.tsx`:** also edit and improve, with the photo-estimate hint under **How do you know?**, and **Look up a barcode**, **Use a saved plate** and **Foods in this meal** (Tier 2).
- **`ExplainSheet.tsx`:** modes for meal score, day score, ranges and net (Tier 2), each with More detail.
- **`SleepSection.tsx`**, **`SleepEditor.tsx`**.
- **`WeekView.tsx`** (Tier 2): SVG bars with range whiskers, a sleep row and the gut meters.
- **`WorkoutSheet.tsx`**, **`WorkoutList.tsx`** (Tier 2). The list header shows burned's ranges and score from `net.combine()`.
- **`ProfilePrivacy.tsx`** (Tier 2):
  - the guest name labelled "Guest: saved on this device only", with Reroll and Rename;
  - plates;
  - "Saved on this device only";
  - "Sent off this device: N lookups", by kind (barcodes, and food searches once built);
  - the Claude connector switch with the bridge's status ("Claude connector not running", rechecked every 10 s), what Claude can read (the viewed day's meals and totals, the plates), that this goes to your own Claude account, and that Claude can only propose meals (and save food research, once built);
  - Export, Delete (with confirmation), and Reset demo.
- **`FromClaudeInbox.tsx`** (Tier 2): rendered only when there is at least one proposal. An e2e check under `npm run dev:app` confirms no From Claude section exists.
- **`GutPanel.tsx`** (Tier 2).
- **Copy checks:** `src/ui/__tests__/copy.test.ts` checks `copy.ts`:
  - "accuracy" appears only inside study titles;
  - there is no "for sure", and "guarantee" appears only negated ("not a guarantee", "not a guaranteed minimum and maximum");
  - gut-score text contains neither "accuracy" nor "gut health";
  - HowSure's own Research text never says "safe", "toxic" or "harmful".

  `tests/e2e/copy-sweep.spec.ts` collects `document.body.innerText` on every view and sheet and applies the same rules.

Tier 3 screens (`Timeline3Day.tsx`, `RoomLeft.tsx`, `WeightLog.tsx`, `SecondProfile.tsx`, `GymLog.tsx`, `Groups*.tsx`, `ResearchSection.tsx`, `Runs.tsx`, and so on) are added when their slice is reached; each is reached from the dashboard's **More** menu.

### Lookups
Barcode lookup: Tier 2. Food search: Tier 3. `src/lookups/openFoodFacts.ts`, `src/lookups/cache.ts`.
- **Request:** `GET https://world.openfoodfacts.org/api/v2/product/{barcode}.json?fields=product_name,brands,nutriments,serving_size,nova_group`, with header `X-User-Agent: HowSure/0.1 (+https://github.com/<repo>)`, which is in Open Food Facts' observed CORS allow-list. `User-Agent` is set to the same value as an extra attempt, because Chrome keeps its own. It never includes an email address. The one live-lookup Playwright test checks that `request.headers()['x-user-agent']` matches `/^HowSure\/\d/` and contains no `@`.
- **Reads** `nutriments['energy-kcal_100g']`, `proteins_100g`, `carbohydrates_100g`, `fat_100g`, `fiber_100g`, `sodium_100g`, and `sugars_100g` (Tier 3).
- **Amount eaten:** weighed (in grams, for example through a saved plate), the whole package, or an estimated portion in grams. It is saved in `lookup.amount` and sets the typical error (`### Maths Core: Sources Table`).
- **Limit:** 15 product reads per minute per IP. Search-as-you-type is never used.
- **Credit:** "Data: Open Food Facts contributors (openfoodfacts.org), Open Database License (ODbL). Not checked by HowSure.", linking https://world.openfoodfacts.org and https://opendatacommons.org/licenses/odbl/.
- **Cache:** results are cached per barcode in the active document with their fetch date, and `sentCount.barcode` goes up only on a live call. A saved result says "Saved lookup, fetched [date]". The demo carries a cached product (`fixtures/off-cache.json`).
- **Food search (Tier 3):** `GET https://api.nal.usda.gov/fdc/v1/foods/search?query=…&pageSize=5&api_key=…`, where the key comes from `VITE_USDA_KEY` in `.env.local`. It is used in local runs only, and the public demo uses saved results. Each live search adds 1 to `sentCount.foodSearch`. Credit: "USDA FoodData Central".

PRD ref: `prd.md > Barcode Lookup (Live)`, `prd.md > Food Search`.

### Claude Connector: Bridge
**Tier 2.** `connector/bridge.mjs`. Node's built-in `http` module on `127.0.0.1:5274` (`HOWSURE_BRIDGE_PORT` overrides it). On `EADDRINUSE` it exits with "Port [port] is in use". Its files live in `HOWSURE_DATA_DIR`, which defaults to the `connector/` folder resolved from `import.meta.url`, so any working directory works. Connector code never writes to stdout; it logs with `console.error`.
- **Who can call it:**
  - A random token is created on first run and stored in `<data dir>/.token`, which is gitignored. The MCP server reads it on every call.
  - The app gets `{ token, bridgeUrl }` from `GET /__howsure/token`, a dev-server-only middleware in `vite.config.ts` that reads the same environment variables. It returns 403 unless `sec-fetch-site` is `same-origin`, because Vite's default CORS lets any local dev page read it otherwise. (Vite's host check already runs before plugin middleware.)
  - `OPTIONS` (the browser's preflight) gets 204 with no token. `Access-Control-Allow-Origin` is echoed only for `http://127.0.0.1:5273` and `http://localhost:5273`, with `Access-Control-Allow-Methods: GET, POST, PUT, DELETE`, `Access-Control-Allow-Headers: Content-Type, X-HowSure-Token` and `Vary: Origin`.
  - Every other request needs the `X-HowSure-Token` header, compared with `crypto.timingSafeEqual`; a missing or wrong token gets 401. If an `Origin` header is present it must be allow-listed (403 otherwise); with no `Origin` (the MCP server), the token alone is enough. Any `Host` other than `127.0.0.1:<port>` or `localhost:<port>` is refused.
- **Endpoints:**
  - `POST /proposals`, `GET /proposals`, `DELETE /proposals/:id`, `DELETE /proposals` (clear all);
  - `PUT /snapshot`, `GET /snapshot`, `DELETE /snapshot`;
  - `POST /research`, `GET /research`, `DELETE /research` (clear all).
- **The snapshot and the switch:** the app sends `PUT /snapshot { enabled: true, day, plates }` while the switch is on and the viewed day or plates change, and `PUT /snapshot { enabled: false }` (day and plates removed) when it's turned off. The bridge keeps the snapshot in memory only, so a restart starts with none. With no snapshot, or `enabled: false`, `POST /proposals` and `POST /research` return 403 "connector is off", and every tool answers as off. (A staleness timeout isn't used: during the recorded demo, HowSure's tab sits behind Claude Desktop and stops polling.)
- **State:** pending proposals and research live in `<data dir>/data.json` (gitignored), and every body is validated with the shared `zod` schemas in `shared/connector-schema.mjs`. The app copies a proposal only if its id isn't already in the document, then sends `DELETE /proposals/:id`.
- **Which log receives proposals:** whichever log is active when the app picks them up. The inbox says "Adding to: your log" or "Adding to: demo person".
- **Connector tests:** the preflight passes, a wrong `Origin` is refused, a missing token gets 401, and an MCP-style request with no `Origin` succeeds.

PRD ref: `prd.md > Claude Connector: Photo and Voice Logging`.

### Claude Connector: MCP Server
**Tier 2.** Two files, built with `@modelcontextprotocol/sdk`:
- `connector/tools.mjs` exports the tool handlers and `zod` shapes and takes `{ bridgeUrl, tokenPath }`, so tests import it without starting stdio.
- `connector/mcp-server.mjs` only bootstraps. It imports `McpServer` from `'@modelcontextprotocol/sdk/server/mcp.js'` and `StdioServerTransport` from `'@modelcontextprotocol/sdk/server/stdio.js'`, creates `new McpServer({ name: 'howsure', version: '0.1.0' }, { instructions })`, calls `server.registerTool(name, { title, description, inputSchema }, handler)` for each tool, then `await server.connect(new StdioServerTransport())`. It never writes to stdout, which would corrupt the JSON-RPC messages (MCP build-server guide). It finds the token with `fileURLToPath(new URL('./.token', import.meta.url))` (or `HOWSURE_DATA_DIR`) and reads it on every call, so a server Claude started before the bridge recovers.

Tools:
- **`propose_meal`**:
  - `{ name, eatenAt (ISO), kcal?, protein?, carbs?, fat?, source: 'photo'|'description'|'menu'|'label'|'weighed', guess: string (non-empty), place?: string, assumptions?: string, link?: url, plateName?: string, scaleReadingG?: number, kcalPer100?: number }`;
  - refines in `shared/connector-schema.mjs`, each naming the missing field:
    - `weighed` requires `plateName`, `scaleReadingG` and `kcalPer100`, and ignores `kcal`: HowSure computes it through `plates.ts`. On **Add**, an unknown `plateName` shows a plain error;
    - `menu` or `label` requires `link`; otherwise it's rejected with "menu and label proposals need the page link";
  - its tool description carries the critical rules, because every client sends tool descriptions to the model: "Call get_day first so nothing is counted twice. State your guess of the food and the place. Use source 'menu' or 'label' only with a link to that page. This is an estimate, never certain.";
  - it posts to the bridge and returns "Proposed: waiting for you to add it in HowSure."
- **`list_plates`**: returns `[{name, grams}]` from the snapshot.
- **`get_day`**: returns the snapshot's viewed day (meals, totals, ranges).
- **`save_food_research`** (Tier 3):
  - `{ food, findings: [{ claim, grade: 'systematic review'|'randomized trial'|'observational'|'regulator'|'no good evidence found', source: {title, url}, checked: ISO date }], fiberTypes?: [...] }`;
  - it is rejected unless every finding has a `source.url`, naming each finding that lacks one.
- **When the connector switch is off** (no snapshot, or `enabled: false`), every tool returns "HowSure's Claude connector is off. Turn it on in HowSure's Profile and privacy."
- **When the bridge isn't running**, every tool returns "HowSure isn't running. Start it with npm run dev."
- Both replies are `{ content: [{ type: 'text', text }], isError: true }`.
- **Built-in instructions** (the server's `instructions` text): ask for one plate per photo with the food spread out and a zoomed-out shot; always state the guess of the food and the place; call `get_day` before proposing so nothing is counted twice; use `menu` or `label` only when citing a page; never claim certainty. Whether a client passes `instructions` to the model is up to the client (Claude Code does; Claude Desktop's behaviour isn't documented), so the critical rules are also in `propose_meal`'s description and schema. The README calls them guidance Claude is asked to follow, not a guarantee.
- **Tested without Claude** (`tests/connector/*.test.ts`): the handlers from `tools.mjs` are called directly against a bridge started on port 0 in a temp `HOWSURE_DATA_DIR`. Cases:
  - a photo proposal reaches `GET /proposals`;
  - a weighed proposal (212 g plate, 612 g reading, 165 kcal/100 g) passes the schema and resolves to 660 kcal through `plates.ts`;
  - a menu proposal without a link is rejected;
  - with the switch off, every tool returns the off message and `GET /proposals` stays empty;
  - the four access cases under `### Claude Connector: Bridge`.

### Groups Layer (Tier 3)
`src/social/backend.ts` defines the interface `{ listGroups, createGroup, invite, shareMeal, unshareMeal, feed, leaderboards }`. `src/social/localPreview.ts` implements it on the device, with fictional demo members from `fixtures/demo-group.json`, each labelled. Nothing calls the network; a Playwright test checks the network log. A future `supabaseBackend.ts` implements the same interface.

Leaderboards compute weekly:
- burned;
- best macros: the mean absolute % distance from the member's own targets, shown as "no targets set" when missing;
- consistency: days logged out of 7;
- "how sure": the mean day score.

PRD ref: `prd.md > Groups, Sharing and Leaderboards`.

### Other Tier 3 Pieces
- **Runs:** `src/lookups/gpx.ts` parses GPX in the browser with `DOMParser` into trackpoints `[{ lat, lon, time }]` (covered by e2e). `src/kernel/runs.ts` stays pure: haversine distance and pace from trackpoints, so G9 and a distance golden run in Node. Pace = min/km (golden G9: 5 km in 30 min is 6:00/km). The sample GPX file is generated, never a real run.
- **Room left:** `budget.ts`. Room left = target − the top of the very likely eaten range − (meals still to come × average per meal). Meals still to come = `profile.usualMealsPerDay` − meals logged this waking day, never below 0. Average per meal = the mean over known meals in the last 7 logged days, or `profile.avgPerMealOverride` if typed. Saved treats come from `profile.savedTreats`, and the optional sugar target from `profile.sugarTargetG`.
- **Weight:** `weight.ts`, a 7-day trailing mean over `weighIns`.
- **Nutrients from lookups:** `meals.nutrients` (`sugarG`, `sodiumMg`) from `sugars_100g` and `sodium_100g` × grams eaten; otherwise "unknown".
- **Processed-food share:** `nova.ts`. The NOVA group (`meals.nova`) comes from Open Food Facts' `nova_group` or the user's tag. Monteiro et al. 2019, *Public Health Nutr* 22(5):936–941, is re-checked in that slice.
- **Sweat sodium:** the source is re-checked in that slice (candidate: Sawka et al. 2007, ACSM position stand, *Med Sci Sports Exerc* 39(2):377–390). With no confirmed source, there's no note.
- **Sleep file import:** `src/kernel/sleepImport.ts` parses HowSure's documented format: a CSV with the header `sleepStart,wake` (wall-clock `YYYY-MM-DDTHH:MM`; either may be blank), or JSON `[{ "sleepStart": …, "wake": … }]`. The preview reuses `sleepday.ts` validation. The sample is `fixtures/sample-sleep.csv`, for the fictional person.
- **Second profile and carb budget:** `SecondProfile.tsx`, with kernel `carbs.ts` (carb room left only when every meal that day has known carbs) and the data `secondProfiles` and `readings`.
- **Gym log:** `GymLog.tsx`, with `workouts.split` and `workouts.sets` (`[{ weightKg, kind: 'warmup'|'working'|'drop' }]`).
- **3D:** CSS 3D transforms on the existing SVG charts, behind a toggle that is off by default. A library is used only if pinned when the slice starts.
- **Optional sign-up:** `@supabase/supabase-js`, pinned when that slice starts, gated on `VITE_SUPABASE_URL`.

## Data Model
One document per log (`howsure.demo.v1` and `howsure.mine.v1`). The `zod` schemas live in `src/store/schema.ts`, importing the proposal and meal-input schemas from `shared/connector-schema.mjs`.

| Data | Shape (key fields) | Updated by | When you leave and come back |
|---|---|---|---|
| profile | `{ name, kind: 'guest'\|'demo', targets?: {kcal, protein, carbs, fat}, usualDayHours?, usualMealsPerDay?, avgPerMealOverride?, savedTreats?: [{name, kcal}], sugarTargetG? }` (the last four Tier 3) | first use, Reroll/Rename, settings | read back from the sticky note |
| meals | `{ id, name, eatenAt, source, kcal: number\|null, protein/carbs/fat: number\|null, note?, foods?: [{ name, amount: number, unit: 'g'\|'oz'\|'serving', tagOverrides?: { add?: string[], remove?: string[] }, fiberPer100?: number }], fiberG?: number\|null, plate?: {name, grams, readingG, kcalPer100}, lookup?: { kind: 'barcode'\|'foodSearch', id, credit, fetchedAt, saved: boolean, amount: { kind: 'weighed'\|'package'\|'portion', grams } }, nutrients?: {sugarG, sodiumMg}, nova?, proposedBy?: 'claude', guess?, link?, photoId? }` (`foods`, `fiberG`, `lookup` Tier 2; `nutrients`, `nova`, `photoId` Tier 3) | Log, Edit, Improve, Delete, Add from inbox, gut breakdown tag edits | same |
| sleeps | `{ id, sleepStart: ISO\|null, wake: ISO\|null, tags?: [string] }` | sleep buttons, editor, import | same |
| workouts (Tier 2) | `{ id, name, startedAt, minutes, kcal, source, run?: {km, route?}, split?, sets?: [{weightKg, kind}] }` (`run`, `split`, `sets` Tier 3) | Log a workout, runs, gym log | same |
| plates (Tier 2) | `{ id, name, grams }` | Profile and privacy | same |
| lookups (Tier 2) | `{ [barcode]: {response, fetchedAt} }` and `sentCount: { barcode, foodSearch }` | barcode and food search | same |
| proposals (Tier 2) | inbox items copied from the bridge, deduplicated by id | inbox poll, Add or Dismiss | an added item becomes a meal; a dismissed one is deleted |
| research (Tier 3) | `{ [food]: {findings, savedAt} }` | `save_food_research` via the bridge | same |
| groups (Tier 3) | `{ groups, sharedMealIds, demoMembers }` | Groups screens | same (on the device only) |
| settings | `{ connectorOn (Tier 2), pendingBridgeClear? (Tier 2), weightUnit, … }` | Profile and privacy | same |
| clock | `{ demoEpochFixture, demoEpochReal }` (demo only) | demo start, sleep or wake times past the demo's now, Reset demo | the clock continues |
| weighIns (Tier 3) | `{ id, at, kg }` | Weight log | same |
| secondProfiles, readings (Tier 3) | `{ id, name, carbBudgetG }`; `{ id, profileId, at, kind: 'bp'\|'glucose', values }` | Second profile | same |

**Data flow:** typed input → `parse.ts` → `zod` → the store → pure kernel functions → screens. Lookups → cache → store. Claude → MCP server → bridge (`data.json`) → app poll → inbox → **Add** → store. The snapshot goes app → bridge memory → MCP server. Nothing is stored on any server.

## File Structure
```
food-log-how-sure/
├── devpost/                  # Devpost learning workspace: scope, prd, spec, checklist (learner-profile.md and ideas-verbatim.md are gitignored)
├── src/
│   ├── main.tsx              # React entry
│   ├── clock.ts              # real clock, and the demo clock that keeps running across reloads
│   ├── kernel/               # pure maths core, no React; every file has tests in kernel/__tests__/
│   │   ├── sources.ts        # the one sources table with study or "assumption" per row
│   │   ├── estimate.ts       # per-meal and per-day totals, two ranges, score, biggest contributor, improve(), macroTotals()
│   │   ├── net.ts            # net calories and its range, burned's score (Tier 2)
│   │   ├── sleepday.ts       # waking days, provisional day, validation, moved meals, night stats
│   │   ├── week.ts           # 7-day summary and averages (Tier 2)
│   │   ├── parse.ts          # "1,501" → 1501, blank → unknown
│   │   ├── plates.ts         # reading − plate → kcal, with the arithmetic line (Tier 2)
│   │   ├── gamertag.ts       # CalmLentil#3108-style names (Tier 2)
│   │   ├── words.ts          # curated adjective and noun lists (Tier 2)
│   │   ├── gut/              # digm.ts, plants.ts, fermented.ts, amounts.ts (Tier 2)
│   │   └── budget.ts, weight.ts, runs.ts, nova.ts, carbs.ts, sleepImport.ts   # Tier 3, added when reached
│   ├── store/                # schema.ts (zod), storage.ts (localStorage + IndexedDB photos)
│   ├── lookups/              # openFoodFacts.ts (Tier 2), cache.ts, usda.ts and gpx.ts (Tier 3)
│   ├── connector/            # inbox polling client for the bridge, browser side (Tier 2)
│   ├── social/               # backend.ts interface, localPreview.ts (Tier 3)
│   └── ui/                   # screens listed under Components; theme.css holds the tokens; copy.ts holds every user-visible string
│       └── __tests__/        # copy.test.ts (word rules), contrast.test.ts (WCAG ratios)
├── shared/                   # (Tier 2)
│   └── connector-schema.mjs  # zod schemas shared by app, bridge and MCP server
├── connector/                # (Tier 2)
│   ├── bridge.mjs            # local bridge on 127.0.0.1:5274 (token, CORS, snapshot in memory, data.json)
│   ├── tools.mjs             # tool handlers and zod shapes: propose_meal, list_plates, get_day, save_food_research
│   ├── mcp-server.mjs        # MCP stdio bootstrap only; never writes to stdout
│   └── README.md             # Claude Desktop and Claude Code setup
├── fixtures/
│   ├── demo-week.json        # fictional sample person "Sam", 7 waking days, labelled fictional (see Demo Fixture)
│   ├── foods.json            # ~150 foods with USDA FDC ids, servings, gut tags (Tier 2)
│   ├── off-cache.json        # verbatim Open Food Facts answer(s) with fetchedAt and the ODbL credit (Tier 2)
│   ├── demo-group.json       # fictional demo members (Tier 3)
│   ├── sample-sleep.csv      # fictional person's sleep file (Tier 3)
│   └── sample-route.gpx      # generated route (Tier 3)
├── tests/
│   ├── vitest.setup.ts       # pins TZ = America/Toronto
│   ├── e2e/                  # Playwright: one spec per PRD feature heading, plus copy-sweep.spec.ts
│   └── connector/            # tool handlers against a bridge on port 0 in a temp data dir (Tier 2)
├── demo/
│   ├── playwright.demo.config.ts  # testDir '.', 1920×1080 viewport and video, outputDir out/
│   └── record.spec.ts        # Playwright capture driver for the demo video
├── scripts/
│   ├── dev.mjs               # starts Vite + bridge with process.execPath, stops both on Ctrl+C
│   ├── golden.py             # independent Python generator for the golden values
│   └── check-demo-lookup.mjs # product_name vs brands check on off-cache.json
├── index.html
├── vite.config.ts            # React plugin, 127.0.0.1:5273 strictPort, /__howsure/token dev middleware
├── vitest.config.ts          # include src/**/__tests__ and tests/connector; setup file
├── playwright.config.ts      # testDir tests/e2e, channel 'chrome', webServer dev:app, 390x844 and 1920x1080 projects
├── tsconfig.json             # allowJs + checkJs, includes shared/ and connector/
├── package.json              # pinned versions above; scripts dev, dev:app, test, typecheck, e2e, demo:record, check:demo-lookup
├── README.md                 # what, try it in 60 seconds, Connect Claude, provenance, sources, roadmap
├── THIRD_PARTY_LICENSES.md   # Open Food Facts ODbL, USDA FDC CC0 credit
└── .gitignore                # see below
```

`.gitignore`, written in the first build slice before any `git add`: `node_modules/`, `dist/`, `test-results/`, `playwright-report/`, `demo/out/`, `connector/.token`, `connector/data.json`, `.env`, `.env.*`, `!.env.example`, `devpost/learner-profile.md`, `devpost/ideas-verbatim.md`.

## External Services and Dependencies
| Service | Call | Key | Limits and cost | Licence and credit | Docs |
|---|---|---|---|---|---|
| Open Food Facts (Tier 2) | `GET /api/v2/product/{code}.json?fields=…` | none; an `X-User-Agent` naming the app | 15 product reads per minute per IP; free | ODbL; "Open Food Facts contributors"; no accuracy promise | https://openfoodfacts.github.io/openfoodfacts-server/api/ |
| USDA FoodData Central (Tier 3; food list build) | `GET /fdc/v1/foods/search?query=&api_key=` | Ahmed's own free data.gov key, local runs only | 1,000 requests per hour per IP (DEMO_KEY 30/h, 50/day) | CC0; credit "USDA FoodData Central" | https://fdc.nal.usda.gov/api-guide/ |
| Claude (Ahmed's own account) (Tier 2) | Claude Desktop or Code launches `connector/mcp-server.mjs` over stdio | none in HowSure | the user's own Claude plan | photos and voice go to Claude under Claude's terms | https://modelcontextprotocol.io/docs |
| Supabase (Tier 3, optional) | `signInAnonymously`, `updateUser({email})` | publishable key in `.env.local`, created by Ahmed | free plan; 2 auth emails per hour | — | https://supabase.com/docs/guides/auth/auth-anonymous |

Nothing else goes over the network. The Playwright suite checks that the demo journey makes no requests beyond `127.0.0.1` and `localhost`, except the one live barcode test.

## Important Failure Modes
- **`localStorage` is full or blocked** → a banner, "Can't save on this device right now; your changes will be lost on reload. Export to keep them." The app keeps working in memory.
- **Open Food Facts is offline, rate-limited or the product isn't found** → a plain message, and manual entry stays open with everything typed so far kept. A cached answer is used when there is one.
- **The bridge isn't running, or the token doesn't match** → no From Claude section appears; the connector row in Profile and privacy says "Claude connector not running" (no error spam; it rechecks every 10 s). The connector tools answer "HowSure isn't running" with `isError: true`.
- **Port 5273 or 5274 is taken** → Vite (`strictPort`) or the bridge exits with a message naming the port, instead of moving to another one.
- **The known total is 0 kcal, or every meal is unknown** → the score and ranges say "Not available yet". There's never a division by zero.
- **A sleep correction would move meals** → the moved meals are named and confirmation is asked first, through `movedMeals()`.

## What Was Simplified and Why
- **`localStorage`** instead of a database: a single user on one device needs nothing more, and judges need no sign-in. The fuller version would be a hosted database with accounts (the groups layer is ready for it).
- **A local bridge** instead of a cloud relay: Claude's proposals only travel inside your computer. A cloud relay would need accounts and a server.
- **Hand-drawn SVG** instead of a chart library: there are only bars with range whiskers and a timeline, so there's one less dependency to learn and debug.
- **Fixed typical errors per source** instead of measured coverage: HowSure can't measure its own hit rate without reference meals, so ranges are labelled "design targets". The fuller version is a calibration run over reference meals (`research-verified`: split-conformal).
- **A linear spread per item (`x · e`) when combining**, with a lognormal shape for display: the standard simple approximation. The method and the golden values document it, so it can be swapped later.
- **The groups preview on the device**, with fictional members, instead of real groups: accounts and a database come later (Ahmed, 2026-10-26).

## Decisions and Open Issues
Decisions, all accepted by Ahmed on 2026-10-26 as recommended ("all three as recommended"):
1. **Stack:** React + TypeScript on Vite, `localStorage`, no server or keys for Tiers 1–2; a Claude connector made of an MCP stdio server plus a local bridge; Vitest and Playwright; local runs, the video and the public repo, no deployment. *Tradeoff accepted:* one extra process when using Claude.
2. **The numbers:**
   - his tracker's typical errors as starting values (disclosed, and re-checked in the build);
   - lognormal likely (≈8 in 10) and very likely (≈19 in 20) ranges;
   - same-source errors add, different sources partly cancel;
   - net combines eaten and burned as independent.
3. **Demo clock and day rules:**
   - the demo starts at Thu 01:30, before the sample person sleeps;
   - a waking day runs from one wake to the next;
   - there's no automatic split.

Implementation details derived from those choices (the agent's, not Ahmed's): the dev middleware for the token, ports 5273 and 5274, file names, the `zod` document shape, polling every 3 s while the app is open and visible, the improve rule, the demo clock advancing on sleep or wake times past its now, and the demo fixture's values.

**One useful unknown: how a day's uncertainty adds up** (`prd.md > Estimate Score and Explanations`). The question was whether errors from several meals cancel. It was clarified with a worked example: three 600 kcal photo meals give a day score of 54 if same-source errors add, and 73 if they're independent. Ahmed chose "same-source adds". The verified support: in Fridolfsson 2025, all three AI models underestimated more as portions grew, and O'Hara 2025 found ChatGPT underestimated meal weight for 76% of photos; trained human raters (Nicklas 2018) overestimated, so the direction depends on the method. The build checks the choice with golden tests G2 and G5, whose values were computed in Python separately from the app's code.

**Open, to settle during the build (none blocks approval):**
- **Needs Ahmed: Playwright's ffmpeg download for the demo video.** `demo:record` needs `npx playwright install ffmpeg` (about 1.66 MB, per the other entry's plan); Playwright's ffmpeg isn't installed on this computer. *Recommended default:* say yes when the demo-recording slice starts. If he says no, the fallback is CDP `Page.startScreencast` frames piped to the system ffmpeg (8.1.1, already installed).
- **The USDA FoodData Central bulk download** (Foundation Foods CSV, public domain) to build `fixtures/foods.json` needs Ahmed's OK. Without it, the build agent fills about 150 foods by hand from individual FDC web entries, each cited by its FDC id.
- **The sources re-check:** each "assumption" row becomes "study" only if the study's own figure supports it. The results are recorded in `sources.ts` and the README.
- **Sodium guideline:** body, year and value are re-checked in the `Nutrients From Lookups` slice. Until they're confirmed, no guideline line is shown (`prd.md`).
- **NOVA:** how Open Food Facts assigns `nova_group` (its documented ingredient and category rules) is re-checked in the `Processed-Food Share` slice. The label stays "NOVA group as estimated by Open Food Facts; not checked by HowSure".
- **`typescript@7.0.2` and `@modelcontextprotocol/sdk@1.32.2`:** if either misbehaves, fall back as noted under `## Stack` and record it here.
- **Carried from `prd.md > Open Questions`:** the two friends' suggestions (waiting on Ahmed; not blocking).
- **Fixture rule:** the demo person "Sam" is fictional, with a 2,400 kcal target and 130 g protein, waking around 1:00–1:30 PM and sleeping around 4–5 AM (`### Demo Fixture` has the values). These values were chosen to be unlike Ahmed's own. The private denylist (`.autopilot/private-denylist.txt`) currently has no terms, so the leak check can't confirm this until Ahmed fills it in.
