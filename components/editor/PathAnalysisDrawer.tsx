"use client";

import { useState } from 'react';
import {
    IconAlertTriangle,
    IconArrowBackUp,
    IconCheck,
    IconRefresh,
    IconRoute,
    IconX,
} from '@tabler/icons-react';
import type { FlowDebugChoice } from '@/lib/flowDebugger';
import { cn } from '@/lib/utils';

interface PathAnalysisDrawerProps {
    hasRoutePreview: boolean;
    currentNodeId: string | null;
    currentQuestion: string | null;
    choices: FlowDebugChoice[];
    inputType: 'text' | 'number' | 'date' | 'email';
    allowCustom: boolean;
    onAnswer: (value: unknown, preferredLabel?: string) => void;
    answeredCount: number;
    pathLength: number;
    finished: boolean;
    outcome: string | null;
    error: string | null;
    canGoBack: boolean;
    onBack: () => void;
    onRestart: () => void;
    onClose: () => void;
}

interface AnswerComposerProps {
    choices: FlowDebugChoice[];
    inputType: PathAnalysisDrawerProps['inputType'];
    allowCustom: boolean;
    onAnswer: PathAnalysisDrawerProps['onAnswer'];
}

function AnswerComposer({ choices, inputType, allowCustom, onAnswer }: AnswerComposerProps) {
    const [customAnswer, setCustomAnswer] = useState('');
    const submitCustomAnswer = (event: React.FormEvent) => {
        event.preventDefault();
        if (customAnswer === '') return;
        onAnswer(inputType === 'number' ? Number(customAnswer) : customAnswer, customAnswer);
    };

    return (
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {choices.length > 0 && (
                <div className="flex max-h-28 min-w-0 flex-1 flex-wrap gap-1.5 overflow-y-auto py-0.5">
                    {choices.map((choice, index) => (
                        <button
                            key={`${choice.label}-${index}`}
                            type="button"
                            onClick={() => onAnswer(choice.value, choice.label)}
                            className={cn(
                                'max-w-[210px] truncate rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold transition-colors',
                                choice.tone === 'match'
                                    ? 'border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                                    : choice.tone === 'alternate'
                                        ? 'border-violet-200 bg-violet-50 text-violet-900 hover:bg-violet-100'
                                        : 'border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100',
                            )}
                            title={choice.label}
                        >
                            {choice.label}
                        </button>
                    ))}
                </div>
            )}
            {allowCustom ? (
                <form className="flex min-w-[230px] flex-1 gap-1.5" onSubmit={submitCustomAnswer}>
                    <input
                        value={customAnswer}
                        onChange={(event) => setCustomAnswer(event.target.value)}
                        type={inputType}
                        placeholder={choices.length > 0 ? 'Or enter a custom answer' : 'Enter an answer'}
                        className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[10px] outline-none transition-colors focus:border-sky-400"
                        autoFocus={choices.length === 0}
                    />
                    <button type="submit" className="rounded-lg bg-sky-600 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-sky-700">Use</button>
                </form>
            ) : choices.length === 0 ? (
                <button type="button" onClick={() => onAnswer(true, 'Continue')} className="rounded-lg bg-sky-600 px-4 py-1.5 text-[10px] font-bold text-white hover:bg-sky-700">Continue</button>
            ) : null}
        </div>
    );
}

export function PathAnalysisDrawer({
    hasRoutePreview,
    currentNodeId,
    currentQuestion,
    choices,
    inputType,
    allowCustom,
    onAnswer,
    answeredCount,
    pathLength,
    finished,
    outcome,
    error,
    canGoBack,
    onBack,
    onRestart,
    onClose,
}: PathAnalysisDrawerProps) {
    const isAnswering = Boolean(currentNodeId && currentQuestion && !finished && !error);

    return (
        <section className={cn(
            'absolute bottom-4 left-1/2 z-50 w-[calc(100%_-_2rem)] -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-background/95 shadow-xl backdrop-blur-md',
            hasRoutePreview ? 'max-w-[740px]' : 'max-w-[780px]',
        )}>
            <header className="flex h-14 items-center gap-3 px-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${error ? 'bg-amber-500/10 text-amber-700' : finished ? 'bg-emerald-500/10 text-emerald-700' : 'bg-sky-500/10 text-sky-700'}`}>
                    {error ? <IconAlertTriangle size={18} /> : finished ? <IconCheck size={18} /> : <IconRoute size={18} />}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-foreground">{error ? 'Flow needs attention' : finished ? (outcome || 'Journey complete') : 'Flow Tester'}</p>
                        {!error && <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-semibold text-muted-foreground">{answeredCount} answered · {pathLength} visited</span>}
                    </div>
                    <p className={`mt-0.5 truncate text-[10px] ${error ? 'text-amber-700' : 'text-muted-foreground'}`} title={error || currentQuestion || outcome || undefined}>
                        {error || (finished ? 'Use Back to change an answer and explore another route.' : 'Choose an answer to test the next route.')}
                    </p>
                </div>
                <button type="button" onClick={onBack} disabled={!canGoBack} className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:border-sky-300 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-40"><IconArrowBackUp size={14} /> Back</button>
                <button type="button" onClick={onRestart} className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:border-sky-300 hover:text-sky-700"><IconRefresh size={14} /> Restart</button>
                <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" title="Exit flow testing"><IconX size={17} /></button>
            </header>

            {isAnswering && (
                <div className="flex flex-col items-stretch gap-4 border-t border-border bg-muted/20 px-4 py-3 sm:flex-row sm:items-start">
                    <div className="shrink-0 sm:w-[185px]">
                        <p className="text-[8px] font-bold uppercase tracking-[0.08em] text-sky-700">Current question</p>
                        <p className="mt-0.5 truncate text-sm font-semibold text-foreground" title={currentQuestion || undefined}>{currentQuestion}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="mb-2 text-[8px] font-bold uppercase tracking-[0.08em] text-sky-700">Test answer</p>
                        <AnswerComposer
                            key={currentNodeId}
                            choices={choices}
                            inputType={inputType}
                            allowCustom={allowCustom}
                            onAnswer={onAnswer}
                        />
                    </div>
                </div>
            )}
        </section>
    );
}
