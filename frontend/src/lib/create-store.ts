/**
 * Minimal in-memory external store for `useSyncExternalStore`: the snapshot reference only
 * changes when `set`/`update` is called, so React sees a stable value between changes.
 */
export function createStore<T>(initial: T) {
  let state = initial
  const listeners = new Set<() => void>()

  return {
    getSnapshot: (): T => state,
    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    set(next: T): void {
      state = next
      listeners.forEach((listener) => listener())
    },
    update(change: (current: T) => T): void {
      this.set(change(state))
    },
  }
}
