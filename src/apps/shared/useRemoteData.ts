import { useEffect, useState } from "react";

export type RemoteData<T> = { status: "loading" } | { status: "error" } | { status: "ready"; data: T };

// Each visible selection owns one request; changing selections cancels the previous one.
export function useRemoteData<T>(url: string, revision = 0): RemoteData<T> {
  const [result, setResult] = useState<{ url: string; revision: number; value: RemoteData<T> }>({ url, revision, value: { status: "loading" } });
  useEffect(() => {
    const controller = new AbortController();
    setResult({ url, revision, value: { status: "loading" } });
    fetch(url, { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<T>;
      })
      .then(data => setResult({ url, revision, value: { status: "ready", data } }))
      .catch(() => {
        if (!controller.signal.aborted) setResult({ url, revision, value: { status: "error" } });
      });
    return () => controller.abort();
  }, [url, revision]);
  return result.url === url && result.revision === revision ? result.value : { status: "loading" };
}
