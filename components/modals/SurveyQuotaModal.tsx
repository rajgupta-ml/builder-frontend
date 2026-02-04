"use client";
import { useEffect, useState } from "react";
import { surveyApi } from "@/api/survey";
import { SurveyQuota, SurveyWorkflow } from "@/src/shared/types/survey";
import { surveyWorkflowApi } from "@/api/surveyWorkflow";
import { toast } from "sonner";
import { IconPlus, IconTrash, IconToggleLeft, IconToggleRight, IconAlertCircle, IconX, IconSettings } from "@tabler/icons-react";
import { cn, generateUniqueId } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { ConditionBuilder } from "../properties/ConditionBuilder";
import { LogicGroup, getNodeDefinition } from "../nodes/definitions";
import { Node } from "@xyflow/react";

interface SurveyQuotaModalProps {
    isOpen: boolean;
    onClose: () => void;
    surveyId: string;
}

export function SurveyQuotaModal({ isOpen, onClose, surveyId }: SurveyQuotaModalProps) {
    const [quotas, setQuotas] = useState<SurveyQuota[]>([]);
    const [loading, setLoading] = useState(false);
    const [flowNodes, setFlowNodes] = useState<Node[]>([]);

    // Internal Add Form State
    const [isAdding, setIsAdding] = useState(false);
    const [newQuota, setNewQuota] = useState<{
        limit: string;
        logic: LogicGroup;
    }>({
        limit: "",
        logic: {
            id: 'root',
            type: 'group',
            logicType: 'AND',
            children: []
        }
    });

    useEffect(() => {
        if (isOpen && surveyId) {
            fetchData();
        }
    }, [isOpen, surveyId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [quotasData, workflowData] = await Promise.all([
                surveyApi.getQuotas(surveyId),
                surveyWorkflowApi.getLatestWorkflowBySurveyId(surveyId)
            ]);
            setQuotas(quotasData);

            console.log('[QuotaModal] Workflow Data:', workflowData);
            console.log('[QuotaModal] Runtime JSON type:', typeof workflowData?.runtimeJson);
            console.log('[QuotaModal] Runtime JSON:', workflowData?.runtimeJson);

            if (workflowData?.runtimeJson) {
                // Check if runtimeJson is already an object or needs parsing
                let runtimeData = workflowData.runtimeJson;

                // If it's still a string, it might not have been decompressed
                if (typeof runtimeData === 'string') {
                    console.error('[QuotaModal] ERROR: runtimeJson is still a string, decompression may have failed');
                    toast.error("Failed to load survey questions. Please refresh and try again.");
                    return;
                }

                // Convert runtimeJson back to Node[] format for ConditionBuilder
                const mappedNodes: Node[] = Object.values(runtimeData).map((n: any) => ({
                    id: n.id,
                    type: n.type,
                    data: n.data,
                    position: { x: 0, y: 0 }
                }));

                console.log('[QuotaModal] Mapped Nodes:', mappedNodes);
                console.log('[QuotaModal] Total nodes found:', mappedNodes.length);

                setFlowNodes(mappedNodes);
            } else {
                console.warn('[QuotaModal] No runtimeJson found in workflow data');
                toast.error("No survey questions found. Please create questions first.");
            }
        } catch (error) {
            console.error('[QuotaModal] Error loading quotas:', error);
            toast.error("Failed to load quotas");
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!newQuota.limit || newQuota.logic.children.length === 0) {
            toast.error("Please add at least one condition and set a limit.");
            return;
        }

        try {
            const created = await surveyApi.createQuota(surveyId, {
                rule: newQuota.logic,
                limit: parseInt(newQuota.limit),
                enabled: true
            });
            setQuotas([created, ...quotas]);
            setIsAdding(false);
            setNewQuota({
                limit: "",
                logic: { id: 'root', type: 'group', logicType: 'AND', children: [] }
            });
            toast.success("Quota created");
        } catch (error) {
            toast.error("Failed to create quota");
        }
    };

    const handleDelete = async (quotaId: string) => {
        if (!confirm("Are you sure you want to delete this quota?")) return;
        try {
            await surveyApi.deleteQuota(quotaId);
            setQuotas(quotas.filter(q => q.id !== quotaId));
            toast.success("Quota deleted");
        } catch (error) {
            toast.error("Failed to delete quota");
        }
    };

    const handleToggle = async (quotaId: string, currentStatus: boolean) => {
        try {
            const updated = await surveyApi.toggleQuota(quotaId, !currentStatus);
            setQuotas(quotas.map(q => q.id === quotaId ? updated : q));
        } catch (error) {
            toast.error("Failed to update quota");
        }
    };

    const getNodeLabel = (nodeId: string) => flowNodes.find((n: Node) => n.id === nodeId)?.data?.label || nodeId;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        className="bg-background border border-border shadow-2xl rounded-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]"
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
                                <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
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
                                            <div className="flex items-center justify-between mb-4">
                                                <h4 className="text-sm font-bold text-primary">Target Selection (Complex Rules)</h4>
                                                <div className="flex items-center gap-3">
                                                    <label className="text-xs font-semibold">Response Limit:</label>
                                                    <input
                                                        type="number"
                                                        placeholder="Max"
                                                        className="w-24 bg-background border border-border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                                                        value={newQuota.limit}
                                                        onChange={(e) => setNewQuota({ ...newQuota, limit: e.target.value })}
                                                    />
                                                </div>
                                            </div>

                                            <div className="bg-background border border-border rounded-xl p-2 min-h-[150px]">
                                                <ConditionBuilder
                                                    nodes={flowNodes}
                                                    value={newQuota.logic}
                                                    onChange={(logic) => setNewQuota({ ...newQuota, logic })}
                                                />
                                            </div>

                                            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border/50">
                                                <button onClick={() => setIsAdding(false)} className="px-4 py-2 text-sm font-medium hover:bg-muted rounded-lg transition-colors">Cancel</button>
                                                <button onClick={handleCreate} className="px-6 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary/90 shadow-md shadow-primary/20">Save Quota Rule</button>
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
                                                            <div className="bg-primary/10 text-primary p-1.5 rounded-lg">
                                                                <IconSettings size={18} />
                                                            </div>
                                                            <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Complex Quota Rule</p>
                                                        </div>
                                                        <div className="bg-muted/30 p-3 rounded-xl border border-border/50">
                                                            <p className="text-sm font-medium leading-relaxed">
                                                                {summarizeRule(quota.rule, flowNodes)}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-4 text-xs font-bold">
                                                            <span className="text-muted-foreground">MAX LIMIT:</span>
                                                            <span className="text-primary bg-primary/5 px-2 py-0.5 rounded-md border border-primary/10">{quota.limit.toLocaleString()} Responses</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4 pl-6 border-l border-border ml-6">
                                                        <button
                                                            onClick={() => handleToggle(quota.id, quota.enabled)}
                                                            className="transition-all active:scale-95"
                                                            title={quota.enabled ? "Deactivate" : "Activate"}
                                                        >
                                                            {quota.enabled ? <IconToggleRight size={32} className="text-emerald-500" /> : <IconToggleLeft size={32} className="text-muted-foreground/50" />}
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
    );
}

