"use client";

import { useRef, useState, type ComponentType } from 'react';
import { runnerRegistry } from '@surveystudio/node-registery/runner';
import {
    IconAlertTriangle,
    IconArrowBackUp,
    IconCheck,
    IconRefresh,
    IconRoute,
    IconX,
} from '@tabler/icons-react';
import type { FlowDebugChoice, FlowDebugNode } from '@/lib/flowDebugger';
import type { FlowDebugCondition } from '@/lib/flowDebugger';
import { RoutePreviewPanel } from '@/components/editor/RoutePreviewPanel';
import { cn } from '@/lib/utils';

interface PathAnalysisDrawerProps {
    currentNode: FlowDebugNode | null;
    currentQuestion: string | null;
    choices: FlowDebugChoice[];
    conditions: FlowDebugCondition[];
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
    node: FlowDebugNode;
    choices: FlowDebugChoice[];
    onAnswer: PathAnalysisDrawerProps['onAnswer'];
}

const itemKey = (item: unknown, index: number) => {
    if (!item || typeof item !== 'object') return String(index);
    const record = item as Record<string, unknown>;
    return String(record.exportId || record.technicalId || record.value || record.id || index);
};

const initialRunnerValue = (node: FlowDebugNode): unknown => {
    const items = Array.isArray(node.data.items) ? node.data.items : [];
    const isMultiScale = node.data.responseMode === 'multi'
        || (node.data.responseMode !== 'single' && items.length > 0);
    if (['multipleChoice', 'ranking', 'cascadingChoice'].includes(node.type)) return [];
    if (['matrixChoice', 'multiInput'].includes(node.type)) return {};
    if (node.type === 'rating' && isMultiScale) return {};
    if (node.type !== 'slider') return undefined;

    const min = Number(node.data.min ?? 0);
    const max = Number(node.data.max ?? 100);
    const requested = Number(node.data.startValue ?? (min + max) / 2);
    const start = Math.min(max, Math.max(min, Number.isFinite(requested) ? requested : min));
    return isMultiScale
        ? Object.fromEntries(items.map((item, index) => [itemKey(item, index), start]))
        : start;
};

const fallbackInputType = (type: string) => {
    if (type === 'numberInput') return 'number';
    if (type === 'dateInput') return 'date';
    if (type === 'emailInput') return 'email';
    return 'text';
};

function FallbackAnswerComposer({ node, choices, onAnswer }: AnswerComposerProps) {
    const [customAnswer, setCustomAnswer] = useState('');
    const inputType = fallbackInputType(node.type);
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
        </div>
    );
}

function AnswerComposer({ node, choices, onAnswer }: AnswerComposerProps) {
    const initialValue = initialRunnerValue(node);
    const [value, setValue] = useState<unknown>(initialValue);
    const valueRef = useRef<unknown>(initialValue);
    const preferredLabelRef = useRef<string | undefined>(undefined);
    const registryEntry = runnerRegistry[node.type as keyof typeof runnerRegistry];
    const RunnerComponent = registryEntry?.Component as ComponentType<any> | undefined;
    const routeChoices = choices.filter((choice) => Boolean(choice.tone));

    if (!RunnerComponent) return <FallbackAnswerComposer node={node} choices={choices} onAnswer={onAnswer} />;

    const updateValue = (nextValue: unknown) => {
        preferredLabelRef.current = undefined;
        valueRef.current = nextValue;
        setValue(nextValue);
    };
    const chooseRouteValue = (choice: FlowDebugChoice) => {
        preferredLabelRef.current = choice.label;
        valueRef.current = choice.value;
        setValue(choice.value);
    };
    const continueFlow = () => {
        if (valueRef.current !== undefined) onAnswer(valueRef.current, preferredLabelRef.current);
    };
    const challenge = node.type === 'captcha' ? (
        <button
            type="button"
            onClick={() => updateValue(true)}
            className={cn(
                'rounded-lg border px-4 py-2 text-sm font-semibold transition-colors',
                value === true ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-border bg-background hover:border-sky-300',
            )}
        >
            {value === true ? 'Test verification complete' : 'Mark test verification complete'}
        </button>
    ) : undefined;

    return (
        <div className="min-w-0">
            {routeChoices.length > 0 && (
                <div className="mb-3 flex flex-wrap items-center gap-1.5 border-b border-border pb-3">
                    <span className="mr-1 text-[9px] font-semibold text-muted-foreground">Route shortcuts</span>
                    {routeChoices.map((choice, index) => (
                        <button
                            key={`${choice.label}-${index}`}
                            type="button"
                            onClick={() => chooseRouteValue(choice)}
                            className={cn(
                                'max-w-[210px] truncate rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold transition-colors',
                                choice.tone === 'match'
                                    ? 'border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                                    : 'border-violet-200 bg-violet-50 text-violet-900 hover:bg-violet-100',
                            )}
                            title={`Set answer to ${choice.label}`}
                        >
                            {choice.label}
                        </button>
                    ))}
                </div>
            )}
            <div className="max-h-[44vh] overflow-y-auto px-1 py-1">
                <RunnerComponent
                    data={node.data}
                    value={value}
                    onChange={updateValue}
                    onNext={continueFlow}
                    isActive
                    challenge={challenge}
                />
            </div>
        </div>
    );
}

export function PathAnalysisDrawer({
    currentNode,
    currentQuestion,
    choices,
    conditions,
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
    const isAnswering = Boolean(currentNode && currentQuestion && !finished && !error);

    return (
        <section className="relative z-50 flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-2xl border-t border-border bg-background/95 shadow-[0_-16px_50px_rgba(15,23,42,0.18)] backdrop-blur-md">
            <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-5">
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

            <div className="flex min-h-0 flex-1 bg-muted/20">
                <main className="min-w-0 flex-1 overflow-y-auto px-6 py-5 md:px-10">
                    {isAnswering && (
                        <div className="mx-auto w-full max-w-4xl">
                            <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-sky-700">Current question</p>
                            <h2 className="mt-1 text-xl font-semibold text-foreground" title={currentQuestion || undefined}>{currentQuestion}</h2>
                            <p className="mb-5 mt-1 text-xs text-muted-foreground">Use the same control respondents see, then continue to inspect the next route.</p>
                            {currentNode && <AnswerComposer
                                key={currentNode.id}
                                node={currentNode}
                                choices={choices}
                                onAnswer={onAnswer}
                            />}
                        </div>
                    )}
                    {!isAnswering && (
                        <div className="flex h-full items-center justify-center text-center">
                            <div>
                                <p className="text-lg font-semibold text-foreground">{error || outcome || 'Flow test complete'}</p>
                                <p className="mt-1 text-sm text-muted-foreground">Use Back to try another answer or Restart to begin again.</p>
                            </div>
                        </div>
                    )}
                </main>
                <RoutePreviewPanel conditions={conditions} currentQuestion={currentQuestion} embedded />
            </div>
        </section>
    );
}
