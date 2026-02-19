"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { reportError } from "@/lib/error-reporter";

export default function GlobalRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    toast.error("We hit an unexpected issue. Please try again.");
    reportError({
      kind: "runtime",
      message: error.message || "Route error",
      stack: error.stack,
      details: { digest: error.digest },
    });
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          The page failed to render. You can retry without losing the full app session.
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

