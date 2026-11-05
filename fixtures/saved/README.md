# Saved-log fixtures (frozen)

Log documents as HowSure saves them, one pair per format version. The person is the fictional Sam; nothing here is a real meal, weight, sleep time or target.

- `v1-demo.json`: the demo as version 1 saves it. Derived from `fixtures/demo-week.json` by hand rules, not by running the app: every wall-clock time gets Toronto's October offset, `-04:00`, and the clock is anchored at Thu 2026-10-22 01:30 local.
- `v1-mine.json`: an own log with the edge cases: unknown calories with and without a source, a typed 0, other time zone offsets, a sleep with no start, and keys version 1 doesn't use yet, at every level.

Rules (checked by `src/store/__tests__/migrations.test.ts`):

1. A fixture is never edited after it is committed. Its SHA-256 is listed in that test's `FROZEN`.
2. Bumping `SCHEMA_VERSION` needs `vN-demo.json` and `vN-mine.json` for the new version: the previous version's pair rewritten by hand in the new format, with nothing lost. It also needs the upgrade step `MIGRATIONS[N-1]` in `src/store/migrations.ts`.
3. Every fixture must load into the current version equal to the newest pair, and save back unchanged.
