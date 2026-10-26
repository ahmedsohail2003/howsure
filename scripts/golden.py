"""Independent generator for HowSure's golden values (spec.md > Maths Core:
Estimates, Ranges and the Day). Standard library only. Never imported by the app.

It re-implements the day maths from the spec's words, not from the TypeScript:
  sd_i = x_i * e_i; within a source sd_g = sum(sd_i); sd_day = sqrt(sum(sd_g^2));
  e_day = sd_day / X; score = clamp(floor(100 * (1 - e) + 0.5), 0, 100);
  ranges are lognormal [X / (1+e)^z, X * (1+e)^z] with z80 = 1.2816, z95 = 1.96.

Run from the repo root:  python scripts/golden.py
Exit code 0 when every case matches the spec table within its tolerance
(+-1 kcal on rounded range ends, +-0.01 percentage points on e).
"""

import functools
import json
import math
import re
import sys
from datetime import datetime
from pathlib import Path

Z80 = 1.2816
Z95 = 1.96

# Typical errors from spec.md > Maths Core: Sources Table (meal sources).
ERR = {
    "weighed": 0.08,
    "label": 0.10,
    "label_lookup": 0.12,
    "menu": 0.21,
    "photo": 0.46,
    "description": 0.41,
    "food_db": 0.15,
}

FIXTURE = Path(__file__).resolve().parent.parent / "fixtures" / "demo-week.json"


def half_up(x):
    return math.floor(x + 0.5)


def score_of(e):
    return min(100, max(0, half_up(100 * (1 - e))))


def lognormal(x, e, z):
    f = (1 + e) ** z
    return (x / f, x * f)


def meal(mid, source, kcal, at="2026-10-21T12:00:00-04:00", name=None):
    return {"id": mid, "name": name or mid, "source": source, "kcal": kcal, "at": at}


def day(meals):
    known = [m for m in meals if m["kcal"] is not None]
    total = sum(m["kcal"] for m in known)
    sd_g = {}
    for m in known:
        sd_g[m["source"]] = sd_g.get(m["source"], 0.0) + m["kcal"] * ERR[m["source"]]
    var = sum(v * v for v in sd_g.values())
    sd = math.sqrt(var)
    e = sd / total if total > 0 else None

    ranked = []
    for m in known:
        sd_i = m["kcal"] * ERR[m["source"]]
        share = sd_g[m["source"]] * sd_i / var if var > 0 else 0.0
        ranked.append((share, m))

    def cmp(a, b):
        (sa, ma), (sb, mb) = a, b
        if abs(sa - sb) > 1e-12:
            return -1 if sa > sb else 1
        if ma["kcal"] != mb["kcal"]:
            return -1 if ma["kcal"] > mb["kcal"] else 1
        ta, tb = datetime.fromisoformat(ma["at"]), datetime.fromisoformat(mb["at"])
        if ta != tb:
            return -1 if ta < tb else 1
        return -1 if ma["id"] < mb["id"] else (1 if ma["id"] > mb["id"] else 0)

    ranked.sort(key=functools.cmp_to_key(cmp))
    out = {"total": total, "e": e, "sd": sd, "biggest": ranked[0][1] if ranked else None}
    if e is not None:
        out["score"] = score_of(e)
        out["likely"] = lognormal(total, e, Z80)
        out["very"] = lognormal(total, e, Z95)
    return out


def suggest(source):
    """label if lower than the meal's error, else the lowest-error source if lower, else None."""
    current = ERR[source]
    if ERR["label"] < current:
        return "label"
    best = min(ERR, key=lambda k: ERR[k])
    return best if ERR[best] < current else None


def with_source(meals, mid, source, kcal=None):
    return [
        dict(m, source=source, kcal=(m["kcal"] if kcal is None else kcal)) if m["id"] == mid else m
        for m in meals
    ]


