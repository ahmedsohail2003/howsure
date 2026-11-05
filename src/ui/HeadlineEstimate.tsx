// spec.md > Screens > HeadlineEstimate.tsx: the calorie or net headline, both ranges and the
// tappable estimate score (prd.md > Dashboard). The number dominates.
// prd.md > Days With Unknown Calories and > States and Boundaries: a partly known day shows
// the known subtotal labelled "Known meals only — incomplete day" with the unknown count; a day
// with no known calories (every meal unknown, or nothing logged) says "Not available yet" for
// calories, ranges and score, never a zero or a perfect score. A typed 0 is known, so a day of
// 0 kcal meals shows 0 kcal, with ranges and score not available (there is nothing to divide by).
// A daily calorie target, when set, is a plain line beside the score (build-out item 1.3): no
// verdict and no room-left sum, which come with their own slices.
//
// Build-out item 2.5a (slice 10; prd.md > Workouts and Net Calories): with a workout on the day,
// the headline is net calories (eaten − burned) with its own ranges, and eaten and burned sit under
// it as single numbers, each a button that opens its detail (the meals; the workouts). Net's ranges
// open the net explanation. The score stays the eaten score, labelled so. Every number and word
// comes from headlineView.ts, worked out once; the looks below only draw it.
//
// Build-out item 1.5.2, Journal look: the score is a small pill beside the target, and the two
// ranges are one labelled range bar (very likely outer, likely inner, a marker for the best
// estimate and one for the target) with a text legend that keeps every number as text. The bar
// is drawn for the eye only (aria-hidden); screen readers and tests read the legend. The bar is
// drawn only for a complete day: on an incomplete day the ranges cover the known meals only, so
// a bar would look surer than the day is, and the legend says why there is none. Once net is the
// headline, the bar shows net (its scale may start below 0, and then a labelled tick marks 0) and
// leaves the target marker off: the target is for calories eaten, which the target line beside the
// score says. The bar's note and the resting-burn note share one line under the bar.
//
// Build-out item 1.5.2b, Panel look (PanelHeadline below): the same numbers in a tile. The
// headline sits inside a target ring that shows the best estimate only, as a share of the daily
// calorie target, with the share in words ("95% of 2,400"); both ranges and the score sit beside
// it, each still opening its explanation. The ring is filled only for a complete day with a
// target: with no target it says "No target" and offers the targets editor (a target is never
// invented), and on an incomplete or unknown day it stays empty, with the same status words as
// Journal, so it never looks surer than the day is. Over the target it is full and the words give
// the real share. Once net is the headline, net sits in the centre labelled "kcal net", and the
// ring keeps comparing calories eaten with the target: that is said under the ring, apart from the
// number ("Ring: eaten, 95% of 2,400"), so the centre never reads as eaten. Eaten and burned sit
// under the ring, each opening its detail.
//
// Build-out item 1.5.2c, Night look (NightHeadline below): a big thin number, both ranges on one
// line under it ("likely 1,870–2,780 · very likely 1,684–3,087", one tap target that opens the
// range explanation), and chips for the score, the calorie target and the macros. The score chip
// opens its explanation, the target chip the targets editor (or offers to set a target when there
// is none), and the macro chip shows each macro with its target and any missing entries. Once net
// is the headline, eaten and burned are chips too, each opening its detail.

import type { MacroKey, MacroTotal } from '../kernel/types'
import type { Profile } from '../store/log'
import { copy } from './copy'
import type { DayView } from './dayView'
import { fmtAmount, fmtInt } from './format'
import { headlineView, type HeadlineOpen, type HeadlineView } from './headlineView'
import { useLook } from './lookContext'
import { NightMacros } from './MacroRow'
import { rangeBarGeometry } from './rangeBar'
import { Ring } from './Ring'
import { ringFill } from './targetRing'

