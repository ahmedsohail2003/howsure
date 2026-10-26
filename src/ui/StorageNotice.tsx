// spec.md > Important Failure Modes ("localStorage is full or blocked") and spec.md > Store
// (a document that fails to parse is never silently wiped). Both keep the app working in memory.
import { copy } from './copy'

interface StorageNoticeProps {
  blocked: boolean
  unreadable: boolean
}

export function StorageNotice({ blocked, unreadable }: StorageNoticeProps) {
  if (!blocked && !unreadable) return null
  return (
    <div className="storage-notice" role="status">
      <div className="storage-notice-inner">
        {unreadable && <p data-testid="storage-unreadable">{copy.storage.unreadable}</p>}
        {blocked && <p data-testid="storage-blocked">{copy.storage.blocked}</p>}
      </div>
    </div>
  )
}
