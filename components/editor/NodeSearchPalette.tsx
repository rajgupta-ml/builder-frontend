"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { IconSearch } from "@tabler/icons-react";
import { NODE_DEFINITIONS } from "@/components/nodes/definitions";

interface NodeSearchPaletteProps {
  isOpen: boolean;
  onSelectType: (nodeType: string, nodeLabel: string) => void;
  onClose: () => void;
}

export function NodeSearchPalette({
  isOpen,
  onSelectType,
  onClose,
}: NodeSearchPaletteProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const filteredNodes = useMemo(() => {
    const q = query.toLowerCase().trim();
    return NODE_DEFINITIONS
      .filter((definition) => {
        if (!q) return true;
        const label = String(definition.label || "").toLowerCase();
        const type = String(definition.type || "").toLowerCase();
        const description = String(definition.description || "").toLowerCase();
        return label.includes(q) || type.includes(q) || description.includes(q);
      })
      .slice(0, 24);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-[70] flex items-start justify-center pt-24">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" onClick={onClose} />
      <div className="relative w-[560px] max-w-[92vw] rounded-2xl border border-border bg-background shadow-2xl overflow-hidden">
        <div className="p-3 border-b border-border bg-muted/30">
          <div className="relative">
            <IconSearch
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && filteredNodes.length > 0) {
                  onSelectType(filteredNodes[0].type, filteredNodes[0].label);
                  onClose();
                }
              }}
              placeholder="Search available node types..."
              className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Press <kbd className="px-1 rounded border border-border bg-muted">Enter</kbd> to jump to first result.
          </p>
        </div>

        <div className="max-h-[380px] overflow-y-auto p-2">
          {filteredNodes.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No matching node types found.</div>
          ) : (
            filteredNodes.map((definition) => {
              const Icon = definition.icon || IconSearch;
              return (
                <button
                  key={definition.type}
                  onClick={() => {
                    onSelectType(definition.type, definition.label);
                    onClose();
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted transition-colors flex items-center gap-3"
                >
                  <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                    <Icon size={14} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{definition.label}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {definition.type} • {definition.description}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
