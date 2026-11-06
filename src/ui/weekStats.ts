// Each registered stat's week row (build-out item 2.7): its average over the week's waking days,
// how many days that counts, and its day-by-day breakdown. The registry (src/kernel/statRegistry.ts)
// lists the stats; WEEK_ROWS is typed by its StatId, so a stat registered without a week row does
// not compile. weekView.ts calls these once per week; every look draws what they return.
//
// Rules every row keeps: a day with an unknown value is left out and counted, never treated as 0;
// a value that is a sentence is never drawn as a number (`ok` false); every day of the breakdown
// says whether it was counted, left out and why, or not logged.
// Pure: no React.

import { isGymSession, sessionSets } from '../kernel/gym'
import { isKnownMeal } from '../kernel/estimate'
import { isKnownWorkout, netOf } from '../kernel/net'
import type { StatId } from '../kernel/statRegistry'
import { STATS } from '../kernel/statRegistry'
import type { MacroKey, Night, WeighIn } from '../kernel/types'
import {
  balanceAverage,
  burnedAverage,
  burnedScoreAverage,
  calorieAverage,
  isLoggedDay,
  macroAverage,
  meanOf,
  minutesAverage,
  netAverage,
  netKnown,
  scoreAverage,
  weekDayStatus,
  weekSleep,
  type BalanceDay,
  type WeekDayInput,
} from '../kernel/week'
import { rangeWords } from './balanceView'
import { copy } from './copy'
import { fmtInt, fmtRange, fmtSigned, fmtSignedRange, fmtTime, fmtWeekday, fmtWeekdayTime, onLaterDate } from './format'
import { fmtClockMinutes, fmtDuration } from './sleepView'
import { fmtWeight, trendParts } from './weightView'
import type { Breakdown, BreakdownDay, DayState, WeekChart, WeekContext, WeekDay, WeekStatRow } from './weekView'

const oneDecimal = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const upToOneDecimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })

const kcal = (n: number) => copy.week.kcal(fmtInt(n))
const signedKcal = (n: number) => copy.week.kcal(fmtSigned(n))

/**
 * One day of a breakdown. `night`: the row is about the night before the day (which is over even
 * on today), so the current day is "(today)", not "(today, so far)".
 */
function dayRow(
  d: WeekDay,
  value: string,
  ok: boolean,
  state: DayState,
  opts: { why?: string; detail?: string; night?: boolean; none?: string } = {},
): BreakdownDay {
  const status =
    state === 'counted'
      ? copy.week.counted
      : state === 'leftOut'
        ? copy.week.leftOut(opts.why ?? copy.week.why.notWorkedOut)
        : state === 'notLogged'
          ? copy.week.notLogged
          : (opts.none ?? copy.week.none)
  const day = copy.week.dayName(d.name, d.current ? (opts.night ? 'plain' : 'soFar') : null)
  const detail = opts.detail === undefined ? undefined : keepTimes(opts.detail)
  const spoken = detail ? `${value}${copy.sep}${detail}` : value
  return { dayStart: d.dayStart, day, value, ok, detail, state, status, label: copy.week.dayLabel(day, spoken, status) }
}

/** A clock time never splits from its AM or PM ("11:00 PM" stays on one line when a detail wraps). */
function keepTimes(text: string): string {
  return text.replace(new RegExp(` (${copy.am}|${copy.pm})\\b`, 'g'), '\u00a0$1')
}

/** A day with nothing logged for this stat: no value, and its status says "Not logged" once. */
function notLogged(d: WeekDay, opts: { night?: boolean } = {}): BreakdownDay {
  return dayRow(d, '', false, 'notLogged', opts)
}

/** A day with nothing to count for this stat ("No weigh-in"): no value, and its status says so once. */
function nothing(d: WeekDay, words: string): BreakdownDay {
  return dayRow(d, '', false, 'none', { none: words })
}

