import { useSyncExternalStore } from 'react'

function subscribe(listener: () => void): () => void {
  window.addEventListener('hashchange', listener)
  return () => window.removeEventListener('hashchange', listener)
}

function getPath(): string {
  return window.location.hash.replace(/^#/, '') || '/'
}

/** Tiny hash router: pages are addressed as `#/questions`, `#/practice/<id>` … */
export function useHashRoute(): string {
  return useSyncExternalStore(subscribe, getPath)
}
