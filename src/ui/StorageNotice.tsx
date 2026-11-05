// spec.md > Important Failure Modes ("localStorage is full or blocked") and spec.md > Store
// (a document that fails to parse is never silently wiped). Build-out item 1.1 adds a log
// saved by a newer version, and an upgraded log whose original couldn't be backed up (which
// can't be saved, so it reads as blocked). All of them keep the app working in memory.
import type { LogProblem } from '../store/session'
import { copy } from './copy'

interface StorageNoticeProps {
  blocked: boolean
  /** Why the open log's saved copy is left as it is, if it is. */
  problem: LogProblem | null
}

export function StorageNotice({ blocked, problem }: StorageNoticeProps) {
  const showBlocked = blocked || problem === 'notBackedUp'
  if (!showBlocked && problem !== 'unreadable' && problem !== 'newer') return null
  return (
    <div className="storage-notice" role="status">
      <div className="storage-notice-inner">
        {problem === 'unreadable' && <p data-testid="storage-unreadable">{copy.storage.unreadable}</p>}
        {problem === 'newer' && <p data-testid="storage-newer">{copy.storage.newer}</p>}
        {showBlocked && <p data-testid="storage-blocked">{copy.storage.blocked}</p>}
      </div>
    </div>
  )
}
