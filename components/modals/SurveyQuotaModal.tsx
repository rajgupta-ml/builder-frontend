"use client";
import { useEffect, useMemo, useState, useId, useCallback, type ChangeEvent } from "react";
import { quotaApi } from "@/api/quota";
import { SurveyQuota, QuotaCondition } from "@/src/shared/types/survey";
import apiClient from "@/lib/api-client";
import { surveyWorkflowApi } from "@/api/surveyWorkflow";
import { toast } from "sonner";
import {
    IconPlus, IconTrash, IconAlertCircle, IconX, IconRefresh,
    IconUpload, IconFilter, IconCopy, IconArrowLeft, IconSearch,
    IconDeviceFloppy, IconRotate, IconEye, IconEyeOff,
} from "@tabler/icons-react";
import { motion, AnimatePresence } from "framer-motion";
import { Node } from "@xyflow/react";
import { ModalPortal } from "@/components/ui/ModalPortal";
import { COUNTRIES } from "@/constants/locations";
import { ConditionBuilder } from "../properties/ConditionBuilder";
import type { LogicGroup } from "../properties/conditionTypes";

// ---------------------------------------------------------------------------
// Question shape
// ---------------------------------------------------------------------------
interface QuestionShape {
    id: string;
    text: string;
    questionTypeCanonical: string;
    country?: string | null;
    options: { id: string; value: string; label: string }[];
}

// ---------------------------------------------------------------------------
// Postal / question-type helpers
// ---------------------------------------------------------------------------
const POSTAL_CODE_PATTERN = /\b(zip|zipcode|zip code|postal|postal code|postcode|pin code|pincode)\b/i;

function isChoiceQuestion(q: QuestionShape) {
    const t = q.questionTypeCanonical;
    return t === "single_choice" || t === "multiple_choice" || t === "singleChoice" || t === "multiChoice";
}

function isNumberQuestion(q: QuestionShape) {
    const t = q.questionTypeCanonical;
    return t === "open_ended_number" || t === "openEndedNumber";
}

function isPostalCodeQuestion(q: QuestionShape) {
    const isOpenEnded = isNumberQuestion(q)
        || q.questionTypeCanonical === "open_ended_question"
        || q.questionTypeCanonical === "openEndedQuestion";
    if (!isOpenEnded) return false;
    return POSTAL_CODE_PATTERN.test(q.text ?? "");
}

type QuotaMatchType = QuotaCondition["matchType"];

function getAvailableMatchTypes(q: QuestionShape): QuotaMatchType[] {
    if (isPostalCodeQuestion(q)) return ["postal_regex", "postal_list"];
    if (isNumberQuestion(q)) return ["number_range"];
    return ["option"];
}

function getDefaultMatchType(q: QuestionShape): QuotaMatchType {
    return getAvailableMatchTypes(q)[0];
}

function normalizeCountryCode(code?: string | null): string {
    if (!code) return "US";
    const upper = code.toUpperCase();
    return COUNTRIES.find((c) => c.code === upper) ? upper : "US";
}

const MATCH_TYPE_LABEL: Record<QuotaMatchType, string> = {
    option: "Answer Option",
    number_range: "Numerical Range",
    postal_regex: "Country Pattern",
    postal_list: "Custom ZIP List",
};

// ---------------------------------------------------------------------------
// Postal list editor
// ---------------------------------------------------------------------------
function parsePostalValueText(text: string): string[] {
    return text.split(/[\n,;|]+/).map((v) => v.trim()).filter(Boolean);
}

