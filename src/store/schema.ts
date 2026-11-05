// spec.md > Store and > Data Model: one JSON document per log (`howsure.demo.v1` and
// `howsure.mine.v1`), validated by zod on every load. Tier 1 keys only; Tier 2 and 3 keys
// are added with their slices. Unknown keys are kept (`looseObject`), so a document written
// by a later slice is never silently trimmed by this one.
//
// spec.md names `shared/connector-schema.mjs` as the home of the meal-input schema once the
// Claude connector exists (Tier 2, slice 14). Until then the meal schema lives here.

import { z } from 'zod'
import { hasOffset } from '../clock'
import type { MealSourceId } from '../kernel/types'

/**
 * The format version this build writes. Saved logs in an older version are upgraded on load
 * (src/store/migrations.ts); bumping this needs an upgrade step and frozen fixtures, and
 * src/store/__tests__/migrations.test.ts fails until both exist.
 */
export const SCHEMA_VERSION = 1

/** Meal sources, in the sources table's order (spec.md > Maths Core: Sources Table). */
const MEAL_SOURCES = ['weighed', 'label', 'label_lookup', 'menu', 'photo', 'description', 'food_db'] as const satisfies readonly MealSourceId[]

// Compile-time check that the list above covers every MealSourceId.
type MissingSource = Exclude<MealSourceId, (typeof MEAL_SOURCES)[number]>
const _everySourceListed: MissingSource extends never ? true : false = true
void _everySourceListed

/** An ISO 8601 date-time that carries its own offset, the format logs store (spec.md > Clock). */
const isoWithOffset = z
  .string()
  .refine((s) => hasOffset(s) && !Number.isNaN(Date.parse(s)), { message: 'expected an ISO date-time with an offset' })

/** A known amount: a finite number, never negative. Unknown is null, never 0. */
const amount = z.number().nonnegative()
const amountOrUnknown = amount.nullable()

export const mealFoodSchema = z.looseObject({
  name: z.string(),
  amount: z.number().nonnegative(),
  unit: z.enum(['g', 'oz', 'serving']),
  tagOverrides: z.looseObject({ add: z.array(z.string()).optional(), remove: z.array(z.string()).optional() }).optional(),
  fiberPer100: z.number().nonnegative().optional(),
})

export const mealLookupSchema = z.looseObject({
  kind: z.enum(['barcode', 'foodSearch']),
  id: z.string().optional(),
  credit: z.string().optional(),
  fetchedAt: z.string().optional(),
  saved: z.boolean().optional(),
  amount: z.looseObject({ kind: z.enum(['weighed', 'package', 'portion']), grams: amountOrUnknown.optional() }),
})

export const mealSchema = z.looseObject({
  id: z.string().min(1),
  name: z.string(),
  eatenAt: isoWithOffset,
  // null = "How do you know?" not picked, allowed only while kcal is unknown (mealWithSourceSchema).
  source: z.enum(MEAL_SOURCES).nullable(),
  kcal: amountOrUnknown,
  protein: amountOrUnknown,
  carbs: amountOrUnknown,
  fat: amountOrUnknown,
  note: z.string().optional(),
  foods: z.array(mealFoodSchema).optional(),
  lookup: mealLookupSchema.optional(),
})

/**
 * prd.md > Logging a Meal: with calories entered, a source must be picked; with calories blank it
 * can stay empty. Kept apart from mealSchema so later slices can still .extend() the plain shape.
 */
export const mealWithSourceSchema = mealSchema.refine((m) => m.kcal === null || m.source !== null, {
  message: 'a meal with known calories needs its source',
  path: ['source'],
})

/**
 * A meal saved as usual (build-out item 2.3; store/log.ts SavedMeal): a meal's values with no
 * time. The same rule as a logged meal: known calories need their source.
 */
export const savedMealSchema = z
  .looseObject({
    id: z.string().min(1),
    name: z.string().min(1),
    source: z.enum(MEAL_SOURCES).nullable(),
    kcal: amountOrUnknown,
    protein: amountOrUnknown,
    carbs: amountOrUnknown,
    fat: amountOrUnknown,
    note: z.string().optional(),
    foods: z.array(mealFoodSchema).optional(),
    lookup: mealLookupSchema.optional(),
    savedAt: isoWithOffset,
    fromMealId: z.string().optional(),
  })
  .refine((m) => m.kcal === null || m.source !== null, {
    message: 'a saved meal with known calories needs its source',
    path: ['source'],
  })

export const sleepSchema = z.looseObject({
  id: z.string().min(1),
  sleepStart: isoWithOffset.nullable(),
  wake: isoWithOffset.nullable(),
})

export const profileSchema = z.looseObject({
  name: z.string(),
  kind: z.enum(['guest', 'demo']),
  targets: z
    .looseObject({
      kcal: amount.optional(),
      protein: amount.optional(),
      carbs: amount.optional(),
      fat: amount.optional(),
    })
    .optional(),
})

/** spec.md > Clock: demo now = demoEpochFixture + (Date.now() - demoEpochReal). Demo document only.
 * Loose like the rest, so a key a later version adds here survives a load and save (item 1.1). */
export const clockSchema = z.looseObject({
  demoEpochFixture: z.number(),
  demoEpochReal: z.number(),
})

/** The current format only: older documents are upgraded before they reach this schema. */
export const logDocSchema = z.looseObject({
  version: z.literal(SCHEMA_VERSION),
  kind: z.enum(['demo', 'mine']),
  profile: profileSchema,
  meals: z.array(mealWithSourceSchema),
  sleeps: z.array(sleepSchema),
  // Tier 2 (workouts: slice 10, plates: slice 11). Carried through untouched until then.
  workouts: z.array(z.looseObject({ id: z.string() })),
  plates: z.array(z.looseObject({ id: z.string() })),
  settings: z.looseObject({}).optional(),
  // Build-out item 2.3: optional, so a log saved before it loads unchanged (no version bump).
  savedMeals: z.array(savedMealSchema).optional(),
  clock: clockSchema.optional(),
})

export type StoredLogDoc = z.infer<typeof logDocSchema>