function row(id: StatId, value: string, ok: boolean, count: string, lines: string[], breakdown: Omit<Breakdown, 'title'>): WeekStatRow {
  const title = copy.week.titles[id]
  return {
    id,
    group: STATS[id].group,
    title,
    value,
    ok,
    count,
    lines,
    label: copy.week.rowLabel(title, value, count || copy.week.none, lines.map((l) => (/[.!?]$/.test(l) ? l : `${l}.`)).join(' ')),
    breakdown: { title: copy.week.breakdownTitle(title), ...breakdown },
  }
}

/**
 * True when the current day, still going, is one of the days an average counts (its breakdown day
 * is "Counted"). More can still be logged on it, so the count names it apart from the complete days.
 */
function todayCounted(ctx: WeekContext, days: readonly BreakdownDay[]): boolean {
  return days.some((b, i) => b.state === 'counted' && ctx.days[i]?.current === true)
}

/**
 * "average of 5 complete days (1 incomplete left out)", "average of 4 complete days and today so
 * far", or what stands in when no day counts. `counted` includes today when `today` is true.
 */
function daysCount(counted: number, leftOut: number, today: boolean): string {
  if (counted === 0) return copy.week.noCompleteDay(leftOut)
  return today ? copy.week.completeDays(counted - 1, leftOut, true) : copy.week.completeDays(counted, leftOut)
}

const inputs = (ctx: WeekContext): WeekDayInput[] => ctx.days.map((d) => ({ meals: d.view.meals, workouts: d.view.workouts }))

function macroRow(key: MacroKey) {
  return (ctx: WeekContext): WeekStatRow => {
    const avg = macroAverage(
      ctx.days.map((d) => d.view.meals),
      key,
    )
    const word = copy.week.macroWords[key]
    const days = ctx.days.map((d) => {
      const m = d.view.macros[key]
      if (d.view.meals.length === 0) return notLogged(d)
      if (m.missing === 0) return dayRow(d, copy.week.grams(fmtInt(m.known)), true, 'counted')
      if (m.allUnknown) return dayRow(d, copy.week.unknown, false, 'leftOut', { why: copy.week.why.missingMacro(word) })
      return dayRow(d, copy.week.grams(fmtInt(m.known)), true, 'leftOut', { why: copy.week.why.missingMacro(word), detail: copy.week.knownOnlyNote })
    })
    const ok = avg.average !== null
    return row(key, ok ? copy.week.grams(fmtInt(avg.average as number)) : copy.week.notAvailable, ok, daysCount(avg.counted, avg.leftOut, todayCounted(ctx, days)), [], {
      intro: copy.week.intro.macro(word),
      days,
    })
  }
}

/** The calorie breakdown's chart: each day's bar and ranges, and the average's line. */
function calorieChart(ctx: WeekContext, average: number | null): WeekChart {
  const withDates = chartNeedsDates(ctx.days.map((d) => d.dayStart))
  const bars = ctx.days.map((d) => {
    const kind = weekDayStatus(d.view.meals)
    const logged = kind === 'logged'
    return {
      name: d.dayStart === null ? copy.week.provisionalShort : fmtWeekday(d.dayStart),
      date: d.dayStart !== null && withDates ? String(new Date(d.dayStart).getDate()) : null,
      kind,
      value: d.view.day.knownTotal,
      likely: logged ? d.view.day.likely : null,
      veryLikely: logged ? d.view.day.veryLikely : null,
    }
  })
  const top = Math.max(1, average ?? 0, ...bars.map((b) => Math.max(b.value, b.veryLikely?.hi ?? 0)))
  return { bars, top, average }
}

/**
 * True when a bare weekday would not tell the chart's days apart: a weekday comes twice, or the
 * days skip a date (a missed wake merged two days, so "Mon" is followed by "Wed"). The bars then
 * carry their day of the month too ("Wed 28").
 */
