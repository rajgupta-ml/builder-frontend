"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { reportError } from "@/lib/error-reporter";

export default function SurveyEditorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    toast.error("Builder crashed unexpectedly. Please retry.");
    reportError({
      kind: "runtime",
      message: error.message || "Survey editor error",
      stack: error.stack,
      details: { digest: error.digest, segment: "survey-editor" },
    });
  }, [error]);

  return (
    <div className="h-screen w-full flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full bg-card border border-border rounded-xl p-6 space-y-4 shadow-sm">
        <h2 className="text-lg font-semibold">Builder Error</h2>
        <p className="text-sm text-muted-foreground">
          The builder hit an unexpected issue. Retry to continue editing.
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium"
        >
          Retry Builder
        </button>
      </div>
    </div>
  );
}

