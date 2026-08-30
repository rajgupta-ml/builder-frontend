"use client";

import { IconArrowRight, IconRoute } from '@tabler/icons-react';
import type { FlowDebugCondition } from '@/lib/flowDebugger';
import { cn } from '@/lib/utils';

interface RoutePreviewPanelProps {
    conditions: FlowDebugCondition[];
    currentQuestion: string | null;
    embedded?: boolean;
}

export function RoutePreviewPanel({ conditions, currentQuestion, embedded = false }: RoutePreviewPanelProps) {
    if (conditions.length === 0) return null;

    return (
        <aside className={cn(
            'flex flex-col overflow-hidden bg-background/95',
            embedded
                ? 'min-h-0 w-[360px] shrink-0 border-l border-border'
                : 'absolute right-4 top-64 bottom-4 z-50 w-[360px] rounded-2xl border border-border shadow-xl backdrop-blur-md',
        )}>
            <header className="flex items-center gap-3 border-b border-border px-4 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-700">
                    <IconRoute size={18} />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <h3 className="text-xs font-bold text-foreground">Route preview</h3>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-semibold text-muted-foreground">{conditions.length}</span>
                    </div>
                    <p className="mt-0.5 truncate text-[10px] text-muted-foreground" title={currentQuestion || undefined}>
                        {currentQuestion ? `Routes controlled by “${currentQuestion}”` : 'Conditions for the active question'}
                    </p>
                </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <div className="space-y-2.5">
                    {conditions.map((condition, index) => (
                        <section key={`${condition.kind}-${condition.label}-${index}`} className="rounded-xl border border-border bg-background p-3">
                            <p className="text-[8px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{condition.label}</p>
                            <div className="mt-2 space-y-1.5 text-[10px]">
                                <div className="flex items-start gap-2">
                                    <span className="w-10 shrink-0 rounded-md bg-emerald-500/10 px-1.5 py-1 text-center text-[8px] font-bold text-emerald-700">IF</span>
                                    <span className="min-w-0 flex-1 break-words py-0.5 font-medium leading-4 text-foreground">{condition.expression}</span>
                                </div>
                                <div className="flex items-start gap-2">
                                    <IconArrowRight size={14} className="ml-3 mt-1 shrink-0 text-emerald-600" />
                                    <span className="min-w-0 flex-1 break-words rounded-md bg-emerald-500/10 px-2 py-1 font-semibold leading-4 text-emerald-800">{condition.result}</span>
                                </div>
                                {condition.fallback && (
                                    <div className="flex items-start gap-2 border-t border-border pt-1.5">
                                        <span className="w-10 shrink-0 rounded-md bg-muted px-1.5 py-1 text-center text-[8px] font-bold text-muted-foreground">ELSE</span>
                                        <span className="min-w-0 flex-1 break-words rounded-md bg-muted px-2 py-1 font-medium leading-4 text-foreground">{condition.fallback}</span>
                                    </div>
                                )}
                            </div>
                        </section>
                    ))}
                </div>
            </div>
        </aside>
    );
}
