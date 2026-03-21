"use client";
import { useEffect, useMemo, useState } from "react";
import { quotaApi } from "@/api/quota";
import { SurveyQuota } from "@/src/shared/types/survey";
import { surveyWorkflowApi } from "@/api/surveyWorkflow";
import { toast } from "sonner";
import { IconPlus, IconTrash, IconToggleLeft, IconToggleRight, IconAlertCircle, IconX, IconPencil } from "@tabler/icons-react";
import { motion, AnimatePresence } from "framer-motion";
import { ConditionBuilder } from "../properties/ConditionBuilder";
import { LogicGroup } from "../nodes/definitions";
import { Node } from "@xyflow/react";
import { ModalPortal } from "@/components/ui/ModalPortal";

interface SurveyQuotaModalProps {
    isOpen: boolean;
    onClose: () => void;
    surveyId: string;
    onSave?: () => void;
}

export function SurveyQuotaModal({ isOpen, onClose, surveyId, onSave }: SurveyQuotaModalProps) {
    const [quotas, setQuotas] = useState<SurveyQuota[]>([]);
    const [loading, setLoading] = useState(false);
    const [flowNodes, setFlowNodes] = useState<Node[]>([]);
    const [globalQuota, setGlobalQuota] = useState<number | null>(null);

    // Internal Add Form State
    const [isAdding, setIsAdding] = useState(false);
    const [editingQuotaId, setEditingQuotaId] = useState<string | null>(null);
    const [newQuota, setNewQuota] = useState<{
        name: string;
        limit: string;
        limitType: 'absolute' | 'percentage';
        limitPercentage: string;
        logic: LogicGroup;
    }>({
        name: "",
        limit: "",
        limitType: 'absolute',
        limitPercentage: "",
        logic: {
            id: 'root',
            type: 'group',
            logicType: 'AND',
            children: []
        }
    });
    const ruleLookupMaps = useMemo(() => buildRuleLookupMaps(flowNodes), [flowNodes]);

    useEffect(() => {
        const controller = new AbortController();
        if (isOpen && surveyId) {
            fetchData(controller.signal);
        }
        return () => controller.abort();
    }, [isOpen, surveyId]);

    const fetchData = async (signal?: AbortSignal) => {
        setLoading(true);
        try {
            const { surveyApi } = await import('@/api/survey');
            const [quotasData, workflowData, surveyData] = await Promise.all([
                quotaApi.getQuotas(surveyId, { signal }),
                surveyWorkflowApi.getLatestWorkflowBySurveyId(surveyId, { signal }),
                surveyApi.getSurvey(surveyId, { signal })
            ]);
            if (signal?.aborted) return;
            setQuotas(quotasData);
            setGlobalQuota(surveyData.globalQuota);

            if (workflowData?.runtimeJson) {
                const runtimeData = workflowData.runtimeJson;
                if (typeof runtimeData !== 'object' || runtimeData === null) {
                    toast.error("Failed to load survey questions. Please refresh and try again.");
                    setFlowNodes([]);
                    return;
                }

                const mappedNodes: Node[] = Object.values(runtimeData).map((n: any) => ({
                    id: n.id,
                    type: n.type,
                    data: n.data,
                    position: { x: 0, y: 0 }
                }));
                setFlowNodes(mappedNodes);
            } else {
                toast.error("No survey questions found. Please create questions first.");
                setFlowNodes([]);
            }
        } catch (error) {
            if (signal?.aborted) return;
            console.error('[QuotaModal] Error loading quotas:', error);
            toast.error("Failed to load quotas");
        } finally {
            if (!signal?.aborted) {
                setLoading(false);
            }
        }
    };

    const handleEdit = (quota: SurveyQuota) => {
        setEditingQuotaId(quota.id);
        setNewQuota({
            name: quota.name || "",
            limit: quota.limit.toString(),
            limitType: 'absolute', // Defaulting to absolute as we don't persist the type
            limitPercentage: "",
            logic: quota.rule as LogicGroup
        });
        setIsAdding(true);
    };

    const handleCreateOrUpdate = async () => {
        // Validation
        if (!newQuota.name.trim()) {
            toast.error("Please enter a quota name.");
            return;
        }
        if (newQuota.logic.children.length === 0) {
            toast.error("Please add at least one condition.");
            return;
        }

        let finalLimit: number;

        if (newQuota.limitType === 'percentage') {
            if (!newQuota.limitPercentage) {
                toast.error("Please enter a percentage value.");
                return;
            }
            if (!globalQuota) {
                toast.error("Please set the Global Quota in survey settings first before using percentage-based quotas.");
                return;
            }
            const percentage = parseFloat(newQuota.limitPercentage);
            if (percentage <= 0 || percentage > 100) {
                toast.error("Percentage must be between 0 and 100.");
                return;
            }
            finalLimit = Math.round((percentage / 100) * globalQuota);
        } else {
            if (!newQuota.limit) {
                toast.error("Please enter a limit value.");
                return;
            }
            finalLimit = parseInt(newQuota.limit);
        }

        try {
            if (editingQuotaId) {
                const updated = await quotaApi.updateQuota(editingQuotaId, {
                    rule: newQuota.logic,
                    limit: finalLimit,
                    name: newQuota.name
                });
                setQuotas(quotas.map(q => q.id === editingQuotaId ? updated : q));
                toast.success("Quota updated");
            } else {
                const created = await quotaApi.createQuota(surveyId, {
                    rule: newQuota.logic,
                    limit: finalLimit,
                    isActive: true, // Default to active
                    name: newQuota.name
                });
                setQuotas([created, ...quotas]);
                toast.success("Quota created");
            }

            setIsAdding(false);
            setEditingQuotaId(null);
            setNewQuota({
                name: "",
                limit: "",
                limitType: 'absolute',
                limitPercentage: "",
                logic: { id: 'root', type: 'group', logicType: 'AND', children: [] }
            });

            if (onSave) onSave();
        } catch (error) {
            console.error(error);
            toast.error(editingQuotaId ? "Failed to update quota" : "Failed to create quota");
        }
    };

    const handleDelete = async (quotaId: string) => {
        if (!confirm("Are you sure you want to delete this quota?")) return;
        try {
            await quotaApi.deleteQuota(quotaId);
            setQuotas(quotas.filter(q => q.id !== quotaId));
            toast.success("Quota deleted");
            if (onSave) onSave();
        } catch (error) {
            toast.error("Failed to delete quota");
        }
    };

    const handleToggle = async (quotaId: string, currentStatus: boolean) => {
        try {
            const updated = await quotaApi.toggleQuota(quotaId, !currentStatus);
            setQuotas(quotas.map(q => q.id === quotaId ? updated : q));
            if (onSave) onSave();
        } catch (error) {
            toast.error("Failed to update quota");
        }
    };

    return (
        <ModalPortal>
            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-120 h-dvh w-screen flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-background border border-border shadow-2xl rounded-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90dvh]"
                        >
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30">
                            <div>
                                <h3 className="text-xl font-bold">Quota Management</h3>
                                <p className="text-xs text-muted-foreground">Define demographic limits (e.g. Max 50 responses for Age=18).</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {!isAdding && (
                                    <button
                                        onClick={() => setIsAdding(true)}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90 transition-all"
                                    >
                                        <IconPlus size={16} /> Add Rule
                                    </button>
                                )}
                                <button title="X Icon" onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
                                    <IconX size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {loading ? (
                                <div className="py-12 flex justify-center">
                                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : (
                                <>
                                    {/* Add Form */}
                                    {isAdding && (
                                        <div className="bg-muted/30 border border-primary/20 rounded-xl p-4 mb-4 animate-in slide-in-from-top-2">
                                            <div className="flex items-center justify-between mb-4 gap-4">
                                                <div className="flex-1">
                                                    <label className="text-xs font-semibold block mb-1">Quota Name</label>
                                                    <input
                                                        type="text"
                                                        placeholder="e.g. Female 18-24"
                                                        className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                                                        value={newQuota.name}
                                                        onChange={(e) => setNewQuota({ ...newQuota, name: e.target.value })}
                                                    />
                                                </div>

                                                <div className="flex flex-col items-end gap-1">
                                                    <label className="text-xs font-semibold">&nbsp;</label>
                                                    <div className="flex items-center gap-4">
                                                        {/* Limit Type Toggle */}
                                                        <div className="flex bg-background border border-border rounded-lg p-1">
                                                            <button
                                                                onClick={() => setNewQuota({ ...newQuota, limitType: 'absolute' })}
                                                                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${newQuota.limitType === 'absolute' ? 'bg-primary text-white shadow-sm' : 'hover:bg-muted text-muted-foreground'}`}
                                                            >
                                                                Absolute
                                                            </button>
                                                            <button
                                                                onClick={() => setNewQuota({ ...newQuota, limitType: 'percentage' })}
                                                                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${newQuota.limitType === 'percentage' ? 'bg-primary text-white shadow-sm' : 'hover:bg-muted text-muted-foreground'}`}
                                                            >
                                                                Percentage
                                                            </button>
                                                        </div>

                                                        {/* Input Fields */}
                                                        <div className="flex items-center gap-2">
                                                            {newQuota.limitType === 'absolute' ? (
                                                                <input
                                                                    type="number"
                                                                    placeholder="e.g. 100"
                                                                    className="w-24 bg-background border border-border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                                                                    value={newQuota.limit}
                                                                    onChange={(e) => setNewQuota({ ...newQuota, limit: e.target.value })}
                                                                />
                                                            ) : (
                                                                <div className="relative">
                                                                    <input
                                                                        type="number"
                                                                        placeholder="50"
                                                                        className="w-24 bg-background border border-border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 pr-8"
                                                                        value={newQuota.limitPercentage}
                                                                        onChange={(e) => setNewQuota({ ...newQuota, limitPercentage: e.target.value })}
                                                                    />
                                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">%</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {newQuota.limitType === 'percentage' && globalQuota === null && (
                                                <div className="mb-4 text-xs text-amber-600 bg-amber-50 border border-amber-200 p-2 rounded-md flex items-center gap-2">
                                                    <IconAlertCircle size={14} />
                                                    Warning: Global Quota is not set. You must set a global quota in settings before saving.
                                                </div>
                                            )}

                                            <div className="bg-background border border-border rounded-xl p-2 min-h-[150px]">
                                                <ConditionBuilder
                                                    nodes={flowNodes}
                                                    value={newQuota.logic}
                                                    onChange={(logic) => setNewQuota({ ...newQuota, logic })}
                                                    fieldKeyMode="technicalId"
                                                    optionKeyMode="exportId"
                                                />
                                            </div>

                                            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border/50">
                                                <button onClick={() => { setIsAdding(false); setEditingQuotaId(null); }} className="px-4 py-2 text-sm font-medium hover:bg-muted rounded-lg transition-colors">Cancel</button>
                                                <button onClick={handleCreateOrUpdate} className="px-6 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary/90 shadow-md shadow-primary/20">
                                                    {editingQuotaId ? "Update Quota Rule" : "Save Quota Rule"}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* List */}
                                    {quotas.length === 0 && !isAdding ? (
                                        <div className="text-center py-16 bg-muted/20 rounded-2xl border-2 border-dashed border-border">
                                            <IconAlertCircle className="mx-auto mb-3 text-muted-foreground/50" size={48} />
                                            <h4 className="text-lg font-bold text-muted-foreground">No Quotas Defined</h4>
                                            <p className="text-sm text-muted-foreground max-w-xs mx-auto">Create rules to limit how many people with certain demographics can take your survey.</p>
                                        </div>
                                    ) : (
                                        <div className="grid gap-3">
                                            {quotas.map(quota => (
                                                <div key={quota.id} className="flex items-center justify-between p-5 bg-card border border-border rounded-2xl hover:shadow-md transition-all group">
                                                    <div className="flex-1 space-y-2">
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">{quota.name || 'Complex Quota Rule'}</p>
                                                        </div>
                                                        <div className="bg-muted/30 p-3 rounded-xl border border-border/50">
                                                            <p className="text-sm font-medium leading-relaxed">
                                                                {summarizeRule(quota.rule, flowNodes, ruleLookupMaps)}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-4 text-xs font-bold">
                                                            <span className="text-muted-foreground">MAX LIMIT:</span>
                                                            <span className="text-primary bg-primary/5 px-2 py-0.5 rounded-md border border-primary/10">
                                                                {quota.limit.toLocaleString()} Responses
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4 pl-6 border-l border-border ml-6">
                                                        <button
                                                            onClick={() => handleEdit(quota)}
                                                            className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
                                                            title="Edit Rule"
                                                        >
                                                            <IconPencil size={20} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleToggle(quota.id, quota.isActive)}
                                                            className="transition-all active:scale-95"
                                                            title={quota.isActive ? "Deactivate" : "Activate"}
                                                        >
                                                            {quota.isActive ? <IconToggleRight size={32} className="text-emerald-500" /> : <IconToggleLeft size={32} className="text-muted-foreground/50" />}
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(quota.id)}
                                                            className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all"
                                                            title="Delete Rule"
                                                        >
                                                            <IconTrash size={20} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </ModalPortal>
    );
}

const UUID_LIKE_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-9a-f][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isTechnicalIdLike = (value: unknown): value is string => {
    return typeof value === "string" && UUID_LIKE_REGEX.test(value.trim());
};

const normalizeLabel = (value: unknown, fallback: string): string => {
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
    return fallback;
};

type RuleLookupMaps = {
    fieldLabelByKey: Map<string, string>;
    valueLabelByKey: Map<string, string>;
};

const buildRuleLookupMaps = (nodes: Node[]): RuleLookupMaps => {
    const fieldLabelByKey = new Map<string, string>();
    const valueLabelByKey = new Map<string, string>();

    const setField = (key: unknown, label: string) => {
        if (typeof key !== "string" || !key.trim()) return;
        if (!fieldLabelByKey.has(key)) fieldLabelByKey.set(key, label);
    };

    const setValue = (key: unknown, label: string) => {
        if (typeof key !== "string" || !key.trim()) return;
        if (!valueLabelByKey.has(key)) valueLabelByKey.set(key, label);
    };

    for (const n of nodes) {
        const data: any = n.data || {};
        const nodeLabel = normalizeLabel(data.label || data.question || data.title, "Question");

        setField(n.id, nodeLabel);
        setField(data.id, nodeLabel);
        setField(data.technicalId, nodeLabel);
        setField(data.exportId, nodeLabel);

        const options = Array.isArray(data.options) ? data.options : [];
        for (const opt of options) {
            const label = normalizeLabel(opt?.label || opt?.text || opt?.title, "Option");
            setValue(opt?.exportId, label);
            setValue(opt?.id, label);
            setValue(opt?.value, label);
        }

        const items = Array.isArray(data.items) ? data.items : [];
        for (const opt of items) {
            const label = normalizeLabel(opt?.label || opt?.text || opt?.title, "Option");
            setValue(opt?.exportId, label);
            setValue(opt?.id, label);
            setValue(opt?.value, label);
        }

        const rows = Array.isArray(data.rows) ? data.rows : [];
        for (const row of rows) {
            const label = normalizeLabel(row?.label || row?.text || row?.title, "Row");
            setField(row?.exportId, `${nodeLabel} - ${label}`);
            setField(row?.id, `${nodeLabel} - ${label}`);
            setField(row?.value, `${nodeLabel} - ${label}`);
            setValue(row?.exportId, label);
            setValue(row?.id, label);
            setValue(row?.value, label);
        }

        const fields = Array.isArray(data.fields) ? data.fields : [];
        for (const f of fields) {
            const label = normalizeLabel(f?.label || f?.text || f?.title, "Field");
            setField(f?.exportId, `${nodeLabel} - ${label}`);
            setField(f?.id, `${nodeLabel} - ${label}`);
            setValue(f?.exportId, label);
            setValue(f?.id, label);
        }
    }

    return { fieldLabelByKey, valueLabelByKey };
};

function summarizeRule(item: any, nodes: Node[], lookup?: RuleLookupMaps): React.ReactNode {
    if (!item) return "No rule";
    const maps = lookup || buildRuleLookupMaps(nodes);

    if (item.type === 'group') {
        if (!item.children || item.children.length === 0) return "Always Matches";
        return (
            <span className="flex flex-wrap items-center gap-1.5">
                {item.children.map((child: any, i: number) => (
                    <span key={child.id} className="flex items-center gap-1.5">
                        <span className="border border-border rounded-lg p-1.5 bg-background shadow-xs">
                            {summarizeRule(child, nodes, maps)}
                        </span>
                        {i < item.children.length - 1 && (
                            <span className="text-[10px] font-black bg-primary text-white px-2 py-0.5 rounded shadow-sm">{item.logicType}</span>
                        )}
                    </span>
                ))}
            </span>
        );
    }
    const label =
        (typeof item.field === "string" ? maps.fieldLabelByKey.get(item.field) : undefined) ||
        (typeof item.field === "string" && !isTechnicalIdLike(item.field) ? item.field : undefined) ||
        "Unknown field";

    // Resolve value label if possible
    let displayValue = item.value;

    if (typeof item.value === "string" || typeof item.value === "number") {
        const rawValue = String(item.value);
        const mapped =
            maps.valueLabelByKey.get(rawValue) ||
            maps.fieldLabelByKey.get(rawValue);
        displayValue = mapped || (isTechnicalIdLike(rawValue) ? "Unknown option" : rawValue);
    } else if (typeof item.value === 'object' && item.value !== null) {
        if (item.operator === 'is_between') {
            displayValue = `${item.value.min} to ${item.value.max}`;
        } else {
            displayValue = "Complex value";
        }
    }

    const operatorDisplay = item.operator ? item.operator.replace(/_/g, ' ') : 'EQUALS';

    return (
        <span className="text-sm">
            <span className="font-bold text-foreground/70">{label}</span>
            <span className="mx-1.5 text-primary opacity-60 font-mono text-xs uppercase">{operatorDisplay}</span>
            <span className="font-black text-primary">"{displayValue}"</span>
        </span>
    );
}
