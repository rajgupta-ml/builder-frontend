"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { captureException, initBehaviorTracking } from "@/lib/observability";

const GENERIC_MESSAGE = "Something unexpected happened. Please retry.";

export function ReliabilityProvider({ children }: { children: React.ReactNode }) {
  const lastToastRef = useRef<{ key: string; ts: number }>({ key: "", ts: 0 });

  useEffect(() => {
    initBehaviorTracking();

    const shouldNotify = (key: string) => {
      const now = Date.now();
      if (lastToastRef.current.key === key && now - lastToastRef.current.ts < 3000) {
        return false;
      }
      lastToastRef.current = { key, ts: now };
      return true;
    };

    const onError = (event: ErrorEvent) => {
      const key = `${event.message}:${event.filename}:${event.lineno}:${event.colno}`;
      if (shouldNotify(key)) {
        toast.error(GENERIC_MESSAGE);
      }
      void captureException(event.error ?? new Error(event.message), {
        operation: "window.error",
        route: window.location.pathname,
        extra: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason =
        event.reason instanceof Error
          ? event.reason.message
          : typeof event.reason === "string"
          ? event.reason
          : "Unhandled promise rejection";

      if (shouldNotify(reason)) {
        toast.error(GENERIC_MESSAGE);
      }
      void captureException(event.reason, {
        operation: "window.unhandledrejection",
        route: window.location.pathname,
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return <>{children}</>;
}

