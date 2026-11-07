// Build-out item 2.9: an invented own log for the fictional Sam whose Wednesday has a number of
// every kind on the dashboard: meals (one listing its foods, one missing its carbs), a gym session
// and a workout with unknown calories (so net is the headline, known entries only), weigh-ins, body
// details (the estimated deficit or surplus) and targets. `asleep` adds a sleep still going on.
// Shared by tap-through.spec.ts. No real person's data. samNoBedtime is a new log's first night.

export const iso = (s: string) => `${s}:00-04:00`

export function samWednesday(asleep = false) {
  const sleeps = []
  for (let d = 15; d <= 21; d++) {
    sleeps.push({ id: `s${d}`, sleepStart: d === 18 ? null : iso(`2026-10-${d - 1}T23:10`), wake: iso(`2026-10-${d}T07:00`) })
  }
  if (asleep) sleeps.push({ id: 's-open', sleepStart: iso('2026-10-21T23:40'), wake: null })
  return {
    version: 1,
    kind: 'mine',
    profile: {
      name: '',
      kind: 'guest',
      targets: { kcal: 2000, protein: 120, carbs: 250 },
      body: { age: 30, sex: 'female', heightCm: 165, weightKg: 70 },
    },
    meals: [
      {
        id: 'm-oats', name: 'Overnight oats', eatenAt: iso('2026-10-21T08:00'), source: 'label', kcal: 420, protein: 18, carbs: 60, fat: 11,
        foods: [
          { name: 'rolled oats', amount: 50, unit: 'g', fiberPer100: 10 },
          { name: 'milk', amount: 8, unit: 'oz' },
          { name: 'raspberries', amount: 1, unit: 'serving' },
        ],
      },
      { id: 'm-curry', name: 'Chickpea curry, 2 bowls', eatenAt: iso('2026-10-21T13:00'), source: 'photo', kcal: 650, protein: 22, carbs: null, fat: 24 },
      {
        id: 'm-bar', name: 'Cereal bar', eatenAt: iso('2026-10-21T16:00'), source: 'label_lookup', kcal: 190, protein: 4, carbs: 27, fat: 8,
        lookup: { kind: 'barcode', saved: true, fetchedAt: '2026-10-02T10:00:00-04:00', amount: { kind: 'package', grams: 45 } },
      },
    ],
    sleeps,
    workouts: [
      {
        id: 'w-push', name: 'Push', startedAt: iso('2026-10-21T18:00'), minutes: 60, kcal: 250, source: 'burn_device',
        gym: { unit: 'kg', exercises: [{ name: 'Bench press', sets: [{ kind: 'warmup', weightKg: 40, reps: 10 }, { kind: 'working', weightKg: 70, reps: 8 }] }] },
      },
      { id: 'w-swim', name: 'Swim', startedAt: iso('2026-10-21T19:00'), minutes: null, kcal: null, source: null },
    ],
    plates: [],
    settings: { weightUnit: 'kg' },
    weighIns: [
      { id: 'wi1', at: iso('2026-10-16T07:10'), kg: 72.4, unit: 'kg' },
      { id: 'wi2', at: iso('2026-10-18T07:10'), kg: 72.0, unit: 'kg' },
      { id: 'wi3', at: iso('2026-10-20T07:10'), kg: 71.8, unit: 'kg' },
      { id: 'wi4', at: iso('2026-10-21T07:10'), kg: 71.6, unit: 'kg' },
    ],
  }
}

/**
 * A new own log for Sam: one night with no bedtime ("I woke up" with nothing before it) and one
 * meal. The 7-night average is not available yet, with "0 of 1 night".
 */
export function samNoBedtime() {
  return {
    version: 1,
    kind: 'mine',
    profile: { name: '', kind: 'guest' },
    meals: [{ id: 'm-toast', name: 'Toast and jam', eatenAt: iso('2026-10-21T08:00'), source: 'label', kcal: 310, protein: 8, carbs: 52, fat: 7 }],
    sleeps: [{ id: 's21', sleepStart: null, wake: iso('2026-10-21T07:00') }],
    workouts: [],
    plates: [],
  }
}
