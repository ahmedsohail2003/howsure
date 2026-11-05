// In-memory stand-ins for window.localStorage, shared by the store tests.
import type { ListableStore } from '../storage'

export class MemoryStore implements ListableStore {
  data = new Map<string, string>()
  /** Every setItem and removeItem, in order, so a test can check what was written first. */
  writes: string[] = []
  getItem(k: string) {
    return this.data.has(k) ? (this.data.get(k) as string) : null
  }
  setItem(k: string, v: string) {
    this.writes.push(k)
    this.data.set(k, String(v))
  }
  removeItem(k: string) {
    this.writes.push(`remove ${k}`)
    this.data.delete(k)
  }
  get length() {
    return this.data.size
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null
  }
  /** A copy of everything stored, for before/after comparisons. */
  snapshot(): Record<string, string> {
    return Object.fromEntries(this.data)
  }
}
