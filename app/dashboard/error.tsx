"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { reportError } from "@/lib/error-reporter";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    toast.error("Dashboard failed to load. Please retry.");
    reportError({
      kind: "runtime",
      message: error.message || "Dashboard route error",
      stack: error.stack,
      details: { digest: error.digest, segment: "dashboard" },
    });
  }, [error]);

  return (
    <div className="h-full min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-card border border-border rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold">Dashboard Error</h2>
        <p className="text-sm text-muted-foreground">
          We could not render this dashboard view right now.
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

