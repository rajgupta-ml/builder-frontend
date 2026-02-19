"use client";

import { useMemo, useState } from "react";
import { IconAlertCircle, IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface ValidationIssue {
  type: "error" | "warning";
  message: string;
  nodeId?: string;
}

interface ValidationDrawerProps {
  issues: ValidationIssue[];
  onFocusNode: (nodeId: string) => void;
}

export function ValidationDrawer({ issues, onFocusNode }: ValidationDrawerProps) {
  const [open, setOpen] = useState(true);

  const errorCount = useMemo(
    () => issues.filter((issue) => issue.type === "error").length,
    [issues]
  );

  if (issues.length === 0) return null;

  return (
    <div className="absolute top-20 right-4 z-40 w-[360px] rounded-xl border border-amber-500/30 bg-background shadow-lg">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="w-full px-4 py-3 border-b border-border flex items-center justify-between hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm">
          <IconAlertCircle size={16} className="text-amber-500" />
          <span className="font-semibold">{errorCount} publish issues found</span>
        </div>
        {open ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
      </button>
      {open && (
        <div className="max-h-64 overflow-y-auto p-2">
          {issues.map((issue, idx) => (
            <button
              key={`${issue.message}-${idx}`}
              onClick={() => issue.nodeId && onFocusNode(issue.nodeId)}
              disabled={!issue.nodeId}
              className={cn(
                "w-full text-left rounded-lg px-3 py-2 mb-1 text-xs border transition-colors",
                issue.nodeId
                  ? "border-border hover:bg-muted cursor-pointer"
                  : "border-border bg-muted/30 cursor-default"
              )}
            >
              <span className="font-semibold mr-1">
                {issue.type === "error" ? "Error:" : "Warning:"}
              </span>
              {issue.message}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