interface HeadlineEstimateProps {
  view: DayView
  onOpen: (mode: HeadlineOpen) => void
  /** False on an earlier waking day (prd.md > Previous Days), so the label doesn't say "today". */
  today?: boolean
  /** The daily calorie target, when one is set (build-out item 1.3). */
  targetKcal?: number
  /** Opens the targets editor (Panel look, when no calorie target is set). */
  onSetTarget?: () => void
  /** Names the viewed day; the Panel ring draws itself in again when it changes. */
  dayKey?: string
  /** The day's macros and the log's targets: the Night look draws them as a chip here. */
  macros?: Record<MacroKey, MacroTotal>
  targets?: Profile['targets']
}

interface LookProps extends HeadlineEstimateProps {
  hv: HeadlineView
}

export function HeadlineEstimate(props: HeadlineEstimateProps) {
  const { look } = useLook()
  const hv = headlineView(props.view, props.today ?? true)
  if (look === 'night') return <NightHeadline {...props} hv={hv} />
  return look === 'panel' ? <PanelHeadline {...props} hv={hv} /> : <JournalHeadline {...props} hv={hv} />
}

/** The headline number, or "Not available yet". */
function HeadlineNumber({ hv, long = false, unit = copy.units.kcal }: { hv: HeadlineView; long?: boolean; unit?: string }) {
  if (hv.value === null) {
    return (
      <p className="headline-na" data-testid="headline-kcal">
        {copy.headline.notAvailable}
      </p>
    )
  }
  return (
    <p className={long && hv.valueText.length > 5 ? 'headline-number num long' : 'headline-number num'}>
      <span data-testid="headline-kcal">{hv.valueText}</span>
      <span className="unit">{unit}</span>
    </p>
  )
}

/** The incomplete-day pill and the unknown counts (meals, and workouts once net is the headline). */
function DayStatus({ hv }: { hv: HeadlineView }) {
  if (!hv.status) return null
  return (
    <p className="day-status" data-testid="day-status">
      {hv.status.pill && <span className="status-pill">{hv.status.pill}</span>}
      {hv.status.counts.map((c) => (
        <span key={c.kind} className="status-count" data-testid={c.kind === 'meals' ? 'unknown-count' : 'unknown-workout-count'}>
          {c.text}
        </span>
      ))}
    </p>
  )
}

/** The score as a tappable pill that opens its explanation, or "Not available yet". */
function DayScore({ hv, onOpen }: { hv: HeadlineView; onOpen: (mode: HeadlineOpen) => void }) {
  return hv.score !== null ? (
    <button type="button" className="btn score-btn num" onClick={() => onOpen({ mode: 'day' })} data-testid="day-score">
      {hv.scoreText}
    </button>
  ) : (
    <p className="score-na" data-testid="day-score-na">
      {hv.scoreText}
    </p>
  )
}

/**
 * Eaten and burned under the net headline, each a button that opens its detail. Drawn as a row of
 * two in Journal and Panel; Night draws them as chips (NightHeadline).
 */
function NetParts({ hv, onOpen }: { hv: HeadlineView; onOpen: (mode: HeadlineOpen) => void }) {
  return (
    <div className="net-parts num" data-testid="net-parts">
      <button type="button" className="net-part" onClick={() => onOpen({ mode: 'eaten' })} aria-label={hv.eaten.label} data-testid="headline-eaten">
        <span className="net-part-name">{copy.net.eaten}</span>
        <span className={hv.eaten.value === null ? 'net-part-value unknown' : 'net-part-value'}>{hv.eaten.text}</span>
        <span className="net-part-arrow" aria-hidden="true">
          {copy.arrow}
        </span>
      </button>
      <button type="button" className="net-part" onClick={() => onOpen({ mode: 'workouts' })} aria-label={hv.burned.label} data-testid="headline-burned">
        <span className="net-part-name">{copy.net.burned}</span>
        <span className={hv.burned.value === null ? 'net-part-value unknown' : 'net-part-value'}>{hv.burned.text}</span>
        <span className="net-part-arrow" aria-hidden="true">
          {copy.arrow}
        </span>
      </button>
    </div>
  )
}

function RangesNotAvailable() {
  const na = copy.headline.notAvailable
  return (
    <div className="range-legend na" data-testid="ranges-na">
      <p className="range-row" data-testid="likely-range">
        <span className="range-name">{copy.headline.likely}</span>
        <span className="range-value">{na}</span>
      </p>
      <p className="range-row" data-testid="very-likely-range">
        <span className="range-name">{copy.headline.veryLikely}</span>
        <span className="range-value">{na}</span>
      </p>
    </div>
  )
}