export function chartNeedsDates(starts: readonly (string | null)[]): boolean {
  const dates = starts.filter((s): s is string => s !== null).map((s) => new Date(s))
  const dayNo = (d: Date) => Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000)
  const weekdays = new Set(dates.map((d) => d.getDay()))
  if (weekdays.size < dates.length) return true
  return dates.some((d, i) => i > 0 && dayNo(d) - dayNo(dates[i - 1]) !== 1)
}

function hasWorkouts(ctx: WeekContext): boolean {
  return ctx.doc.workouts.length > 0
}

export const WEEK_ROWS: { readonly [K in StatId]: (ctx: WeekContext) => WeekStatRow | null } = {
  eaten: (ctx) => {
    const avg = calorieAverage(ctx.days.map((d) => d.view.meals))
    const days = ctx.days.map((d) => {
      const status = weekDayStatus(d.view.meals)
      const day = d.view.day
      if (status === 'notLogged') return notLogged(d)
      if (status === 'logged') {
        const detail =
          day.likely && day.veryLikely
            ? `${copy.week.likely(fmtRange(day.likely))}${copy.sep}${copy.week.veryLikely(fmtRange(day.veryLikely))}`
            : undefined
        return dayRow(d, kcal(day.knownTotal), true, 'counted', { detail })
      }
      if (day.status === 'all-unknown') return dayRow(d, copy.week.unknown, false, 'leftOut', { why: copy.week.why.unknownMeal })
      return dayRow(d, kcal(day.knownTotal), true, 'leftOut', { why: copy.week.why.unknownMeal, detail: copy.week.knownOnlyNote })
    })
    const ok = avg.average !== null
    const lines =
      avg.likely && avg.veryLikely
        ? [copy.week.likely(fmtRange(avg.likely)), copy.week.veryLikely(fmtRange(avg.veryLikely)), copy.week.steadier]
        : []
    return row('eaten', ok ? kcal(avg.average as number) : copy.week.notAvailable, ok, daysCount(avg.counted, avg.leftOut, todayCounted(ctx, days)), lines, {
      intro: copy.week.intro.eaten,
      days,
      notes: ok ? [copy.week.method] : undefined,
      // No chart with no bar to draw (a week with no meals): an empty frame and legend explain nothing.
      chart: ctx.days.some((d) => d.view.meals.length > 0) ? calorieChart(ctx, avg.average) : undefined,
    })
  },

  score: (ctx) => {
    const avg = scoreAverage(ctx.days.map((d) => d.view.meals))
    const days = ctx.days.map((d) => {
      const status = weekDayStatus(d.view.meals)
      if (status === 'notLogged') return notLogged(d)
      if (status === 'incomplete') return dayRow(d, copy.week.notScored, false, 'leftOut', { why: copy.week.why.unknownMeal })
      const score = d.view.day.score
      return score === null
        ? dayRow(d, copy.week.notScored, false, 'leftOut', { why: copy.week.why.noScore })
        : dayRow(d, fmtInt(score), true, 'counted')
    })
    const ok = avg.average !== null
    const today = todayCounted(ctx, days)
    const count = copy.week.scoreDays(avg.counted - (today ? 1 : 0), avg.incomplete, avg.unscored, 'eaten', today)
    return row('score', ok ? fmtInt(avg.average as number) : copy.week.notAvailable, ok, count, [], {
      intro: copy.week.intro.score,
      days,
    })
  },

  protein: macroRow('protein'),
  carbs: macroRow('carbs'),
  fat: macroRow('fat'),

  net: (ctx) => {
    if (!hasWorkouts(ctx)) return null
    const avg = netAverage(inputs(ctx))
    const days = ctx.days.map((d) => {
      const input = { meals: d.view.meals, workouts: d.view.workouts }
      if (!isLoggedDay(input)) return notLogged(d)
      if (netKnown(input)) {
        // The day's net as the dashboard has it; a day with no workouts burns 0 in workouts (the
        // dashboard shows no net then, so it is worked out from the same netOf here).
        const net = d.view.net ?? netOf(d.view.day.knownTotal, d.view.eatenSd, 0, 0)
        return dayRow(d, signedKcal(net.total), true, 'counted', { detail: copy.week.likely(fmtSignedRange(net.likely)) })
      }
      const why =
        d.view.meals.length === 0
          ? copy.week.why.noMeals
          : weekDayStatus(d.view.meals) !== 'logged'
            ? copy.week.why.unknownMeal
            : copy.week.why.unknownWorkout
      return dayRow(d, copy.week.unknown, false, 'leftOut', { why })
    })
    const ok = avg.average !== null
    const lines =
      avg.likely && avg.veryLikely ? [copy.week.likely(fmtSignedRange(avg.likely)), copy.week.veryLikely(fmtSignedRange(avg.veryLikely))] : []
    return row('net', ok ? signedKcal(avg.average as number) : copy.week.notAvailable, ok, daysCount(avg.counted, avg.leftOut, todayCounted(ctx, days)), lines, {
      intro: copy.week.intro.net,
      days,
    })
  },

  burned: (ctx) => {
    if (!hasWorkouts(ctx)) return null
    const avg = burnedAverage(inputs(ctx))
    const days = ctx.days.map((d) => {
      const b = d.view.burned
      if (!isLoggedDay({ meals: d.view.meals, workouts: d.view.workouts })) return notLogged(d)
      if (d.view.workouts.every(isKnownWorkout)) {
        const detail = d.view.workouts.length === 0 ? copy.week.noWorkouts : b.likely ? copy.week.likely(fmtRange(b.likely)) : undefined
        return dayRow(d, kcal(b.knownTotal), true, 'counted', { detail })
      }
      if (b.status === 'all-unknown') return dayRow(d, copy.week.unknown, false, 'leftOut', { why: copy.week.why.unknownWorkout })
      return dayRow(d, kcal(b.knownTotal), true, 'leftOut', { why: copy.week.why.unknownWorkout, detail: copy.week.knownWorkoutsOnly })
    })
    const ok = avg.average !== null
    const lines = avg.likely && avg.veryLikely ? [copy.week.likely(fmtRange(avg.likely)), copy.week.veryLikely(fmtRange(avg.veryLikely))] : []
    return row('burned', ok ? kcal(avg.average as number) : copy.week.notAvailable, ok, daysCount(avg.counted, avg.leftOut, todayCounted(ctx, days)), lines, {
      intro: copy.week.intro.burned,
      days,
    })
  },

  burnedScore: (ctx) => {
    if (!hasWorkouts(ctx)) return null
    const avg = burnedScoreAverage(ctx.days.map((d) => d.view.workouts))
    const days = ctx.days.map((d) => {
      const w = d.view.workouts
      if (w.length === 0) return nothing(d, copy.week.noWorkouts)
      if (!w.every(isKnownWorkout)) return dayRow(d, copy.week.notScored, false, 'leftOut', { why: copy.week.why.unknownWorkout })
      const score = d.view.burned.score
      return score === null
        ? dayRow(d, copy.week.notScored, false, 'leftOut', { why: copy.week.why.noBurnedScore })
        : dayRow(d, fmtInt(score), true, 'counted', { detail: copy.week.workoutCount(w.length) })
    })
    const ok = avg.average !== null
    const today = todayCounted(ctx, days)
    const count = copy.week.scoreDays(avg.counted - (today ? 1 : 0), avg.incomplete, avg.unscored, 'burned', today)
    return row('burnedScore', ok ? fmtInt(avg.average as number) : copy.week.notAvailable, ok, count, [], {
      intro: copy.week.intro.burnedScore,
      days,
    })
  },

  balance: (ctx) => {
    // Without body details every day only invites them, as under the headline: no row.
    if (ctx.days.every((d) => d.balance.kind === 'invite')) return null
    const inputsByDay: (BalanceDay | 'leftOut' | null)[] = []
    const days = ctx.days.map((d) => {
      const bal = d.balance
      const entries = { meals: d.view.meals, workouts: d.view.workouts }
      if (!isLoggedDay(entries)) {
        inputsByDay.push(null)
        return notLogged(d)
      }
      if (bal.kind === 'shown' && !bal.knownOnly) {
        inputsByDay.push({
          meals: d.view.meals.filter(isKnownMeal),
          workouts: d.view.workouts.filter(isKnownWorkout),
          everyday: bal.est.everyday,
          everydaySd: bal.est.everydaySd,
        })
        return dayRow(d, balanceValue(bal.rounded), true, 'counted', { detail: bal.likelyText })
      }
      inputsByDay.push('leftOut')
      const unknown = d.view.meals.some((x) => !isKnownMeal(x)) || d.view.workouts.some((w) => !isKnownWorkout(w))
      const why =
        bal.kind === 'shown'
          ? unknownEntryWhy(d)
          : bal.kind === 'needsWake'
            ? copy.week.why.noWake
            : d.view.meals.length === 0
              ? copy.week.why.noMeals
              : unknown
                ? unknownEntryWhy(d)
                : copy.week.why.notWorkedOut
      return dayRow(d, copy.week.unknown, false, 'leftOut', { why })
    })
    const avg = balanceAverage(inputsByDay)
    const ok = avg.average !== null
    const lines =
      avg.likely && avg.veryLikely
        ? [copy.week.likely(rangeWords(avg.likely, false)), copy.week.veryLikely(rangeWords(avg.veryLikely, false))]
        : []
    return row('balance', ok ? balanceValue(Math.round(avg.average as number)) : copy.week.notAvailable, ok, daysCount(avg.counted, avg.leftOut, todayCounted(ctx, days)), lines, {
      intro: copy.week.intro.balance,
      days,
      notes: ok ? [copy.week.balanceMethod] : undefined,
    })
  },

  workoutTime: (ctx) => {
    if (!hasWorkouts(ctx)) return null
    const avg = minutesAverage(inputs(ctx))
    const days = ctx.days.map((d) => {
      if (!isLoggedDay({ meals: d.view.meals, workouts: d.view.workouts })) return notLogged(d)
      if (d.view.workouts.some((w) => w.minutes === null)) return dayRow(d, copy.week.unknown, false, 'leftOut', { why: copy.week.why.unknownMinutes })
      const minutes = d.view.workouts.reduce((s, w) => s + (w.minutes as number), 0)
      const detail = d.view.workouts.length === 0 ? copy.week.noWorkouts : copy.week.workoutCount(d.view.workouts.length)
      return dayRow(d, copy.week.minutes(fmtInt(minutes)), true, 'counted', { detail })
    })
    const ok = avg.average !== null
    return row('workoutTime', ok ? copy.week.minutes(fmtInt(avg.average as number)) : copy.week.notAvailable, ok, daysCount(avg.counted, avg.leftOut, todayCounted(ctx, days)), [], {
      intro: copy.week.intro.workoutTime,
      days,
    })
  },

  gym: (ctx) => {
    if (!ctx.doc.workouts.some(isGymSession)) return null
    let sessions = 0
    let sets = 0
    const days = ctx.days.map((d) => {
      const own = d.view.workouts.filter(isGymSession)
      if (own.length === 0) return nothing(d, copy.week.noGym)
      const n = own.reduce((s, w) => s + sessionSets(w.gym).length, 0)
      sessions += own.length
      sets += n
      return dayRow(d, copy.week.setsValue(fmtInt(n)), true, 'counted', { detail: copy.week.sessionCount(own.length) })
    })
    const ok = sessions > 0
    return row(
      'gym',
      ok ? copy.week.setsAverage(upToOneDecimal.format(Math.round((sets / sessions) * 10) / 10)) : copy.week.noSessions,
      ok,
      ok ? copy.week.sessions(sessions, ctx.days.length) : '',
      [],
      { intro: copy.week.intro.gym, days },
    )
  },

  sleepLength: (ctx) => {
    const ws = weekSleep(ctx.days.map((d) => d.night))
    const days = ctx.days.map((d) => {
      const n = d.night
      if (noLength(n)) return dayRow(d, copy.week.unknown, false, 'leftOut', { why: copy.week.why.noLength, night: true })
      if (n === null || n.minutes === null || n.sleepStart === null || n.wake === null) return notLogged(d, { night: true })
      return dayRow(d, fmtDuration(n.minutes), true, 'counted', {
        detail: copy.week.nightSpan(sleepTimeText(n.sleepStart, n.wake), fmtTime(n.wake)),
        night: true,
      })
    })
    const ok = ws.avgMinutes !== null
    return row('sleepLength', ok ? fmtDuration(ws.avgMinutes as number) : copy.week.notAvailable, ok, nightsCount(ctx, ws.complete, ws.total), [], {
      intro: copy.week.intro.sleepLength,
      days,
    })
  },

  bedtime: (ctx) => {
    const ws = weekSleep(ctx.days.map((d) => d.night))
    const days = ctx.days.map((d) => {
      const n = d.night
      if (n !== null && noLength(n)) {
        return dayRow(d, sleepTimeText(n.sleepStart as string, n.wake as string), true, 'leftOut', { why: copy.week.why.noLength, night: true })
      }
      if (n === null || n.minutes === null || n.sleepStart === null || n.wake === null) return notLogged(d, { night: true })
      return dayRow(d, sleepTimeText(n.sleepStart, n.wake), true, 'counted', { night: true })
    })
    const value = ws.avgSleepMinutes !== null ? fmtClockMinutes(ws.avgSleepMinutes) : ws.sleepVaries ? copy.week.sleepVaries : copy.week.notAvailable
    return row('bedtime', value, ws.avgSleepMinutes !== null, nightsCount(ctx, ws.complete, ws.total), [], { intro: copy.week.intro.bedtime, days })
  },

  wakeTime: (ctx) => {
    const ws = weekSleep(ctx.days.map((d) => d.night))
    const days = ctx.days.map((d) => {
      const n = d.night
      if (n === null || n.wake === null) return notLogged(d, { night: true })
      // The wake is known, but like the 7-night average a night with no sleep time is left out.
      if (n.minutes === null) {
        const why = noLength(n) ? copy.week.why.noLength : copy.week.why.sleepNotLogged
        return dayRow(d, fmtTime(n.wake), true, 'leftOut', { why, night: true })
      }
      return dayRow(d, fmtTime(n.wake), true, 'counted', { night: true })
    })
    const value = ws.avgWakeMinutes !== null ? fmtClockMinutes(ws.avgWakeMinutes) : ws.wakeVaries ? copy.week.wakeVaries : copy.week.notAvailable
    return row('wakeTime', value, ws.avgWakeMinutes !== null, nightsCount(ctx, ws.complete, ws.total), [], { intro: copy.week.intro.wakeTime, days })
  },

  weight: (ctx) => {
    if ((ctx.doc.weighIns ?? []).length === 0) return null
    const all = ctx.days.flatMap((d) => d.weighIns)
    const daysWith = ctx.days.filter((d) => d.weighIns.length > 0).length
    const days = ctx.days.map((d) => {
      const w = d.weighIns
      if (w.length === 0) return nothing(d, copy.week.noWeighIn)
      const kg = meanOf(w.map((x) => x.kg)) as number
      const detail = w.length === 1 ? weighInTime(w[0], d.dayStart) : copy.week.dayWeighIns(w.length)
      return dayRow(d, fmtWeight(kg, ctx.unit), true, 'counted', { detail })
    })
    const avg = meanOf(all.map((w) => w.kg))
    const t = trendParts(ctx.weight.trend, ctx.unit)
    const trend = t.ok ? copy.week.trend(t.value, t.note) : copy.week.trendStatus(t.value)
    return row(
      'weight',
      avg !== null ? fmtWeight(avg, ctx.unit) : copy.week.noWeighIns,
      avg !== null,
      avg !== null ? copy.week.weighIns(all.length, daysWith, ctx.days.length) : '',
      [trend],
      { intro: copy.week.intro.weight(ctx.days[ctx.days.length - 1]?.current ?? false), days },
    )
  },

  bodyFat: (ctx) => {
    if (!(ctx.doc.weighIns ?? []).some((w) => w.bodyFatPct !== undefined)) return null
    const all = ctx.days.flatMap((d) => d.weighIns).filter((w) => w.bodyFatPct !== undefined)
    const days = ctx.days.map((d) => {
      const w = d.weighIns.filter((x) => x.bodyFatPct !== undefined)
      if (w.length === 0) return nothing(d, copy.week.noBodyFatDay)
      const pct = meanOf(w.map((x) => x.bodyFatPct as number)) as number
      return dayRow(d, copy.week.percent(oneDecimal.format(pct)), true, 'counted', {
        detail: w.length === 1 ? weighInTime(w[0], d.dayStart) : copy.week.dayWeighIns(w.length),
      })
    })
    const avg = meanOf(all.map((w) => w.bodyFatPct as number))
    return row(
      'bodyFat',
      avg !== null ? copy.week.percent(oneDecimal.format(avg)) : copy.week.noBodyFat,
      avg !== null,
      avg !== null ? copy.week.bodyFatCount(all.length) : '',
      [],
      { intro: copy.week.intro.bodyFat, days },
    )
  },
}

