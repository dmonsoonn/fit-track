import { useCallback, useRef } from 'react'
import { useBeforeUnload, useBlocker } from 'react-router-dom'
import type { Blocker } from 'react-router-dom'

// Fallback for when useBlocker is unavailable (e.g. BrowserRouter without data-router).
// useBeforeUnload protects against browser close/refresh regardless.
export function useUnsavedGuard(): {
  setDirty: (v: boolean) => void
  blocker: Blocker
} {
  const dirty = useRef(false)

  const blocker = useBlocker(
    useCallback(
      () => dirty.current,
      // eslint-disable-next-line react-hooks/exhaustive-deps
      []
    )
  )

  useBeforeUnload(
    useCallback((e: BeforeUnloadEvent) => {
      if (dirty.current) e.preventDefault()
    }, [])
  )

  return {
    setDirty: (v: boolean) => { dirty.current = v },
    blocker,
  }
}