def wednesday_from_fixture():
    data = json.loads(FIXTURE.read_text(encoding="utf-8"))
    now = datetime.fromisoformat(data["clock"]["start"])
    wakes = sorted(datetime.fromisoformat(s["wake"]) for s in data["sleeps"] if s["wake"])
    start = max(w for w in wakes if w <= now)
    later = [w for w in wakes if w > start]
    end = later[0] if later else None
    meals = []
    for m in data["meals"]:
        t = datetime.fromisoformat(m["eatenAt"])
        if t >= start and (end is None or t < end):
            meals.append(
                {"id": m["id"], "name": m["name"], "source": m["source"], "kcal": m["kcal"],
                 "at": m["eatenAt"], "note": m.get("note", "")}
            )
    return start, meals


FAILS = []


def check(case, got, expected):
    """expected: dict with optional total, e (percent), score, likely, very, biggest."""
    bad = []
    if "total" in expected and got["total"] != expected["total"]:
        bad.append(f"total {got['total']} != {expected['total']}")
    if "e" in expected and abs(got["e"] * 100 - expected["e"]) > 0.01 + 1e-9:
        bad.append(f"e {got['e'] * 100:.4f}% != {expected['e']}%")
    if "score" in expected and got["score"] != expected["score"]:
        bad.append(f"score {got['score']} != {expected['score']}")
    for key in ("likely", "very"):
        if key in expected:
            lo, hi = (half_up(v) for v in got[key])
            elo, ehi = expected[key]
            if abs(lo - elo) > 1 or abs(hi - ehi) > 1:
                bad.append(f"{key} {lo}-{hi} != {elo}-{ehi}")
    if "biggest" in expected and got["biggest"]["name"] != expected["biggest"]:
        bad.append(f"biggest {got['biggest']['name']} != {expected['biggest']}")
    if bad:
        FAILS.append((case, bad))
    return "OK" if not bad else "MISMATCH: " + "; ".join(bad)


