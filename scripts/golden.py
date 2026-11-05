"""Independent generator for HowSure's golden values (spec.md > Maths Core).
Standard library only. Never imported by the app.

It re-implements the maths from the spec's words, not from the TypeScript:
  sd_i = x_i * e_i; within a source sd_g = sum(sd_i); sd_day = sqrt(sum(sd_g^2));
  e_day = sd_day / X; score = clamp(floor(100 * (1 - e) + 0.5), 0, 100);
  ranges are lognormal [X / (1+e)^z, X * (1+e)^z] with z80 = 1.2816, z95 = 1.96.

Cases G1-G5, G11 and G12 (Estimates, Ranges and the Day) are asserted by
src/kernel/__tests__/golden.test.ts. Cases G6 (Net Calories), G7 (Plates),
G9 (runs, Other Tier 3 Pieces) and G10 (Week Summary) belong to kernels that are
not built yet; this script computes them from the spec's formulas and writes
them to fixtures/golden.json, which the future tests read
(src/kernel/__tests__/golden-later.test.ts lists them as pending until then).

Run from the repo root:
  python3 scripts/golden.py          check every case against the spec, and check
                                     that fixtures/golden.json is up to date
  python3 scripts/golden.py --write  the same, then rewrite fixtures/golden.json
Exit code 0 when every case matches the spec within its tolerance
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
    # Burn sources (spec.md > Maths Core: Sources Table, Tier 2 rows).
    "burn_device": 0.40,
    "burn_machine": 0.30,
    "burn_guess": 0.50,
}

ROOT = Path(__file__).resolve().parent.parent
FIXTURE = ROOT / "fixtures" / "demo-week.json"
GOLDEN_JSON = ROOT / "fixtures" / "golden.json"

# Mean Earth radius for the haversine distance golden (G9b). The spec names haversine
# but no radius; 6371 km is the usual mean radius, recorded in golden.json so the
# future runs.ts uses the same one.
EARTH_RADIUS_KM = 6371.0


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


# ---------- G6, G7, G9, G10: kernels still to be built ----------

def grouped_sd(items):
    """Same-source spreads added straight, sources combined by root sum of squares."""
    sd_g = {}
    for it in items:
        if it["kcal"] is None or it["source"] is None:
            continue
        sd_g[it["source"]] = sd_g.get(it["source"], 0.0) + it["kcal"] * ERR[it["source"]]
    return math.sqrt(sum(v * v for v in sd_g.values()))


def r4(x):
    return round(x, 4)


def g6_net():
    """spec.md > Maths Core: Net Calories. N = X - B; sd_N = sqrt(sd_eaten^2 + sd_burned^2);
    normal ranges N +- z * sd_N. Burned keeps its own score and lognormal ranges."""
    eaten = [
        {"id": "g6-breakfast", "name": "Breakfast", "source": "photo", "kcal": 600,
         "eatenAt": "2026-10-21T08:00:00-04:00"},
        {"id": "g6-lunch", "name": "Lunch", "source": "photo", "kcal": 600,
         "eatenAt": "2026-10-21T12:00:00-04:00"},
        {"id": "g6-dinner", "name": "Dinner", "source": "photo", "kcal": 600,
         "eatenAt": "2026-10-21T18:00:00-04:00"},
    ]
    burned = [
        {"id": "g6-walk", "name": "Walk", "source": "burn_device", "kcal": 300,
         "at": "2026-10-21T17:00:00-04:00"},
    ]
    x = sum(m["kcal"] for m in eaten)
    b = sum(w["kcal"] for w in burned)
    sd_x = grouped_sd(eaten)
    sd_b = grouped_sd(burned)
    n = x - b
    sd_n = math.sqrt(sd_x ** 2 + sd_b ** 2)
    e_b = sd_b / b
    return {
        "input": {"eaten": eaten, "burned": burned},
        "expected": {
            "eaten": {"total": x, "sd": r4(sd_x)},
            "burned": {
                "total": b, "sd": r4(sd_b), "ePercent": r4(e_b * 100), "score": score_of(e_b),
                "likely": [half_up(v) for v in lognormal(b, e_b, Z80)],
                "veryLikely": [half_up(v) for v in lognormal(b, e_b, Z95)],
            },
            "net": {
                "total": n, "sd": r4(sd_n),
                "likely": [half_up(n - Z80 * sd_n), half_up(n + Z80 * sd_n)],
                "veryLikely": [half_up(n - Z95 * sd_n), half_up(n + Z95 * sd_n)],
                "score": None,
            },
        },
    }


def g7_plates():
    """spec.md > Maths Core: Plates. foodGrams = reading - plate (an error at or below the
    plate); kcal = foodGrams * kcalPer100 / 100."""
    def weigh(reading, plate, per100):
        if reading <= plate:
            return {"error": "reading at or below the plate"}
        grams = reading - plate
        kcal = grams * per100 / 100
        return {"foodGrams": grams, "kcal": int(kcal) if kcal == int(kcal) else kcal}

    main = {"readingG": 612, "plateG": 212, "kcalPer100": 165, "plateName": "Blue dinner plate"}
    got = weigh(main["readingG"], main["plateG"], main["kcalPer100"])
    errors = [{"readingG": 212, "plateG": 212, "kcalPer100": 165},
              {"readingG": 150, "plateG": 212, "kcalPer100": 165}]
    for case in errors:
        case["expected"] = weigh(case["readingG"], case["plateG"], case["kcalPer100"])
    return {"input": main, "expected": got, "errorCases": errors}


def haversine_km(a, b):
    lat1, lon1, lat2, lon2 = (math.radians(v) for v in (a["lat"], a["lon"], b["lat"], b["lon"]))
    h = (math.sin((lat2 - lat1) / 2) ** 2
         + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2)
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(h))


def pace_text(seconds_per_km):
    s = half_up(seconds_per_km)
    return f"{s // 60}:{s % 60:02d}/km"


def g9_runs():
    """spec.md > Other Tier 3 Pieces (Runs): pace = min/km; haversine distance from trackpoints.
    The route is made up: points on the equator, in open sea, never a real run."""
    paces = []
    for km, minutes in ((5, 30), (10, 52.5)):
        spk = minutes * 60 / km
        paces.append({"distanceKm": km, "durationMin": minutes,
                      "secondsPerKm": spk, "text": pace_text(spk)})
    track = [
        {"lat": 0.0, "lon": 0.0, "time": "2026-10-20T07:00:00Z"},
        {"lat": 0.0, "lon": 0.01, "time": "2026-10-20T07:06:00Z"},
        {"lat": 0.01, "lon": 0.01, "time": "2026-10-20T07:12:00Z"},
        {"lat": 0.02, "lon": 0.02, "time": "2026-10-20T07:21:00Z"},
    ]
    legs = [haversine_km(track[i], track[i + 1]) for i in range(len(track) - 1)]
    return {
        "pace": paces,
        "distance": {
            "earthRadiusKm": EARTH_RADIUS_KM,
            "trackpoints": track,
            "expected": {"legsKm": [round(v, 6) for v in legs], "totalKm": round(sum(legs), 6)},
            "toleranceKm": 0.001,
        },
    }


def g10_week():
    """spec.md > Maths Core: Week Summary. Complete days only; every meal of those days grouped
    by source across the week; avg = X_total / N, sd_avg = sd_total / N, e = sd_avg / avg;
    lognormal ranges like a day."""
    g4 = [{"source": "photo", "kcal": 1000}, {"source": "label", "kcal": 100},
          {"source": "label", "kcal": 100}, {"source": "label", "kcal": 100}]
    g3 = [{"source": "photo", "kcal": 600}, {"source": "description", "kcal": 600},
          {"source": "menu", "kcal": 600}]
    incomplete = [{"source": "label", "kcal": 400}, {"source": "photo", "kcal": None}]
    days = [
        {"name": "Mon", "meals": g4},
        {"name": "Tue", "meals": g3},
        {"name": "Wed", "meals": incomplete},
    ]
    complete = [d for d in days if all(m["kcal"] is not None for m in d["meals"])]
    left_out = [d for d in days if d not in complete]
    nd = len(complete)
    all_meals = [m for d in complete for m in d["meals"]]
    x_total = sum(m["kcal"] for m in all_meals)
    sd_total = grouped_sd(all_meals)
    avg = x_total / nd
    sd_avg = sd_total / nd
    e = sd_avg / avg
    # The method the spec rejects: each day's own sd, days treated as independent.
    sd_ind = math.sqrt(sum(grouped_sd(d["meals"]) ** 2 for d in complete)) / nd
    per_day = []
    for d in days:
        known = [m for m in d["meals"] if m["kcal"] is not None]
        status = "logged" if d in complete else "incomplete"
        row = {"name": d["name"], "status": status, "knownTotal": sum(m["kcal"] for m in known)}
        if status == "logged":
            de = day([meal(f"{d['name']}{i}", m["source"], m["kcal"]) for i, m in enumerate(known)])
            row.update({"ePercent": r4(de["e"] * 100), "score": de["score"],
                        "likely": [half_up(v) for v in de["likely"]],
                        "veryLikely": [half_up(v) for v in de["very"]]})
        per_day.append(row)
    return {
        "input": {"days": days, "notLoggedDays": 7 - len(days)},
        "expected": {
            "days": per_day,
            "completeDays": nd,
            "incompleteLeftOut": len(left_out),
            "label": f"average of {nd} complete days ({len(left_out)} incomplete left out)",
            "average": avg, "sd": r4(sd_avg), "ePercent": r4(e * 100), "score": score_of(e),
            "likely": [half_up(v) for v in lognormal(avg, e, Z80)],
            "veryLikely": [half_up(v) for v in lognormal(avg, e, Z95)],
            "daysIndependentEPercent": r4(sd_ind / avg * 100),
        },
    }


def later_cases():
    return {
        "_about": ("Golden values for kernels not built yet, written by scripts/golden.py "
                   "--write from spec.md > Maths Core. Fictional inputs only. "
                   "src/kernel/__tests__/golden-later.test.ts checks them against the spec "
                   "and lists the kernel tests as pending until each kernel lands."),
        "tolerance": {"rangeEndKcal": 1, "ePercentagePoints": 0.01},
        "G6": g6_net(),
        "G7": g7_plates(),
        "G9": g9_runs(),
        "G10": g10_week(),
    }


def near(a, b, tol):
    return abs(a - b) <= tol + 1e-9


def check_later(cases):
    """Compare the new cases with the numbers printed in spec.md (2026-10-26)."""
    bad = []
    n6 = cases["G6"]["expected"]
    if n6["eaten"]["total"] != 1800 or not near(n6["eaten"]["sd"], 828, 0.05):
        bad.append(("G6", "eaten should be 1800, sd 828"))
    if n6["burned"]["total"] != 300 or not near(n6["burned"]["sd"], 120, 0.05):
        bad.append(("G6", "burned should be 300, sd 120"))
    net = n6["net"]
    if net["total"] != 1500 or not near(net["sd"], 836.7, 0.05):
        bad.append(("G6", f"net {net['total']} sd {net['sd']} != 1500 sd 836.7"))
    for key, (lo, hi) in (("likely", (428, 2572)), ("veryLikely", (-140, 3140))):
        if not (near(net[key][0], lo, 1) and near(net[key][1], hi, 1)):
            bad.append(("G6", f"net {key} {net[key]} != {lo}-{hi}"))

    g7 = cases["G7"]["expected"]
    if g7 != {"foodGrams": 400, "kcal": 660}:
        bad.append(("G7", f"{g7} != 400 g, 660 kcal"))
    if any("error" not in c["expected"] for c in cases["G7"]["errorCases"]):
        bad.append(("G7", "a reading at or below the plate should be an error"))

    p = cases["G9"]["pace"][0]
    if p["text"] != "6:00/km":
        bad.append(("G9", f"5 km in 30 min gives {p['text']}, spec says 6:00/km"))

    w = cases["G10"]["expected"]
    if w["average"] != 1550 or not near(w["sd"], 393.4, 0.05):
        bad.append(("G10", f"average {w['average']} sd {w['sd']} != 1550 sd 393.4"))
    if not near(w["ePercent"], 25.38, 0.01):
        bad.append(("G10", f"e {w['ePercent']} != 25.38"))
    for key, (lo, hi) in (("likely", (1160, 2071)), ("veryLikely", (995, 2415))):
        if not (near(w[key][0], lo, 1) and near(w[key][1], hi, 1)):
            bad.append(("G10", f"{key} {w[key]} != {lo}-{hi}"))
    if w["label"] != "average of 2 complete days (1 incomplete left out)":
        bad.append(("G10", f"label {w['label']!r}"))
    if not near(w["daysIndependentEPercent"], 19.49, 0.01):
        bad.append(("G10", f"days-independent e {w['daysIndependentEPercent']} != 19.49"))
    FAILS.extend((case, [msg]) for case, msg in bad)
    return bad


def show_later(cases):
    n6 = cases["G6"]["expected"]
    print("G6    net calories: eaten 1800 (three photo meals) - burned 300 (device)")
    print(f"      net {n6['net']['total']}, sd {n6['net']['sd']}, likely {n6['net']['likely']}, "
          f"very likely {n6['net']['veryLikely']}; burned score {n6['burned']['score']}, "
          f"likely {n6['burned']['likely']}, very likely {n6['burned']['veryLikely']}")
    g7 = cases["G7"]
    print(f"G7    plate: {g7['input']['readingG']} g reading - {g7['input']['plateG']} g plate "
          f"= {g7['expected']['foodGrams']} g x {g7['input']['kcalPer100']} kcal/100 g "
          f"= {g7['expected']['kcal']:g} kcal")
    g9 = cases["G9"]
    print("G9    pace: " + "; ".join(f"{p['distanceKm']} km in {p['durationMin']:g} min = {p['text']}"
                                     for p in g9["pace"]))
    d = g9["distance"]["expected"]
    print(f"G9b   haversine route: legs {d['legsKm']} km, total {d['totalKm']} km "
          f"(R = {EARTH_RADIUS_KM:g} km)")
    w = cases["G10"]["expected"]
    print(f"G10   week: {w['label']}: average {w['average']:g}, sd {w['sd']}, e {w['ePercent']}%, "
          f"score {w['score']}, likely {w['likely']}, very likely {w['veryLikely']}; "
          f"days-independent e {w['daysIndependentEPercent']}%")


def later_json_text(cases):
    return json.dumps(cases, indent=2, ensure_ascii=False) + "\n"


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


def main(write=False):
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

    # G6, G7, G9, G10: kernels still to be built; values go to fixtures/golden.json.
    cases = later_cases()
    show_later(cases)
    bad_later = check_later(cases)
    print(f"      vs spec: {'OK' if not bad_later else 'MISMATCH'}")
    text = later_json_text(cases)
    if write:
        if not FAILS:
            GOLDEN_JSON.write_text(text, encoding="utf-8")
            print(f"Wrote {GOLDEN_JSON.relative_to(ROOT)}")
        else:
            print(f"Not writing {GOLDEN_JSON.relative_to(ROOT)}: cases differ from the spec")
    else:
        current = GOLDEN_JSON.read_text(encoding="utf-8") if GOLDEN_JSON.exists() else None
        if current != text:
            FAILS.append(("golden.json", [
                f"{GOLDEN_JSON.relative_to(ROOT)} is missing or out of date; run with --write"]))

    print()
    if FAILS:
        print(f"{len(FAILS)} case(s) differ from the spec table:")
        for case, bad in FAILS:
            print(f"  {case}: {'; '.join(bad)}")
        return 1
    print("All golden cases match the spec (G1, G1 improve, G2, G3, G4, G4b, G5, G11, G11b, G12,"
          " and G6, G7, G9, G10 for kernels still to be built), and fixtures/golden.json is current.")
    return 0


if __name__ == "__main__":
    sys.exit(main(write="--write" in sys.argv[1:]))
