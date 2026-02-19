"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { reportError } from "@/lib/error-reporter";

const GENERIC_MESSAGE = "Something unexpected happened. Please retry.";

export function ReliabilityProvider({ children }: { children: React.ReactNode }) {
  const lastToastRef = useRef<{ key: string; ts: number }>({ key: "", ts: 0 });

  useEffect(() => {
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
      reportError({
        kind: "runtime",
        message: event.message || "Unhandled runtime error",
        stack: event.error?.stack,
        details: {
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
      reportError({
        kind: "unhandled_rejection",
        message: reason,
        stack: event.reason instanceof Error ? event.reason.stack : undefined,
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