function JournalHeadline({ hv, onOpen, targetKcal }: LookProps) {
  const bar =
    hv.bar && hv.value !== null
      ? rangeBarGeometry(hv.value, hv.likely, hv.veryLikely, hv.barTarget ? targetKcal : undefined, { signed: hv.net })
      : null

  return (
    <section className="headline" aria-label={hv.label} data-mode={hv.net ? 'net' : 'eaten'} data-testid="headline">
      <p className="headline-label">{hv.label}</p>

      <HeadlineNumber hv={hv} />
      {hv.net && <NetParts hv={hv} onOpen={onOpen} />}
      <DayStatus hv={hv} />

      <div className="headline-meta">
        <DayScore hv={hv} onOpen={onOpen} />

        {targetKcal !== undefined && (
          <p className="headline-target num" data-testid="headline-target">
            {hv.net ? copy.targets.headlineEaten(fmtAmount(targetKcal)) : copy.targets.headline(fmtAmount(targetKcal))}
          </p>
        )}
      </div>

      {hv.likelyText && hv.veryLikelyText && hv.value !== null ? (
        // One tap target for the bar and its legend: it opens the range (or net) explanation.
        <button type="button" className="range-summary" onClick={() => onOpen(hv.explain)} data-testid="ranges">
          {bar && (
            <span className={bar.zero !== null ? 'range-bar has-zero' : 'range-bar'} aria-hidden="true" data-testid="range-bar">
              <span className="range-track" />
              <span
                className="range-band very-likely-band"
                style={{ left: `${bar.veryLikely.left}%`, width: `${bar.veryLikely.width}%` }}
              />
              <span className="range-band likely-band" style={{ left: `${bar.likely.left}%`, width: `${bar.likely.width}%` }} />
              {bar.target !== null && <span className="range-target" style={{ left: `${bar.target}%` }} />}
              {bar.zero !== null && (
                <>
                  <span className="range-zero" style={{ left: `${bar.zero}%` }} data-testid="range-zero" />
                  <span className="range-zero-label num" style={{ left: `${bar.zero}%` }}>
                    {copy.net.zero}
                  </span>
                </>
              )}
              <span className="range-best" style={{ left: `${bar.best}%` }} />
            </span>
          )}
          <span className="range-legend num">
            <span className="range-row" data-testid="likely-range">
              <span className="range-name">
                {bar && <span className="range-swatch likely-band" aria-hidden="true" />}
                {copy.headline.likely}
              </span>
              <span className="range-value">{hv.likelyText}</span>
            </span>
            <span className="range-row" data-testid="very-likely-range">
              <span className="range-name">
                {bar && <span className="range-swatch very-likely-band" aria-hidden="true" />}
                {copy.headline.veryLikely}
              </span>
              <span className="range-value">{hv.veryLikelyText}</span>
            </span>
            {bar && (
              <span className="range-row" data-testid="best-estimate">
                <span className="range-name">
                  <span className="range-swatch range-best" aria-hidden="true" />
                  {copy.headline.bestEstimate}
                </span>
                <span className="range-value">{copy.units.kcalValue(hv.valueText)}</span>
              </span>
            )}
            {bar && bar.target !== null && targetKcal !== undefined && (
              <span className="range-row" data-testid="range-target">
                <span className="range-name">
                  <span className="range-swatch range-target" aria-hidden="true" />
                  {copy.headline.target}
                </span>
                <span className="range-value">{copy.units.kcalValue(fmtAmount(targetKcal))}</span>
              </span>
            )}
          </span>
          {hv.rangesNote && (
            <span className="range-note" data-testid="ranges-known-only">
              {hv.net ? hv.rangesNote.short : hv.rangesNote.long}
            </span>
          )}
        </button>
      ) : (
        <RangesNotAvailable />
      )}

      {/* One line of notes under the net headline: what the bar shows, and that resting burn is not counted. */}
      {hv.net && (
        <p className="net-resting small">
          {bar && targetKcal !== undefined && (
            <>
              <span data-testid="net-bar-note">{copy.net.barNote}</span>{' '}
            </>
          )}
          <span data-testid="net-resting">{copy.net.restingShort}</span>
        </p>
      )}
    </section>
  )
}

