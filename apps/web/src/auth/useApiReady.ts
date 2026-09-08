import { useCallback, useEffect, useState } from "react";
import { waitUntilReady, type ApiReadyStatus } from "./api-ready";

export type { ApiReadyStatus };

export function useApiReady(): {
  status: ApiReadyStatus;
  retry: () => void;
} {
  const [status, setStatus] = useState<ApiReadyStatus>("checking");
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    const abort = new AbortController();
    setStatus("checking");
    void waitUntilReady({ signal: abort.signal })
      .then((result) => {
        if (!abort.signal.aborted) setStatus(result);
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        if (!abort.signal.aborted) setStatus("failed");
      });
    return () => abort.abort();
  }, [generation]);

  const retry = useCallback(() => {
    setGeneration((n) => n + 1);
  }, []);

  return { status, retry };
}
