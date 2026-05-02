import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

type Status = "checking" | "slow" | "ready" | "dismissed";

const SLOW_THRESHOLD_MS = 1500;
const DISMISS_AFTER_READY_MS = 2500;

export function ColdStartBanner() {
  const [status, setStatus] = useState<Status>("checking");
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number>(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    slowTimerRef.current = setTimeout(() => {
      setStatus((s) => (s === "checking" ? "slow" : s));
    }, SLOW_THRESHOLD_MS);

    const pingApi = async () => {
      try {
        const base = (import.meta.env.VITE_API_URL as string) ?? "";
        await fetch(`${base}/api/healthz`, { signal: controller.signal });

        if (slowTimerRef.current) clearTimeout(slowTimerRef.current);

        setStatus((s) => {
          if (s === "dismissed") return "dismissed";
          if (s === "slow") {
            dismissTimerRef.current = setTimeout(
              () => setStatus("dismissed"),
              DISMISS_AFTER_READY_MS,
            );
            return "ready";
          }
          return "dismissed";
        });
      } catch {
        // ignore AbortError or network errors
      }
    };

    pingApi();

    return () => {
      controller.abort();
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (status === "slow") {
      startRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [status]);

  if (status === "checking" || status === "dismissed") return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between gap-3 px-4 py-3 bg-amber-950/90 border-b border-amber-800/60 backdrop-blur-sm text-sm text-amber-200 shadow-lg">
      <div className="flex items-center gap-3 min-w-0">
        {status === "slow" ? (
          <>
            <span className="relative flex-shrink-0 h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-400" />
            </span>
            <span className="truncate">
              <span className="font-semibold text-amber-100">API is waking up</span>
              <span className="text-amber-300"> — Render free tier spins down after inactivity. Usually takes 20–40 seconds.</span>
              {elapsed > 0 && (
                <span className="ml-2 tabular-nums text-amber-400 font-mono text-xs">
                  {elapsed}s…
                </span>
              )}
            </span>
          </>
        ) : (
          <>
            <span className="flex-shrink-0 text-green-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </span>
            <span className="font-semibold text-green-300">API is ready</span>
          </>
        )}
      </div>
      <button
        onClick={() => setStatus("dismissed")}
        aria-label="Dismiss"
        className="flex-shrink-0 text-amber-400 hover:text-amber-100 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
