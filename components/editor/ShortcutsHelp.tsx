"use client";

import { useState } from "react";
import { IconKeyboard, IconX } from "@tabler/icons-react";

export function ShortcutsHelp() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-all"
        title="Keyboard shortcuts"
      >
        <IconKeyboard size={18} />
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-2 w-64 rounded-xl border border-border bg-background shadow-xl z-50">
          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Shortcuts</p>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded hover:bg-muted text-muted-foreground"
            >
              <IconX size={14} />
            </button>
          </div>
          <div className="p-3 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span>Delete selected node</span>
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border">Del</kbd>
            </div>
            <div className="flex items-center justify-between">
              <span>Close properties panel</span>
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border">Esc</kbd>
            </div>
            <div className="flex items-center justify-between">
              <span>Duplicate selected node</span>
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border">Ctrl + D</kbd>
            </div>
            <div className="flex items-center justify-between">
              <span>Open node search</span>
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border">/</kbd>
            </div>
            <div className="flex items-center justify-between">
              <span>Open command search</span>
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border">Ctrl/Cmd + K</kbd>
            </div>
            <div className="flex items-center justify-between">
              <span>Toggle sidebar</span>
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border">Ctrl/Cmd + B</kbd>
            </div>
            <div className="flex items-center justify-between">
              <span>Zoom in canvas</span>
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border">Ctrl/Cmd + +</kbd>
            </div>
            <div className="flex items-center justify-between">
              <span>Zoom out canvas</span>
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border">Ctrl/Cmd + -</kbd>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