function PanelHeadline({ hv, onOpen, targetKcal, onSetTarget, dayKey }: LookProps) {
  // Only a complete day fills the ring: on an incomplete day the known meals are part of it only.
  // The ring always compares calories eaten with the target, which is a target for eating.
  const share = ringFill(hv.ringValue, targetKcal)
  const eatenPartial = hv.eaten.value !== null && hv.ringValue === null

  return (
    <section className="headline panel-hero" aria-label={hv.label} data-mode={hv.net ? 'net' : 'eaten'} data-testid="headline">
      <p className="headline-label">{hv.label}</p>

      <div className="hero-grid">
        <div className="ring-col">
          <div className="target-ring" data-testid="target-ring" data-fill={share ? String(share.fill) : 'none'}>
            <Ring key={dayKey} size={132} stroke={10} fill={share ? share.fill : null} />
            <div className="ring-centre">
              {/* Net in the centre is labelled so ("kcal net"); what the ring itself shows (eaten
                  against the target) is said under the ring, apart from the number. */}
              <HeadlineNumber hv={hv} long unit={hv.net ? copy.panel.ringNetUnit : copy.units.kcal} />
              {!hv.net && <RingWords share={share} targetKcal={targetKcal} net={false} />}
            </div>
          </div>
          {hv.net && <RingWords share={share} targetKcal={targetKcal} net />}
        </div>

        <div className="hero-side">
          {hv.likelyText && hv.veryLikelyText ? (
            <button type="button" className="range-summary" onClick={() => onOpen(hv.explain)} data-testid="ranges">
              <span className="range-legend num">
                <span className="range-row" data-testid="likely-range">
                  <span className="range-name">{copy.headline.likely}</span>
                  <span className="range-value">{hv.likelyText}</span>
                </span>
                <span className="range-row" data-testid="very-likely-range">
                  <span className="range-name">{copy.headline.veryLikely}</span>
                  <span className="range-value">{hv.veryLikelyText}</span>
                </span>
              </span>
              {hv.rangesNote && (
                <span className="range-note" data-testid="ranges-known-only">
                  {hv.rangesNote.short}
                </span>
              )}
            </button>
          ) : (
            <RangesNotAvailable />
          )}
          {!hv.net && (
            <div className="headline-meta">
              <DayScore hv={hv} onOpen={onOpen} />
            </div>
          )}
        </div>
      </div>

      {/* Net headline: eaten and burned under the ring, and the eaten score with them. */}
      {hv.net && (
        <>
          <NetParts hv={hv} onOpen={onOpen} />
          <div className="headline-meta">
            <DayScore hv={hv} onOpen={onOpen} />
          </div>
        </>
      )}
      <DayStatus hv={hv} />

      {share && !hv.net && (
        <p className="ring-note" data-testid="ring-note">
          {copy.panel.ringNote}
        </p>
      )}
      {eatenPartial && targetKcal !== undefined && (
        <p className="ring-note" data-testid="ring-known-only">
          {hv.net ? copy.panel.ringKnownOnlyEaten : copy.panel.ringKnownOnly}
        </p>
      )}
      {/* Net headline: what the ring shows and that resting burn is not counted, as one note. */}
      {hv.net && (
        <p className="ring-note">
          {share && (
            <>
              <span data-testid="ring-note">{copy.panel.ringNoteEaten}</span>{' '}
            </>
          )}
          <span data-testid="net-resting">{copy.net.restingShort}</span>
        </p>
      )}

      {targetKcal === undefined && onSetTarget && (
        <button type="button" className="btn btn-quiet ring-set-target" onClick={onSetTarget} data-testid="ring-set-target">
          {copy.targets.setKcal}
        </button>
      )}
    </section>
  )
}

/**
 * What the Panel ring shows. With calories eaten as the headline it sits in the ring under the
 * number ("95% of 2,400"). Once net is the headline it sits under the ring, apart from the net
 * number in it, and says the ring is eaten ("Ring: eaten, 95% of 2,400").
 */