/** "350 kcal deficit", "120 kcal surplus", "about even (0 kcal)" from a rounded balance. */
function balanceValue(rounded: number): string {
  if (rounded < 0) return copy.week.deficit(fmtInt(-rounded))
  if (rounded > 0) return copy.week.surplus(fmtInt(rounded))
  return copy.week.even
}

/**
 * A weigh-in's time under its day's heading: "7:10 AM", or with its weekday when it is past
 * midnight ("Thu 12:30 AM"), or the words for a time an import did not record.
 */
function weighInTime(w: WeighIn, dayStart: string | null): string {
  if (w.timeApproximate) return copy.weight.approxTime
  return onLaterDate(w.at, dayStart) ? fmtWeekdayTime(w.at) : fmtTime(w.at)
}

/** "6 of 7 nights", or "no night logged yet" when there is no night at all in these days. */
function nightsCount(ctx: WeekContext, complete: number, total: number): string {
  return ctx.days.every((d) => d.night === null) ? copy.week.noNights : copy.week.nights(complete, total)
}

/** A sleep time beside its wake: "4:20 AM" on the wake's date, "Wed 11:10 PM" the evening before. */
function sleepTimeText(sleepStart: string, wake: string): string {
  return onLaterDate(wake, sleepStart) ? fmtWeekdayTime(sleepStart) : fmtTime(sleepStart)
}

/** Why a day with a deficit or surplus on its known entries only is left out: which kind was unknown. */
function unknownEntryWhy(d: WeekDay): string {
  const meal = d.view.meals.some((m) => !isKnownMeal(m))
  const workout = d.view.workouts.some((w) => !isKnownWorkout(w))
  if (meal && workout) return copy.week.why.unknownEntry
  return meal ? copy.week.why.unknownMeal : copy.week.why.unknownWorkout
}

/** A night with both times logged but no length (its sleep time is its wake time): left out, not "not logged". */
function noLength(n: Night | null): boolean {
  return n !== null && n.sleepStart !== null && n.wake !== null && n.minutes === null
}
