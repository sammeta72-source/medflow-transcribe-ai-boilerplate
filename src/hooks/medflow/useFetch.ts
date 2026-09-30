"use client";
// Tiny SWR-like fetch hook for MedFlow client components.
import { useCallback, useEffect, useRef, useState } from "react";

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useFetch<T>(url: string | null): FetchState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(url));
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const urlRef = useRef(url);
  urlRef.current = url;

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const currentUrl = urlRef.current;
    if (!currentUrl) {
      // No URL — reflect that without an in-effect setState cascade by returning early.
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(currentUrl, { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.json();
      })
      .then((json) => {
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, tick]);

  return { data, loading, error, refresh };
}