function RingWords({ share, targetKcal, net }: { share: { pct: number } | null; targetKcal?: number; net: boolean }) {
  return (
    <p className={net ? 'ring-words ring-caption num' : 'ring-words num'} data-testid="ring-words">
      {share ? (
        <>
          {net && <>{copy.panel.ringEatenLead} </>}
          <span className={net ? 'nowrap' : undefined}>{copy.panel.ringShare(String(share.pct), fmtAmount(targetKcal as number))}</span>
          <span className="visually-hidden">{copy.panel.ringShareHidden}</span>
        </>
      ) : targetKcal !== undefined ? (
        net ? copy.targets.shortEaten(fmtAmount(targetKcal)) : copy.targets.short(fmtAmount(targetKcal))
      ) : (
        copy.panel.noTarget
      )}
    </p>
  )
}

function NightHeadline({ hv, onOpen, targetKcal, onSetTarget, macros, targets, view }: LookProps) {
  return (
    <section className="headline night-hero" aria-label={hv.label} data-mode={hv.net ? 'net' : 'eaten'} data-testid="headline">
      <p className="headline-label">{hv.label}</p>

      <HeadlineNumber hv={hv} />
      <DayStatus hv={hv} />

      {hv.likelyShort && hv.veryLikelyShort ? (
        <button type="button" className="range-summary night-ranges num" onClick={() => onOpen(hv.explain)} data-testid="ranges">
          <span className="night-range" data-testid="likely-range">
            {copy.night.likely} <b>{hv.likelyShort}</b>
            <span className="visually-hidden">{copy.night.rangeUnitHidden}</span>
          </span>
          <span className="night-range-sep" aria-hidden="true">
            {copy.sep}
          </span>
          <span className="night-range" data-testid="very-likely-range">
            {copy.night.veryLikely} <b>{hv.veryLikelyShort}</b>
            <span className="visually-hidden">{copy.night.rangeUnitHidden}</span>
          </span>
          {hv.rangesNote && (
            <span className="range-note" data-testid="ranges-known-only">
              {hv.rangesNote.short}
            </span>
          )}
        </button>
      ) : (
        <p className="night-ranges na" data-testid="ranges-na">
          {copy.night.rangesNotAvailable}
        </p>
      )}

      <div className="night-chips">
        {hv.net && (
          <>
            <button
              type="button"
              className="btn night-chip num"
              onClick={() => onOpen({ mode: 'eaten' })}
              aria-label={hv.eaten.label}
              data-testid="headline-eaten"
            >
              {copy.night.eatenChip(hv.eaten.value === null ? hv.eaten.text : fmtInt(hv.eaten.value))}
            </button>
            <button
              type="button"
              className="btn night-chip num"
              onClick={() => onOpen({ mode: 'workouts' })}
              aria-label={hv.burned.label}
              data-testid="headline-burned"
            >
              {copy.night.burnedChip(hv.burned.value === null ? hv.burned.text : fmtInt(hv.burned.value))}
            </button>
          </>
        )}
        <DayScore hv={hv} onOpen={onOpen} />
        {onSetTarget &&
          (targetKcal !== undefined ? (
            <button
              type="button"
              className="btn night-chip num"
              onClick={onSetTarget}
              aria-label={
                hv.net ? copy.night.targetChipLabelEaten(fmtAmount(targetKcal)) : copy.night.targetChipLabel(fmtAmount(targetKcal))
              }
              data-testid="headline-target"
            >
              {hv.net ? copy.targets.shortEaten(fmtAmount(targetKcal)) : copy.targets.short(fmtAmount(targetKcal))}
            </button>
          ) : (
            <button type="button" className="btn night-chip" onClick={onSetTarget} data-testid="set-kcal-target">
              {copy.targets.setKcal}
            </button>
          ))}
        {macros && view.day.status !== 'empty' && <NightMacros macros={macros} targets={targets} />}
      </div>

      {hv.net && (
        <p className="net-resting small" data-testid="net-resting">
          {copy.net.restingShort}
        </p>
      )}
    </section>
  )
}