function summarizeRule(item: any, nodes: Node[]): React.ReactNode {
    if (!item) return "No rule";

    if (item.type === 'group') {
        if (!item.children || item.children.length === 0) return "Always Matches";
        return (
            <span className="flex flex-wrap items-center gap-1.5">
                {item.children.map((child: any, i: number) => (
                    <span key={child.id} className="flex items-center gap-1.5">
                        <span className="border border-border rounded-lg p-1.5 bg-background shadow-xs">
                            {summarizeRule(child, nodes)}
                        </span>
                        {i < item.children.length - 1 && (
                            <span className="text-[10px] font-black bg-primary text-white px-2 py-0.5 rounded shadow-sm">{item.logicType}</span>
                        )}
                    </span>
                ))}
            </span>
        );
    }

    const node = nodes.find(n => n.id === item.field);
    const label = node?.data?.label || item.field || 'Question';

    // Resolve value label if possible
    let displayValue = item.value;
    if (node && typeof item.value === 'string') {
        const options = (node.data?.options as any[]) || [];
        const opt = options.find((o: any) => o.value === item.value);
        if (opt) displayValue = opt.label;
    } else if (typeof item.value === 'object' && item.value !== null) {
        if (item.operator === 'is_between') {
            displayValue = `${item.value.min} to ${item.value.max}`;
        } else {
            displayValue = JSON.stringify(item.value);
        }
    }

    return (
        <span className="text-sm">
            <span className="font-bold text-foreground/70">{label}</span>
            <span className="mx-1.5 text-primary opacity-60 font-mono text-xs uppercase">{item.operator.replace('_', ' ')}</span>
            <span className="font-black text-primary">"{displayValue}"</span>
        </span>
    );
}
