import { useCallback, useEffect, useState } from "react"

import { getJson } from "../services/transaction-service"

export interface FetchState<T> {
  /** Latest successful result. Kept while the next request loads, so the UI doesn't flash empty. */
  data: T | undefined
  error: Error | undefined
  loading: boolean
  retry: () => void
}

// Fetches `url` whenever it changes. The URL is the whole cache key: it encodes the
// page, page size and search, so a change to any of them triggers a new request.
export const useFetch = <T>(url: string): FetchState<T> => {
  const [data, setData] = useState<T>()
  const [error, setError] = useState<Error>()
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    // Aborting on cleanup means only the latest request can update state: a slow
    // response for an old URL can't overwrite a newer one.
    const controller = new AbortController()
    setLoading(true)
    setError(undefined)

    getJson<T>(url, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return
        setData(result)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err : new Error(String(err)))
        setLoading(false)
      })

    return () => controller.abort()
  }, [url, attempt])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  return { data, error, loading, retry }
}
