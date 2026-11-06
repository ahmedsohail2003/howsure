// Build-out item 2.7: an invented own log for the fictional Sam with every kind of entry the week
// view averages (meals with an unknown one, a day with nothing logged, a night with no sleep time,
// workouts with an unknown one, a gym session, weigh-ins with body fat, and body details). Shared by
// week.spec.ts and the copy sweep. No real person's data.

export const iso = (s: string) => `${s}:00-04:00`

/** An invented own log for Sam with every kind of entry: nine waking days, Tue Oct 13 to Wed Oct 21. */
export function samWeek() {
  const meal = (id: string, at: string, source: string | null, kcal: number | null, p: number | null = 20, c: number | null = 50, f: number | null = 12) => ({
    id, name: 'Lentil bowl with a long name that has to wrap on a small phone', eatenAt: iso(at), source, kcal, protein: p, carbs: c, fat: f,
  })
  const sleeps = []
  for (let d = 13; d <= 21; d++) {
    sleeps.push({ id: `s${d}`, sleepStart: d === 17 ? null : iso(`2026-10-${d - 1}T23:00`), wake: iso(`2026-10-${d}T07:00`) })
  }
  return {
    version: 1,
    kind: 'mine',
    profile: { name: '', kind: 'guest', body: { age: 30, sex: 'female', heightCm: 165, weightKg: 70 } },
    meals: [
      meal('m1', '2026-10-13T08:00', 'label', 600),
      meal('m2', '2026-10-14T08:00', 'label', 700),
      meal('m3', '2026-10-15T08:00', 'weighed', 500),
      meal('m4', '2026-10-15T13:00', 'photo', 900),
      meal('m5', '2026-10-16T08:00', 'label', 800, 30, null, 10),
      meal('m6', '2026-10-16T19:00', 'menu', null, null, null, null),
      meal('m7', '2026-10-18T09:00', 'label', 1200),
      meal('m8', '2026-10-19T09:00', 'weighed', 1500),
      meal('m9', '2026-10-20T09:00', 'label', 1400),
      meal('m10', '2026-10-21T09:00', 'label', 1000),
    ],
    sleeps,
    workouts: [
      { id: 'w1', name: 'Bike ride', startedAt: iso('2026-10-15T18:00'), minutes: 40, kcal: 300, source: 'burn_device' },
      {
        id: 'w2', name: 'Push', startedAt: iso('2026-10-19T18:00'), minutes: 60, kcal: 250, source: 'burn_device',
        gym: { unit: 'kg', exercises: [{ name: 'Bench press', sets: [{ kind: 'warmup', weightKg: 40, reps: 10 }, { kind: 'working', weightKg: 70, reps: 8 }] }] },
      },
      { id: 'w3', name: 'Swim', startedAt: iso('2026-10-20T18:00'), minutes: null, kcal: null, source: null },
    ],
    plates: [],
    settings: { weightUnit: 'kg' },
    weighIns: [
      { id: 'wi1', at: iso('2026-10-16T07:10'), kg: 72.4, unit: 'kg', bodyFatPct: 21 },
      { id: 'wi2', at: iso('2026-10-18T07:10'), kg: 72.0, unit: 'kg' },
      { id: 'wi3', at: iso('2026-10-20T07:10'), kg: 71.8, unit: 'kg', bodyFatPct: 20 },
    ],
  }
}