function PostalListEditor({ condition, onChange }: { condition: QuotaCondition; onChange: (p: Partial<QuotaCondition>) => void }) {
    const uploadId = useId();
    const [draft, setDraft] = useState(() =>
        condition.matchType === "postal_list" ? (condition.optionValues ?? []).join("\n") : ""
    );
    const count = useMemo(() => parsePostalValueText(draft).length, [draft]);

    const applyText = (value: string) => {
        setDraft(value);
        onChange({ matchType: "postal_list", optionValues: parsePostalValueText(value), minValue: undefined, maxValue: undefined });
    };

    const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        const uploaded = parsePostalValueText(await file.text());
        applyText([...parsePostalValueText(draft), ...uploaded].join("\n"));
    };

    return (
        <div className="space-y-2 mt-3">
            <div className="flex items-center justify-between gap-3">
                <label className="text-xs font-semibold text-muted-foreground">ZIP / Postal codes</label>
                <label htmlFor={uploadId} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/10 transition-all">
                    <IconUpload size={12} /> Upload CSV/TXT
                </label>
                <input id={uploadId} type="file" accept=".csv,.txt,text/csv,text/plain" onChange={handleUpload} className="hidden" />
            </div>
            <textarea
                value={draft}
                onChange={(e) => applyText(e.target.value)}
                placeholder="Paste one ZIP/postal code per line, or separate with commas"
                className="min-h-[120px] w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Separators: new lines, commas, semicolons, pipes</span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">{count} codes</span>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Condition value input
// ---------------------------------------------------------------------------
function QuotaConditionValueInput({ question, condition, onChange }: {
    question: QuestionShape;
    condition: QuotaCondition;
    onChange: (p: Partial<QuotaCondition>) => void;
}) {
    if (condition.matchType === "option") {
        // Conditions synced from GLE may hold 'opt_<id>' tokens or bare ids
        // instead of the raw option value — treat all shapes as selected.
        const rawSelected = new Set(condition.optionValues ?? []);
        const isOptionSelected = (o: QuestionShape["options"][number]) =>
            rawSelected.has(o.value) || rawSelected.has(`opt_${o.id}`) || rawSelected.has(String(o.id));
        const selected = new Set(question.options.filter(isOptionSelected).map((o) => o.value));
        const allSelected = question.options.length > 0 && question.options.every(isOptionSelected);

        const toggle = (value: string) => {
            const next = new Set(selected);
            if (next.has(value)) next.delete(value); else next.add(value);
            onChange({ optionValues: Array.from(next) });
        };

        const toggleAll = () => {
            onChange({ optionValues: allSelected ? [] : question.options.map((o) => o.value) });
        };

        if (question.options.length === 0) {
            return <p className="mt-3 text-xs text-muted-foreground italic">No options defined for this question.</p>;
        }

        return (
            <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Select matching answers
                    </span>
                    <div className="flex items-center gap-2">
                        {selected.size > 0 && (
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                {selected.size} of {question.options.length} selected
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={toggleAll}
                            className="text-[10px] font-bold text-slate-400 hover:text-slate-600 underline underline-offset-2 transition-colors"
                        >
                            {allSelected ? "Clear all" : "Select all"}
                        </button>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    {question.options.map((opt) => {
                        const isOn = selected.has(opt.value);
                        return (
                            <button
                                key={opt.id}
                                type="button"
                                onClick={() => toggle(opt.value)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all active:scale-95 ${
                                    isOn
                                        ? "bg-amber-500 border-amber-500 text-white shadow-sm"
                                        : "bg-white border-slate-200 text-slate-600 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700"
                                }`}
                            >
                                <span className={`w-3 h-3 rounded-sm border flex items-center justify-center shrink-0 transition-all ${isOn ? "bg-white/30 border-white/40" : "border-slate-300"}`}>
                                    {isOn && (
                                        <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                                            <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    )}
                                </span>
                                {opt.label || opt.value}
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    }

    if (condition.matchType === "number_range") {
        return (
            <div className="mt-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-3">
                    Numerical range
                </span>
                <div className="flex items-center gap-3">
                    <div className="flex-1">
                        <label className="text-[10px] font-semibold text-muted-foreground block mb-1.5">From</label>
                        <input type="number" placeholder="Min"
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400 transition-all"
                            value={condition.minValue ?? ""}
                            onChange={(e) => onChange({ minValue: e.target.value !== "" ? Number(e.target.value) : undefined })}
                        />
                    </div>
                    <div className="pt-5 text-slate-300 font-bold text-sm">—</div>
                    <div className="flex-1">
                        <label className="text-[10px] font-semibold text-muted-foreground block mb-1.5">To</label>
                        <input type="number" placeholder="Max"
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400 transition-all"
                            value={condition.maxValue ?? ""}
                            onChange={(e) => onChange({ maxValue: e.target.value !== "" ? Number(e.target.value) : undefined })}
                        />
                    </div>
                </div>
            </div>
        );
    }

    if (condition.matchType === "postal_regex") {
        const countryCode = normalizeCountryCode(condition.optionValues?.[0] ?? question.country);
        return (
            <div className="mt-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-3">
                    Country pattern
                </span>
                <div className="flex items-end gap-3">
                    <div className="flex-1">
                        <label className="text-[10px] font-semibold text-muted-foreground block mb-1.5">Country</label>
                        <select value={countryCode}
                            onChange={(e) => onChange({ optionValues: [e.target.value], minValue: undefined, maxValue: undefined })}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400 transition-all"
                        >
                            {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="flex-1 pb-0.5">
                        <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 text-[11px] text-slate-500 leading-relaxed">
                            Matches respondents whose postal code fits this country&apos;s format.
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (condition.matchType === "postal_list") {
        return <PostalListEditor condition={condition} onChange={onChange} />;
    }

    return <span className="text-xs text-muted-foreground italic">Unsupported question type</span>;
}

// ---------------------------------------------------------------------------
// Quota table row
// ---------------------------------------------------------------------------
function QuotaTableRow({ quota, onOpenConditions, onToggleActive, onDuplicate, onDelete, onNameBlur, onLimitBlur, onNameChange, onLimitChange }: {
    quota: SurveyQuota;
    onOpenConditions: (q: SurveyQuota) => void;
    onToggleActive: (q: SurveyQuota) => void;
    onDuplicate: (q: SurveyQuota) => void;
    onDelete: (id: string) => void;
    onNameBlur?: (q: SurveyQuota, name: string) => void;
    onLimitBlur?: (q: SurveyQuota, limit: number) => void;
    onNameChange?: (q: SurveyQuota, name: string) => void;
    onLimitChange?: (q: SurveyQuota, limit: number) => void;
}) {
    const [localName, setLocalName] = useState(quota.name ?? "");
    const [localLimit, setLocalLimit] = useState(String(quota.limit));

    useEffect(() => { setLocalName(quota.name ?? ""); }, [quota.name]);
    useEffect(() => { setLocalLimit(String(quota.limit)); }, [quota.limit]);

    const responses = Math.max(0, quota.currentCount ?? 0);
    const remaining = Math.max(0, quota.limit - responses);
    const fillPct = quota.limit > 0 ? ((responses / quota.limit) * 100).toFixed(0) : "0";

    return (
        <div className="grid items-center px-3 py-2.5 text-xs text-foreground hover:bg-muted/20 transition-colors border-b border-slate-100 last:border-b-0"
            style={{ gridTemplateColumns: "minmax(200px,2fr) 90px 100px 90px 90px 70px 120px" }}
        >
            {/* Target */}
            <div className="pr-3 flex items-center gap-2 min-w-0">
                <input
                    value={localName}
                    onChange={(e) => { setLocalName(e.target.value); onNameChange?.(quota, e.target.value); }}
                    onBlur={() => onNameBlur?.(quota, localName)}
                    className="flex-1 min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-primary/20"
                />
            </div>
            {/* N */}
            <div className="pr-3">
                <input type="number" min={0}
                    value={localLimit}
                    onChange={(e) => { setLocalLimit(e.target.value); onLimitChange?.(quota, Math.max(0, Number(e.target.value) || 0)); }}
                    onBlur={() => onLimitBlur?.(quota, Math.max(0, Number(localLimit) || 0))}
                    className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold font-mono text-slate-800 outline-none focus:ring-2 focus:ring-primary/20"
                />
            </div>
            {/* Hard Stop */}
            <div className="flex items-center">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input type="checkbox" checked={quota.isActive} onChange={() => onToggleActive(quota)} className="rounded border-slate-300" />
                    {quota.isActive ? "On" : "Off"}
                </label>
            </div>
            {/* Responses */}
            <div className="font-mono text-muted-foreground">{responses}</div>
            {/* Remaining */}
            <div className="font-mono text-muted-foreground">{remaining}</div>
            {/* Fill % */}
            <div className="font-mono text-muted-foreground">{fillPct}%</div>
            {/* Actions */}
            <div className="flex items-center gap-1">
                {(() => {
                    const ruleCount = quota.type === "survey" ? countRuleLeaves(quota.rule) : quota.conditions.length;
                    return (
                        <button onClick={() => onOpenConditions(quota)}
                            className="relative w-7 h-7 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center justify-center transition-all"
                            title={`Condition Builder (${ruleCount})`}
                        >
                            <IconFilter size={14} />
                            {ruleCount > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 text-[8px] font-bold text-white border border-white">
                                    {ruleCount}
                                </span>
                            )}
                        </button>
                    );
                })()}
                <button onClick={() => onDuplicate(quota)}
                    className="w-7 h-7 rounded-md border border-emerald-100 bg-white text-emerald-500 hover:bg-emerald-50 hover:border-emerald-200 transition-all flex items-center justify-center"
                    title="Duplicate row"
                >
                    <IconCopy size={14} />
                </button>
                <button onClick={() => onDelete(quota.id)}
                    className="w-7 h-7 rounded-md border border-rose-200 text-rose-500 hover:bg-rose-50 flex items-center justify-center transition-all"
                    title="Delete row"
                >
                    <IconTrash size={14} />
                </button>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Quota table (one per tab)
// ---------------------------------------------------------------------------
function QuotaTable({ quotas, questionList, gleLinked, screenerLinked, onAdd, onNameBlur, onLimitBlur, onNameChange, onLimitChange, onToggleActive, onDelete, onDuplicate, onOpenConditions, countMode, onCountModeChange }: {
    quotas: SurveyQuota[];
    questionList: QuestionShape[];
    gleLinked?: boolean;
    screenerLinked?: boolean;
    onAdd: () => void;
    onNameBlur?: (q: SurveyQuota, name: string) => void;
    onLimitBlur?: (q: SurveyQuota, limit: number) => void;
    onNameChange?: (q: SurveyQuota, name: string) => void;
    onLimitChange?: (q: SurveyQuota, limit: number) => void;
    onToggleActive: (q: SurveyQuota) => void;
    onDelete: (id: string) => void;
    onDuplicate: (q: SurveyQuota) => void;
    onOpenConditions: (q: SurveyQuota) => void;
    countMode?: "on_click" | "on_complete";
    onCountModeChange?: (m: "on_click" | "on_complete") => void;
}) {
    const [searchTerm, setSearchTerm] = useState("");

    const filtered = useMemo(() => {
        if (!searchTerm.trim()) return quotas;
        const q = searchTerm.toLowerCase();
        return quotas.filter((r) => (r.name ?? "").toLowerCase().includes(q));
    }, [quotas, searchTerm]);

    const countedHint = !countMode ? undefined
        : countMode === "on_click"
            ? "Remaining is based on Responses in On Click mode."
            : "Remaining is based on Responses in On Complete mode.";

    return (
        <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-2 px-6 py-3 border-b border-border shrink-0">
                <div className="flex items-center gap-3">
                    {quotas.length > 0 && (
                        <div className="relative">
                            <IconSearch size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search quota rows"
                                className="rounded-lg border border-border bg-background pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/20 w-52"
                            />
                        </div>
                    )}
                    {countMode !== undefined && onCountModeChange && (
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Count Mode</span>
                            <div className="inline-flex rounded-md border border-border overflow-hidden">
                                <button type="button" onClick={() => onCountModeChange("on_click")}
                                    className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${countMode === "on_click" ? "bg-primary text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}
                                >On Click</button>
                                <button type="button" onClick={() => onCountModeChange("on_complete")}
                                    className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border-l border-border ${countMode === "on_complete" ? "bg-primary text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}
                                >On Complete</button>
                            </div>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{quotas.length} Rules</span>
                    <button onClick={onAdd}
                        className="px-2.5 py-1.5 rounded-md border border-amber-200 text-[10px] font-bold text-amber-700 hover:bg-amber-50 inline-flex items-center gap-1 shadow-sm transition-all active:scale-95"
                    >
                        <IconPlus size={12} /> Add Row
                    </button>
                </div>
            </div>

            {/* Hint */}
            <div className="mx-6 mt-4 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] text-amber-700 shrink-0">
                Build and maintain quota logic here. Click the <strong>filter icon</strong> on any row to define its conditions.
                {screenerLinked === false && (
                    <span className="block mt-0.5 font-bold">No GLE project linked — link a project to use qualification questions.</span>
                )}
            </div>

            {/* Table */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
                {quotas.length === 0 ? (
                    <div className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-3 py-8 text-xs font-semibold text-slate-500 text-center">
                        No quota rows yet. Add one and edit directly in place.
                    </div>
                ) : (
                    <div className="rounded-lg border border-slate-200 overflow-hidden">
                        {/* Header */}
                        <div className="grid sticky top-0 z-10 bg-slate-50 border-b border-slate-200 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-slate-500"
                            style={{ gridTemplateColumns: "minmax(200px,2fr) 90px 100px 90px 90px 70px 120px" }}
                        >
                            <div>Target</div>
                            <div>N</div>
                            <div>Hard Stop</div>
                            <div>Responses</div>
                            <div>Remaining</div>
                            <div>Fill %</div>
                            <div>Actions</div>
                        </div>
                        <div>
                            {filtered.length === 0 ? (
                                <div className="px-3 py-4 text-xs text-muted-foreground text-center">No matching quota rows.</div>
                            ) : filtered.map((quota) => (
                                <QuotaTableRow
                                    key={quota.id}
                                    quota={quota}
                                    onOpenConditions={onOpenConditions}
                                    onToggleActive={onToggleActive}
                                    onDuplicate={onDuplicate}
                                    onDelete={onDelete}
                                    onNameBlur={onNameBlur}
                                    onLimitBlur={onLimitBlur}
                                    onNameChange={onNameChange}
                                    onLimitChange={onLimitChange}
                                />
                            ))}
                        </div>
                    </div>
                )}
                {countedHint && (
                    <p className="mt-3 text-[11px] font-medium text-slate-500">{countedHint}</p>
                )}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Condition builder panel (full-height view swap)
// ---------------------------------------------------------------------------
function ConditionBuilderPanel({ quota, questionList, gleLinked, onDone, onCancel }: {
    quota: SurveyQuota;
    questionList: QuestionShape[];
    gleLinked: boolean;
    onDone: (groupOp: "and" | "or", conditions: QuotaCondition[]) => void;
    onCancel: () => void;
}) {
    const [groupOp, setGroupOp] = useState<"and" | "or">(quota.groupOperator);
    const [conditions, setConditions] = useState<QuotaCondition[]>(
        quota.conditions.map((c) => ({ ...c, optionValues: [...(c.optionValues ?? [])] }))
    );

    const patchCondition = (idx: number, patch: Partial<QuotaCondition>) => {
        setConditions((prev) => prev.map((c, i) => i === idx ? { ...c, ...patch } : c));
    };

    const addBlank = () => {
        setConditions((prev) => [...prev, { questionId: "", matchType: "option", optionValues: [], sortOrder: prev.length }]);
    };

    return (
        <div className="flex flex-col h-full">
            {/* Sub-header */}
            <div className="flex items-center justify-between gap-4 px-6 py-3 border-b border-border bg-muted/20 shrink-0">
                <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-xl bg-background border border-border flex items-center justify-center text-muted-foreground shrink-0">
                        <IconFilter size={16} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Condition Builder</p>
                        <p className="text-sm font-bold truncate max-w-xs">{quota.name ?? "Unnamed Quota"}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {/* AND / OR segmented pill */}
                    {conditions.length > 1 && (
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Match</span>
                            <div className="flex items-center rounded-lg bg-slate-100 p-0.5 gap-0.5">
                                {(["and", "or"] as const).map((op) => (
                                    <button
                                        key={op}
                                        type="button"
                                        onClick={() => setGroupOp(op)}
                                        className={`px-3 py-1.5 rounded-md text-[11px] font-black uppercase tracking-wider transition-all ${
                                            groupOp === op
                                                ? "bg-white text-slate-800 shadow-sm"
                                                : "text-slate-400 hover:text-slate-600"
                                        }`}
                                    >
                                        {op === "and" ? "All" : "Any"}
                                    </button>
                                ))}
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">requirements</span>
                        </div>
                    )}
                    <button onClick={addBlank} disabled={questionList.length === 0}
                        className="px-4 py-2 rounded-xl bg-background border border-border text-[11px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary hover:border-primary/20 hover:bg-primary/5 transition-all flex items-center gap-2 shadow-sm active:scale-95 disabled:opacity-50"
                    >
                        <IconPlus size={14} /> Add Condition
                    </button>
                </div>
            </div>

            {/* Conditions scroll area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {quota.type === "screener" && !gleLinked && (
                    <div className="flex items-center gap-2 p-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl">
                        <IconAlertCircle size={14} className="shrink-0" />
                        No GLE project linked to this survey. Link a project to access screener questions.
                    </div>
                )}
                {quota.type === "screener" && gleLinked && questionList.length === 0 && (
                    <div className="flex items-center gap-2 p-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl">
                        <IconAlertCircle size={14} className="shrink-0" />
                        No screener questions added in GLE target groups yet.
                    </div>
                )}

                {conditions.length === 0 ? (
                    <div className="rounded-3xl border-2 border-dashed border-slate-100 bg-slate-50/50 px-8 py-12 text-center">
                        <div className="w-14 h-14 bg-white rounded-full shadow-md flex items-center justify-center text-slate-300 mx-auto mb-4 opacity-40">
                            <IconFilter size={28} />
                        </div>
                        <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">No conditions defined</h4>
                        <p className="text-xs text-slate-400 leading-relaxed font-medium">Add a condition to start building the exclusion logic for this quota.</p>
                    </div>
                ) : conditions.map((condition, idx) => {
                    const selectedQuestion = questionList.find((q) => q.id === condition.questionId);
                    const availableMatchTypes = selectedQuestion ? getAvailableMatchTypes(selectedQuestion) : (["option"] as QuotaMatchType[]);

                    return (
                        <div key={idx}>
                        {idx > 0 && (
                            <div className="flex items-center gap-3 my-1 px-2">
                                <div className="flex-1 h-px bg-slate-100" />
                                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-slate-100 text-slate-400">
                                    {groupOp === "and" ? "AND" : "OR"}
                                </span>
                                <div className="flex-1 h-px bg-slate-100" />
                            </div>
                        )}
                        <div className="group relative rounded-4xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:bg-slate-50/30 hover:shadow-md">
                            <div className="flex flex-col gap-5">
                                {/* Question + match type + delete */}
                                <div className="grid grid-cols-1 sm:grid-cols-[2fr_1.2fr_auto] gap-5 items-start">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="w-5 h-5 bg-primary/5 rounded-lg flex items-center justify-center text-primary/60 border border-primary/10">
                                                <span className="text-[9px] font-black">{idx + 1}</span>
                                            </div>
                                            <label className="text-[10px] uppercase tracking-widest font-black text-slate-400">Select Question</label>
                                        </div>
                                        <select value={condition.questionId}
                                            onChange={(e) => {
                                                const nextQ = questionList.find((q) => q.id === e.target.value);
                                                const defaultMatchType = nextQ ? getDefaultMatchType(nextQ) : "option";
                                                const defaultOptVals = nextQ && isPostalCodeQuestion(nextQ) ? [normalizeCountryCode(nextQ.country)] : [];
                                                patchCondition(idx, { questionId: e.target.value, matchType: defaultMatchType, optionValues: defaultOptVals, minValue: undefined, maxValue: undefined });
                                            }}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-primary/10 outline-none transition-all hover:border-slate-300 shadow-sm"
                                        >
                                            <option value="">Select question…</option>
                                            {questionList.map((q) => (
                                                <option key={q.id} value={q.id}>{q.text || q.id}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {availableMatchTypes.length > 1 && (
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 mb-1">
                                                <label className="text-[10px] uppercase tracking-widest font-black text-slate-400">Match Type</label>
                                            </div>
                                            <select value={condition.matchType}
                                                onChange={(e) => {
                                                    const nextType = e.target.value as QuotaMatchType;
                                                    const countryCode = normalizeCountryCode(selectedQuestion?.country);
                                                    patchCondition(idx, { matchType: nextType, optionValues: nextType === "postal_regex" ? [countryCode] : [], minValue: undefined, maxValue: undefined });
                                                }}
                                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-primary/10 outline-none transition-all hover:border-slate-300 shadow-sm"
                                            >
                                                {availableMatchTypes.map((t) => (
                                                    <option key={t} value={t}>{MATCH_TYPE_LABEL[t]}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    <div className="sm:pt-7">
                                        <button onClick={() => setConditions((prev) => prev.filter((_, i) => i !== idx))}
                                            className="w-11 h-11 rounded-xl border border-transparent text-transparent group-hover:border-rose-100 group-hover:text-rose-300 hover:!text-rose-600 hover:!bg-rose-50 hover:!border-rose-200 flex items-center justify-center transition-all active:scale-90"
                                            title="Remove condition"
                                        >
                                            <IconTrash size={16} />
                                        </button>
                                    </div>
                                </div>

                                {/* Value editor */}
                                {selectedQuestion && (
                                    <QuotaConditionValueInput
                                        question={selectedQuestion}
                                        condition={condition}
                                        onChange={(patch) => patchCondition(idx, patch)}
                                    />
                                )}
                            </div>
                        </div>
                        </div>
                    );
                })}
            </div>

            {/* Done / Cancel footer */}
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border bg-background shrink-0">
                <div className="text-[10px] font-semibold text-muted-foreground/70 italic flex items-center gap-1.5">
                    <IconSearch size={12} /> Changes apply when you save the screener
                </div>
                <div className="flex gap-2">
                    <button onClick={onCancel}
                        className="px-5 py-2 rounded-xl border border-border text-xs font-bold hover:bg-muted transition-all"
                    >
                        Cancel
                    </button>
                    <button onClick={() => onDone(groupOp, conditions)}
                        className="px-8 py-2 rounded-xl bg-foreground text-background text-[11px] font-black uppercase tracking-widest hover:opacity-90 transition-all"
                    >
                        Done Mapping Rules
                    </button>
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Survey-question rule builder panel (full ConditionBuilder engine)
// ---------------------------------------------------------------------------
function SurveyRuleBuilderPanel({ quota, flowNodes, onDone, onCancel }: {
    quota: SurveyQuota;
    flowNodes: Node[];
    onDone: (rule: LogicGroup) => void;
    onCancel: () => void;
}) {
    const [rule, setRule] = useState<LogicGroup>(quota.rule ?? emptyRuleGroup());

    return (
        <div className="flex flex-col h-full">
            {/* Sub-header */}
            <div className="flex items-center gap-4 px-6 py-3 border-b border-border bg-muted/20 shrink-0">
                <div className="w-8 h-8 rounded-xl bg-background border border-border flex items-center justify-center text-muted-foreground shrink-0">
                    <IconFilter size={16} />
                </div>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Rule Builder</p>
                    <p className="text-sm font-bold truncate max-w-xs">{quota.name ?? "Unnamed Quota"}</p>
                </div>
            </div>

            {/* Rule builder */}
            <div className="flex-1 overflow-y-auto p-6">
                {flowNodes.length === 0 ? (
                    <div className="flex items-center gap-2 p-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl">
                        <IconAlertCircle size={14} className="shrink-0" />
                        No survey questions found. Add questions to the workflow first.
                    </div>
                ) : (
                    <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                        <ConditionBuilder
                            nodes={flowNodes}
                            value={rule}
                            onChange={setRule}
                            fieldKeyMode="technicalId"
                            optionKeyMode="exportId"
                        />
                    </div>
                )}
            </div>

            {/* Done / Cancel footer */}
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border bg-background shrink-0">
                <div className="text-[10px] font-semibold text-muted-foreground/70 italic flex items-center gap-1.5">
                    <IconSearch size={12} /> Changes apply when you save the rule
                </div>
                <div className="flex gap-2">
                    <button onClick={onCancel}
                        className="px-5 py-2 rounded-xl border border-border text-xs font-bold hover:bg-muted transition-all"
                    >
                        Cancel
                    </button>
                    <button onClick={() => onDone(rule)}
                        className="px-8 py-2 rounded-xl bg-foreground text-background text-[11px] font-black uppercase tracking-widest hover:opacity-90 transition-all"
                    >
                        Done Mapping Rules
                    </button>
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Draft helpers
// ---------------------------------------------------------------------------
const TEMP_ID_PREFIX = "__new__";
function makeTempId() { return `${TEMP_ID_PREFIX}${crypto.randomUUID()}`; }
function isTempId(id: string) { return id.startsWith(TEMP_ID_PREFIX); }

function deepCloneQuotas(qs: SurveyQuota[]): SurveyQuota[] {
    return qs.map((q) => ({ ...q, conditions: q.conditions.map((c) => ({ ...c, optionValues: [...(c.optionValues ?? [])] })) }));
}

function emptyRuleGroup(): LogicGroup {
    return { id: "root", type: "group", logicType: "AND", children: [] };
}

function countRuleLeaves(item: LogicGroup | undefined | null): number {
    if (!item) return 0;
    if (item.type !== "group") return 1;
    return item.children.reduce((sum, child) => sum + (child.type === "group" ? countRuleLeaves(child) : 1), 0);
}

// ---------------------------------------------------------------------------
// Modal props
// ---------------------------------------------------------------------------
interface SurveyQuotaModalProps {
    isOpen: boolean;
    onClose: () => void;
    surveyId: string;
    onSave?: () => void;
}

// ---------------------------------------------------------------------------
// Main component — Bottom Sheet
// ---------------------------------------------------------------------------
export function SurveyQuotaModal({ isOpen, onClose, surveyId, onSave }: SurveyQuotaModalProps) {
    const [quotas, setQuotas] = useState<SurveyQuota[]>([]);
    const [loading, setLoading] = useState(false);
    const [flowNodes, setFlowNodes] = useState<Node[]>([]);
    const [screenerQuestions, setScreenerQuestions] = useState<QuestionShape[]>([]);
    const [gleLinked, setGleLinked] = useState(false);
    const [syncing, setSyncing] = useState(false);

    const [activeTab, setActiveTab] = useState<"screener" | "survey">("screener");
    const [conditionTarget, setConditionTarget] = useState<SurveyQuota | null>(null);
    const [hiddenTabs, setHiddenTabs] = useState<Set<"screener" | "survey">>(() => {
        if (typeof window === "undefined") return new Set();
        try {
            const stored = JSON.parse(window.localStorage.getItem("ss-quota-hidden-tabs") ?? "[]") as string[];
            return new Set(stored.filter((t): t is "screener" | "survey" => t === "screener" || t === "survey"));
        } catch {
            return new Set();
        }
    });

    const toggleTabHidden = (tab: "screener" | "survey") => {
        setHiddenTabs((prev) => {
            const next = new Set(prev);
            if (next.has(tab)) {
                next.delete(tab);
            } else if (next.size < 1) {
                // Never hide both tabs — at least one must remain visible.
                next.add(tab);
            }
            window.localStorage.setItem("ss-quota-hidden-tabs", JSON.stringify([...next]));
            return next;
        });
    };

    useEffect(() => {
        if (hiddenTabs.has(activeTab)) {
            setActiveTab(activeTab === "screener" ? "survey" : "screener");
        }
    }, [hiddenTabs, activeTab]);

    // Screener draft state
    const [screenerDraft, setScreenerDraft] = useState<SurveyQuota[]>([]);
    const [screenerOriginal, setScreenerOriginal] = useState<SurveyQuota[]>([]);
    const [screenerDirty, setScreenerDirty] = useState(false);
    const [screenerSaving, setScreenerSaving] = useState(false);

    // Survey draft state
    const [surveyDraft, setSurveyDraft] = useState<SurveyQuota[]>([]);
    const [surveyOriginal, setSurveyOriginal] = useState<SurveyQuota[]>([]);
    const [surveyDirty, setSurveyDirty] = useState(false);
    const [surveySaving, setSurveySaving] = useState(false);

    // -----------------------------------------------------------------------
    // Data fetching
    // -----------------------------------------------------------------------
    const resetScreenerDraft = useCallback((serverQuotas: SurveyQuota[]) => {
        const screener = serverQuotas.filter((q) => q.type === "screener");
        const cloned = deepCloneQuotas(screener);
        setScreenerDraft(cloned);
        setScreenerOriginal(deepCloneQuotas(screener));
        setScreenerDirty(false);
    }, []);

    const resetSurveyDraft = useCallback((serverQuotas: SurveyQuota[]) => {
        const survey = serverQuotas.filter((q) => q.type === "survey");
        const cloned = deepCloneQuotas(survey);
        setSurveyDraft(cloned);
        setSurveyOriginal(deepCloneQuotas(survey));
        setSurveyDirty(false);
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        if (isOpen && surveyId) fetchData(controller.signal);
        return () => controller.abort();
    }, [isOpen, surveyId]);

    useEffect(() => {
        if (!surveyId || !isOpen) return;
        apiClient.get<{ data?: QuestionShape[]; linked?: boolean }>(`/surveys/${surveyId}/gle-screener-questions`)
            .then((r) => { setScreenerQuestions(r.data?.data ?? []); setGleLinked(r.data?.linked ?? false); })
            .catch(() => { setScreenerQuestions([]); setGleLinked(false); });
    }, [surveyId, isOpen]);

    useEffect(() => {
        if (!isOpen) { setConditionTarget(null); }
    }, [isOpen]);

    const fetchData = async (signal?: AbortSignal) => {
        setLoading(true);
        try {
            const [quotasData, workflowData] = await Promise.all([
                quotaApi.getQuotas(surveyId, { signal }),
                surveyWorkflowApi.getLatestWorkflowBySurveyId(surveyId, { signal }),
            ]);
            if (signal?.aborted) return;
            setQuotas(quotasData);
            resetScreenerDraft(quotasData);
            resetSurveyDraft(quotasData);
            if (workflowData?.runtimeJson && typeof workflowData.runtimeJson === "object") {
                setFlowNodes(Object.values(workflowData.runtimeJson).map((n: unknown) => {
                    const node = n as { id: string; type: string; data: Record<string, unknown> };
                    return { id: node.id, type: node.type, data: node.data, position: { x: 0, y: 0 } };
                }));
            }
        } catch (error) {
            if (signal?.aborted) return;
            toast.error("Failed to load quotas");
        } finally {
            if (!signal?.aborted) setLoading(false);
        }
    };

    // -----------------------------------------------------------------------
    // Survey question list
    // -----------------------------------------------------------------------
    const surveyQuestionList = useMemo<QuestionShape[]>(() =>
        flowNodes
            .filter((n) => ["singleChoice", "multiChoice", "single_choice", "multiple_choice", "open_ended_number", "openEndedNumber"].includes(n.type ?? ""))
            .map((n) => {
                const data = n.data as Record<string, unknown>;
                return {
                    id: n.id,
                    text: String(data?.label ?? data?.question ?? data?.title ?? n.id),
                    questionTypeCanonical: n.type ?? "",
                    country: null,
                    options: Array.isArray(data?.options)
                        ? (data.options as Record<string, unknown>[]).map((opt) => ({
                            id: String(opt.exportId ?? opt.id ?? ""),
                            value: String(opt.exportId ?? opt.value ?? ""),
                            label: String(opt.label ?? opt.text ?? ""),
                        }))
                        : [],
                };
            }),
        [flowNodes]
    );

    // -----------------------------------------------------------------------
    // Screener draft mutators — no API calls, just local state
    // -----------------------------------------------------------------------
    const markDirty = () => setScreenerDirty(true);

    const screenerAdd = () => {
        const newQ: SurveyQuota = {
            id: makeTempId(),
            surveyId,
            name: "New Quota",
            type: "screener",
            groupOperator: "and",
            limit: 0,
            isActive: true,
            isFull: false,
            currentCount: 0,
            createdAt: new Date().toISOString(),
            conditions: [],
        };
        setScreenerDraft((prev) => [...prev, newQ]);
        markDirty();
    };

    const screenerPatchName = (quota: SurveyQuota, name: string) => {
        if (name === (quota.name ?? "")) return;
        setScreenerDraft((prev) => prev.map((q) => q.id === quota.id ? { ...q, name } : q));
        markDirty();
    };

    const screenerPatchLimit = (quota: SurveyQuota, limit: number) => {
        if (limit === quota.limit) return;
        setScreenerDraft((prev) => prev.map((q) => q.id === quota.id ? { ...q, limit } : q));
        markDirty();
    };

    const screenerToggle = (quota: SurveyQuota) => {
        setScreenerDraft((prev) => prev.map((q) => q.id === quota.id ? { ...q, isActive: !q.isActive } : q));
        markDirty();
    };

    const screenerDelete = (id: string) => {
        setScreenerDraft((prev) => prev.filter((q) => q.id !== id));
        markDirty();
    };

    const screenerDuplicate = (quota: SurveyQuota) => {
        const copy: SurveyQuota = {
            ...quota,
            id: makeTempId(),
            name: `${quota.name ?? "Quota"} Copy`,
            currentCount: 0,
            isFull: false,
            createdAt: new Date().toISOString(),
            conditions: quota.conditions.map(({ id: _id, ...c }) => c),
        };
        setScreenerDraft((prev) => [...prev, copy]);
        markDirty();
    };

    const screenerSaveConditions = (groupOp: "and" | "or", conditions: QuotaCondition[]) => {
        if (!conditionTarget) return;
        setScreenerDraft((prev) => prev.map((q) =>
            q.id === conditionTarget.id ? { ...q, groupOperator: groupOp, conditions } : q
        ));
        setConditionTarget(null);
        markDirty();
    };

    // -----------------------------------------------------------------------
    // Screener save — batch all draft changes to the API
    // -----------------------------------------------------------------------
    const handleScreenerSave = async () => {
        setScreenerSaving(true);
        try {
            const originalIds = new Set(screenerOriginal.map((q) => q.id));
            const draftIds = new Set(screenerDraft.map((q) => q.id));

            // 1. Delete quotas removed from the draft
            const toDelete = screenerOriginal.filter((q) => !draftIds.has(q.id));
            for (const q of toDelete) {
                await quotaApi.deleteQuota(q.id);
            }

            // 2. Create new quotas (temp IDs)
            const idRemap = new Map<string, string>(); // tempId → server id
            for (const q of screenerDraft) {
                if (isTempId(q.id)) {
                    const created = await quotaApi.createQuota(surveyId, {
                        name: q.name, type: "screener", groupOperator: q.groupOperator,
                        limit: q.limit, isActive: q.isActive, conditions: q.conditions,
                    });
                    idRemap.set(q.id, created.id);
                }
            }

            // 3. Update existing quotas that changed
            for (const q of screenerDraft) {
                if (isTempId(q.id)) continue; // already created above
                const orig = screenerOriginal.find((o) => o.id === q.id);
                if (!orig) continue;
                const changed =
                    q.name !== orig.name ||
                    q.limit !== orig.limit ||
                    q.isActive !== orig.isActive ||
                    q.groupOperator !== orig.groupOperator ||
                    JSON.stringify(q.conditions) !== JSON.stringify(orig.conditions);
                if (changed) {
                    await quotaApi.updateQuota(q.id, {
                        name: q.name, type: "screener", groupOperator: q.groupOperator,
                        limit: q.limit, isActive: q.isActive, conditions: q.conditions,
                    });
                }
            }

            toast.success("Screener quotas saved");
            await fetchData();
            if (onSave) onSave();
        } catch {
            toast.error("Failed to save screener quotas");
        } finally {
            setScreenerSaving(false);
        }
    };

    const handleScreenerDiscard = () => {
        setScreenerDraft(deepCloneQuotas(screenerOriginal));
        setScreenerDirty(false);
        setConditionTarget(null);
    };

    // -----------------------------------------------------------------------
    // Survey draft mutators — no API calls, just local state
    // -----------------------------------------------------------------------
    const markSurveyDirty = () => setSurveyDirty(true);

    const surveyAdd = () => {
        const newQ: SurveyQuota = {
            id: makeTempId(),
            surveyId,
            name: "New Quota",
            type: "survey",
            groupOperator: "and",
            rule: emptyRuleGroup(),
            limit: 0,
            isActive: true,
            isFull: false,
            currentCount: 0,
            createdAt: new Date().toISOString(),
            conditions: [],
        };
        setSurveyDraft((prev) => [...prev, newQ]);
        markSurveyDirty();
    };

    const surveyPatchName = (quota: SurveyQuota, name: string) => {
        if (name === (quota.name ?? "")) return;
        setSurveyDraft((prev) => prev.map((q) => q.id === quota.id ? { ...q, name } : q));
        markSurveyDirty();
    };

    const surveyPatchLimit = (quota: SurveyQuota, limit: number) => {
        if (limit === quota.limit) return;
        setSurveyDraft((prev) => prev.map((q) => q.id === quota.id ? { ...q, limit } : q));
        markSurveyDirty();
    };

    const surveyToggle = (quota: SurveyQuota) => {
        setSurveyDraft((prev) => prev.map((q) => q.id === quota.id ? { ...q, isActive: !q.isActive } : q));
        markSurveyDirty();
    };

    const surveyDelete = (id: string) => {
        setSurveyDraft((prev) => prev.filter((q) => q.id !== id));
        markSurveyDirty();
    };

    const surveyDuplicate = (quota: SurveyQuota) => {
        const copy: SurveyQuota = {
            ...quota,
            id: makeTempId(),
            name: `${quota.name ?? "Quota"} Copy`,
            currentCount: 0,
            isFull: false,
            createdAt: new Date().toISOString(),
            rule: quota.rule ?? emptyRuleGroup(),
            conditions: quota.conditions.map(({ id: _id, ...c }) => c),
        };
        setSurveyDraft((prev) => [...prev, copy]);
        markSurveyDirty();
    };

    const surveySaveRule = (rule: LogicGroup) => {
        if (!conditionTarget) return;
        setSurveyDraft((prev) => prev.map((q) =>
            q.id === conditionTarget.id ? { ...q, rule } : q
        ));
        setConditionTarget(null);
        markSurveyDirty();
    };

    // -----------------------------------------------------------------------
    // Survey save — batch all draft changes to the API
    // -----------------------------------------------------------------------
    const handleSurveySave = async () => {
        setSurveySaving(true);
        try {
            const draftIds = new Set(surveyDraft.map((q) => q.id));

            // 1. Delete quotas removed from the draft
            const toDelete = surveyOriginal.filter((q) => !draftIds.has(q.id));
            for (const q of toDelete) {
                await quotaApi.deleteQuota(q.id);
            }

            // 2. Create new quotas (temp IDs)
            for (const q of surveyDraft) {
                if (isTempId(q.id)) {
                    await quotaApi.createQuota(surveyId, {
                        name: q.name, type: "survey", groupOperator: q.groupOperator,
                        rule: q.rule ?? emptyRuleGroup(), limit: q.limit, isActive: q.isActive, conditions: [],
                    });
                }
            }

            // 3. Update existing quotas that changed
            for (const q of surveyDraft) {
                if (isTempId(q.id)) continue; // already created above
                const orig = surveyOriginal.find((o) => o.id === q.id);
                if (!orig) continue;
                const changed =
                    q.name !== orig.name ||
                    q.limit !== orig.limit ||
                    q.isActive !== orig.isActive ||
                    q.groupOperator !== orig.groupOperator ||
                    JSON.stringify(q.rule) !== JSON.stringify(orig.rule);
                if (changed) {
                    await quotaApi.updateQuota(q.id, {
                        name: q.name, type: "survey", groupOperator: q.groupOperator,
                        rule: q.rule ?? emptyRuleGroup(), limit: q.limit, isActive: q.isActive, conditions: [],
                    });
                }
            }

            toast.success("Survey quotas saved");
            await fetchData();
            if (onSave) onSave();
        } catch {
            toast.error("Failed to save survey quotas");
        } finally {
            setSurveySaving(false);
        }
    };

    const handleSurveyDiscard = () => {
        setSurveyDraft(deepCloneQuotas(surveyOriginal));
        setSurveyDirty(false);
        setConditionTarget(null);
    };

    const handleSyncFromGle = async () => {
        setSyncing(true);
        try {
            const response = await apiClient.post<{ data?: { synced?: number } }>(`/surveys/${surveyId}/sync-quotas-from-gle`);
            toast.success(`Synced ${response.data?.data?.synced ?? 0} quotas from GLE`);
            await fetchData();
        } catch { toast.error("Failed to sync quotas from GLE"); }
        finally { setSyncing(false); }
    };

    const isScreenerConditionBuilder = conditionTarget?.type === "screener";
    const questionListForConditions = screenerQuestions;

    // -----------------------------------------------------------------------
    // JSX
    // -----------------------------------------------------------------------
    return (
        <ModalPortal>
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 z-120 bg-black/40 backdrop-blur-sm"
                            onClick={onClose}
                        />

                        {/* Bottom sheet */}
                        <motion.div
                            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 30, stiffness: 300 }}
                            className="fixed bottom-0 left-0 right-0 z-120 bg-background border-t border-border shadow-2xl rounded-t-2xl flex flex-col"
                            style={{ height: "88vh" }}
                        >
                            {/* Drag handle */}
                            <div className="flex justify-center pt-3 pb-1 shrink-0">
                                <div className="w-10 h-1 rounded-full bg-border" />
                            </div>

                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
                                {conditionTarget ? (
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => setConditionTarget(null)}
                                            className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            <IconArrowLeft size={16} /> Back to Quotas
                                        </button>
                                        <span className="text-muted-foreground/40 text-sm">|</span>
                                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${conditionTarget.type === "screener" ? "bg-amber-50 text-amber-600 border border-amber-200" : "bg-primary/10 text-primary border border-primary/20"}`}>
                                            {conditionTarget.type}
                                        </span>
                                    </div>
                                ) : (
                                    <div>
                                        <h2 className="text-lg font-bold">Quota Management</h2>
                                        <p className="text-xs text-muted-foreground">Define demographic limits for this survey.</p>
                                    </div>
                                )}

                                <div className="flex items-center gap-2">
                                    {!conditionTarget && activeTab === "screener" && gleLinked && (
                                        <button onClick={handleSyncFromGle} disabled={syncing || screenerDirty}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-muted text-foreground text-xs font-bold rounded-lg hover:bg-muted/80 transition-all border border-border disabled:opacity-50"
                                            title={screenerDirty ? "Save or discard changes before syncing" : undefined}
                                        >
                                            {syncing ? <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <IconRefresh size={14} />}
                                            Sync from GLE
                                        </button>
                                    )}
                                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
                                        <IconX size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Tabs (hidden while in condition builder) */}
                            {!conditionTarget && (
                                <div className="flex items-center border-b border-border shrink-0 px-6 gap-0">
                                    {(["screener", "survey"] as const).filter((tab) => !hiddenTabs.has(tab)).map((tab) => (
                                        <div key={tab} className="group relative flex items-center">
                                            <button onClick={() => setActiveTab(tab)}
                                                className={`px-5 py-3 text-xs font-bold uppercase tracking-widest transition-all border-b-2 -mb-px ${
                                                    activeTab === tab
                                                        ? "border-primary text-primary"
                                                        : "border-transparent text-muted-foreground hover:text-foreground"
                                                }`}
                                            >
                                                {tab}
                                                <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full font-black ${activeTab === tab ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                                                    {tab === "screener" ? screenerDraft.length : surveyDraft.length}
                                                </span>
                                                {((tab === "screener" && screenerDirty) || (tab === "survey" && surveyDirty)) && (
                                                    <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-amber-500 align-middle" />
                                                )}
                                            </button>
                                            <button
                                                onClick={() => toggleTabHidden(tab)}
                                                title={`Hide ${tab} quotas`}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 -ml-1 mr-1 text-muted-foreground/50 hover:text-muted-foreground"
                                            >
                                                <IconEyeOff size={12} />
                                            </button>
                                        </div>
                                    ))}
                                    {(["screener", "survey"] as const).filter((tab) => hiddenTabs.has(tab)).map((tab) => (
                                        <button key={tab} onClick={() => toggleTabHidden(tab)}
                                            title={`Show ${tab} quotas`}
                                            className="ml-auto flex items-center gap-1.5 px-2 py-1 mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 hover:text-muted-foreground border border-dashed border-border rounded-md"
                                        >
                                            <IconEye size={12} />
                                            Show {tab}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Content */}
                            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                                {loading ? (
                                    <div className="h-full flex items-center justify-center">
                                        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                                    </div>
                                ) : conditionTarget ? (
                                    isScreenerConditionBuilder ? (
                                        <ConditionBuilderPanel
                                            key={conditionTarget.id}
                                            quota={conditionTarget}
                                            questionList={questionListForConditions}
                                            gleLinked={gleLinked}
                                            onDone={screenerSaveConditions}
                                            onCancel={() => setConditionTarget(null)}
                                        />
                                    ) : (
                                        <SurveyRuleBuilderPanel
                                            key={conditionTarget.id}
                                            quota={conditionTarget}
                                            flowNodes={flowNodes}
                                            onDone={surveySaveRule}
                                            onCancel={() => setConditionTarget(null)}
                                        />
                                    )
                                ) : activeTab === "screener" ? (
                                    <>
                                        <div className="flex-1 overflow-hidden min-h-0">
                                            <QuotaTable
                                                quotas={screenerDraft}
                                                questionList={screenerQuestions}
                                                gleLinked={gleLinked}
                                                screenerLinked={gleLinked}
                                                onAdd={screenerAdd}
                                                onNameChange={screenerPatchName}
                                                onLimitChange={screenerPatchLimit}
                                                onToggleActive={screenerToggle}
                                                onDelete={screenerDelete}
                                                onDuplicate={screenerDuplicate}
                                                onOpenConditions={setConditionTarget}
                                            />
                                        </div>

                                        {/* Save / Discard bar */}
                                        <AnimatePresence>
                                            {screenerDirty && (
                                                <motion.div
                                                    initial={{ y: 16, opacity: 0 }}
                                                    animate={{ y: 0, opacity: 1 }}
                                                    exit={{ y: 16, opacity: 0 }}
                                                    transition={{ duration: 0.18 }}
                                                    className="shrink-0 flex items-center justify-between gap-4 px-6 py-3 border-t border-amber-200 bg-amber-50"
                                                >
                                                    <span className="text-xs font-semibold text-amber-700 flex items-center gap-2">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                                                        You have unsaved changes to screener quotas
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={handleScreenerDiscard}
                                                            disabled={screenerSaving}
                                                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border bg-background text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-all disabled:opacity-50"
                                                        >
                                                            <IconRotate size={13} /> Discard Changes
                                                        </button>
                                                        <button
                                                            onClick={handleScreenerSave}
                                                            disabled={screenerSaving}
                                                            className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-foreground text-background text-xs font-bold hover:opacity-90 transition-all disabled:opacity-60 shadow-sm"
                                                        >
                                                            {screenerSaving
                                                                ? <div className="w-3.5 h-3.5 border-2 border-background border-t-transparent rounded-full animate-spin" />
                                                                : <IconDeviceFloppy size={13} />}
                                                            {screenerSaving ? "Saving…" : "Save Changes"}
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex-1 overflow-hidden min-h-0">
                                            <QuotaTable
                                                quotas={surveyDraft}
                                                questionList={surveyQuestionList}
                                                onAdd={surveyAdd}
                                                onNameChange={surveyPatchName}
                                                onLimitChange={surveyPatchLimit}
                                                onToggleActive={surveyToggle}
                                                onDelete={surveyDelete}
                                                onDuplicate={surveyDuplicate}
                                                onOpenConditions={setConditionTarget}
                                            />
                                        </div>

                                        {/* Save / Discard bar */}
                                        <AnimatePresence>
                                            {surveyDirty && (
                                                <motion.div
                                                    initial={{ y: 16, opacity: 0 }}
                                                    animate={{ y: 0, opacity: 1 }}
                                                    exit={{ y: 16, opacity: 0 }}
                                                    transition={{ duration: 0.18 }}
                                                    className="shrink-0 flex items-center justify-between gap-4 px-6 py-3 border-t border-amber-200 bg-amber-50"
                                                >
                                                    <span className="text-xs font-semibold text-amber-700 flex items-center gap-2">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                                                        You have unsaved changes to survey quotas
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={handleSurveyDiscard}
                                                            disabled={surveySaving}
                                                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border bg-background text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-all disabled:opacity-50"
                                                        >
                                                            <IconRotate size={13} /> Discard Changes
                                                        </button>
                                                        <button
                                                            onClick={handleSurveySave}
                                                            disabled={surveySaving}
                                                            className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-foreground text-background text-xs font-bold hover:opacity-90 transition-all disabled:opacity-60 shadow-sm"
                                                        >
                                                            {surveySaving
                                                                ? <div className="w-3.5 h-3.5 border-2 border-background border-t-transparent rounded-full animate-spin" />
                                                                : <IconDeviceFloppy size={13} />}
                                                            {surveySaving ? "Saving…" : "Save Changes"}
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </ModalPortal>
    );
}