def show(case, label, got, extra="", expected=None):
    parts = [f"total {got['total']}", f"e {got['e'] * 100:.2f}% ({got['e'] * 100:.4f})"]
    parts.append(f"score {got['score']}")
    parts.append("likely {}-{}".format(*(half_up(v) for v in got["likely"])))
    parts.append("very likely {}-{}".format(*(half_up(v) for v in got["very"])))
    if got["biggest"] is not None:
        parts.append(f"biggest {got['biggest']['name']}")
    status = check(case, got, expected) if expected else ""
    print(f"{case:<5} {label}")
    print(f"      {', '.join(parts)}{extra}")
    if status:
        print(f"      vs spec table: {status}")


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(errors="replace")  # meal names like "café" on any console
    # G1: one label meal, 500 kcal; improve suggests weighed.
    g1 = [meal("g1", "label", 500)]
    show("G1", "one label meal, 500 kcal", day(g1),
         expected={"e": 10.0, "score": 90, "likely": (443, 565), "very": (415, 603)})
    to = suggest("label")
    g1b = day(with_source(g1, "g1", to))
    show("G1+", f"after improve -> {to} (meal e {ERR[to] * 100:.0f}%)", g1b,
         expected={"e": 8.0, "score": 92, "likely": (453, 552), "very": (430, 581)})
    if to != "weighed":
        FAILS.append(("G1+", [f"improve suggested {to}, expected weighed"]))

    # G2: three photo meals, 600 kcal each; tie-break names the earliest.
    g2 = [
        meal("c", "photo", 600, "2026-10-21T08:00:00-04:00", "earliest"),
        meal("a", "photo", 600, "2026-10-21T12:00:00-04:00", "middle"),
        meal("b", "photo", 600, "2026-10-21T18:00:00-04:00", "latest"),
    ]
    show("G2", "three photo meals, 600 kcal each", day(g2),
         expected={"total": 1800, "e": 46.0, "score": 54, "likely": (1108, 2924),
                   "very": (857, 3779), "biggest": "earliest"})

    # G3: photo, description and menu, 600 kcal each.
    g3 = [meal("p", "photo", 600), meal("d", "description", 600), meal("m", "menu", 600)]
    show("G3", "photo + description + menu, 600 kcal each", day(g3),
         expected={"e": 21.70, "score": 78, "likely": (1399, 2315), "very": (1225, 2645)})

    # G4: 1000 kcal photo + 3 x 100 kcal label; G4b improves the photo meal to label.
    g4 = [meal("photo", "photo", 1000, name="the photo meal"),
          meal("l1", "label", 100), meal("l2", "label", 100), meal("l3", "label", 100)]
    show("G4", "1000 kcal photo + 3 x 100 kcal label", day(g4),
         expected={"total": 1300, "e": 35.46, "score": 65, "likely": (881, 1918),
                   "very": (717, 2357), "biggest": "the photo meal"})
    to4 = suggest("photo")
    show("G4b", f"G4 after improving the photo meal -> {to4}", day(with_source(g4, "photo", to4)),
         expected={"e": 10.0, "score": 90, "likely": (1151, 1469), "very": (1078, 1567)})

    # G5: three photo meals treated as independent (documentation only).
    x = 1800
    sd_ind = math.sqrt(sum((600 * ERR["photo"]) ** 2 for _ in range(3)))
    e5 = sd_ind / x
    ok5 = abs(e5 * 100 - 26.56) <= 0.01 + 1e-9 and score_of(e5) == 73
    if not ok5:
        FAILS.append(("G5", [f"e {e5 * 100:.4f} score {score_of(e5)}"]))
    print("G5    three photo meals if treated as independent (documentation only)")
    print(f"      e {e5 * 100:.2f}% ({e5 * 100:.4f}), score {score_of(e5)}"
          f"  [same-source method gives 46.00%, score 54]")
    print(f"      vs spec table: {'OK' if ok5 else 'MISMATCH'}")

    # G11: the demo's Wednesday from fixtures/demo-week.json.
    start, wed = wednesday_from_fixture()
    print(f"G11   read {len(wed)} meals from {FIXTURE.name}, waking day from {start.isoformat()}")
    for m in wed:
        print(f"        {m['at']}  {m['source']:<12} {m['kcal']:>5}  {m['name']}")
    g11 = day(wed)
    sug = suggest(g11["biggest"]["source"])
    show("G11", "the demo's Wednesday, before Improve", g11, extra=f", improve suggests {sug}",
         expected={"total": 2280, "e": 16.72, "score": 83, "likely": (1870, 2780),
                   "very": (1684, 3087), "biggest": "Pasta bake (ready meal)"})
    if sug != "label":
        FAILS.append(("G11", [f"improve suggested {sug}, expected label"]))

    # G11b: re-log the pasta bake from its note (label, kcal read from the note).
    pasta = next(m for m in wed if m["name"] == "Pasta bake (ready meal)")
    found = re.search(r"(\d+)\s*kcal", pasta["note"])
    label_kcal = int(found.group(1)) if found else None
    g11b = day(with_source(wed, pasta["id"], "label", label_kcal))
    show("G11b", f"after re-logging the pasta bake as label, {label_kcal} kcal (from its note)", g11b,
         extra=f" ({g11b['biggest']['source']})",
         expected={"total": 2380, "e": 8.14, "score": 92, "likely": (2153, 2631),
                   "very": (2042, 2775), "biggest": "Apple and peanut butter"})

    # G12: weighed 700 + label 150; biggest is weighed, so improve is None.
    g12 = [meal("w", "weighed", 700, name="the weighed meal"), meal("l", "label", 150)]
    r12 = day(g12)
    sug12 = suggest(r12["biggest"]["source"])
    show("G12", "weighed 700 kcal + label 150 kcal", r12, extra=f", improve -> {sug12}",
         expected={"e": 6.82, "score": 93, "likely": (781, 925), "very": (747, 967),
                   "biggest": "the weighed meal"})
    if sug12 is not None:
        FAILS.append(("G12", [f"improve suggested {sug12}, expected None"]))

    print()
    if FAILS:
        print(f"{len(FAILS)} case(s) differ from the spec table:")
        for case, bad in FAILS:
            print(f"  {case}: {'; '.join(bad)}")
        return 1
    print("All golden cases match the spec table (G1, G1 improve, G2, G3, G4, G4b, G5, G11, G11b, G12).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
