"use client";

import { useEffect, useMemo, useState } from "react";
import { IconCheck, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface OnboardingChecklistProps {
  surveyId: string;
  hasQuestion: boolean;
  hasConfiguredSettings: boolean;
  hasRunTest: boolean;
}

export function OnboardingChecklist({
  surveyId,
  hasQuestion,
  hasConfiguredSettings,
  hasRunTest,
}: OnboardingChecklistProps) {
  const [dismissed, setDismissed] = useState(false);

  const dismissKey = `builder:onboarding:${surveyId}`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(localStorage.getItem(dismissKey) === "dismissed");
  }, [dismissKey]);

  const steps = useMemo(
    () => [
      { label: "Add your first question", done: hasQuestion },
      { label: "Configure survey settings", done: hasConfiguredSettings },
      { label: "Run test survey once", done: hasRunTest },
    ],
    [hasQuestion, hasConfiguredSettings, hasRunTest]
  );

  const allDone = steps.every((step) => step.done);
  if (dismissed || allDone) return null;

  return (
    <div className="absolute top-4 left-4 z-40 w-80 rounded-xl border border-border bg-background/95 backdrop-blur shadow-lg">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Getting Started
        </h3>
        <button
          onClick={() => {
            if (typeof window !== "undefined") {
              localStorage.setItem(dismissKey, "dismissed");
            }
            setDismissed(true);
          }}
          className="p-1 rounded hover:bg-muted text-muted-foreground"
          title="Dismiss checklist"
        >
          <IconX size={14} />
        </button>
      </div>
      <div className="p-4 space-y-2">
        {steps.map((step) => (
          <div
            key={step.label}
            className={cn(
              "flex items-center gap-2 text-sm",
              step.done ? "text-foreground" : "text-muted-foreground"
            )}
          >
            <span
              className={cn(
                "w-5 h-5 rounded-full border inline-flex items-center justify-center",
                step.done
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600"
                  : "bg-muted border-border text-muted-foreground"
              )}
            >
              {step.done ? <IconCheck size={12} /> : null}
            </span>
            {step.label}
          </div>
        ))}
      </div>
    </div>
  );
}

