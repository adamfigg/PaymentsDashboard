import { useEffect, useState } from "react"

// Returns `value` once it has stopped changing for `delayMs`. Each change restarts
// the timer, so a burst of keystrokes produces a single update at the end.
export const useDebouncedValue = <T>(value: T, delayMs: number): T => {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
