// What would move, from which day to which day (build-out item 2.2): each entry with its own
// date and time, and a meal's calories (a workout reads "workout", a weigh-in "weigh-in" after its
// weight). The sleep and wake editor's
// move warning, its delete confirmation and "I woke up" all show moves with this one list.

import { copy } from './copy'
import { fmtInt, fmtWeekdayTime } from './format'
import { TimesTogether } from './KeepTogether'
import { moveGroupTitle, type MoveGroup } from './sleepEdit'

export function MoveList({ groups }: { groups: MoveGroup[] }) {
  return (
    <>
      {groups.map((g) => (
        <section key={`${g.from ?? 'none'}-${g.to ?? 'none'}`} className="regroup-group" data-testid="move-group">
          <div className="regroup-head">
            <h3 className="regroup-title">
              <TimesTogether text={moveGroupTitle(g)} />
            </h3>
          </div>
          <ul className="regroup-list">
            {g.entries.map((e) => (
              <li key={`${e.kind}-${e.id}`} data-testid="move-entry">
                <span className="regroup-time num">{fmtWeekdayTime(e.at)}</span>
                <span className="regroup-name">{e.name}</span>
                {/* A word ("workout", "unknown") is not set in the number style. */}
                <span className={e.kind === 'meal' && e.kcal !== null ? 'regroup-kcal num' : 'regroup-kcal'}>
                  {e.kind === 'workout'
                    ? copy.sleepEditor.workout
                    : e.kind === 'weigh-in'
                      ? copy.sleepEditor.weighIn
                      : e.kcal === null
                        ? copy.setWake.mealKcalUnknown
                        : copy.setWake.mealKcal(fmtInt(e.kcal))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}
