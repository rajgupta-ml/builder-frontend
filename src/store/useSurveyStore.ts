import { create } from 'zustand';
import {
    type Node as ReactFlowNode,
    type Edge as ReactFlowEdge,
    applyNodeChanges,
    applyEdgeChanges,
    addEdge,
    type OnNodesChange,
    type OnEdgesChange,
    type OnConnect
} from '@xyflow/react';
import { surveyApi } from '@/api/survey';
import { surveyWorkflowApi } from '@/api/surveyWorkflow';
import { quotaApi } from '@/api/quota';
import { operationsApi } from '@/api/operations';
import { toast } from 'sonner';
import { Survey, SurveyQuota } from '@/src/shared/types/survey';
import { hydrateNodeIds } from '@/lib/hydrateNodeIds';
import { migrateSkipNodes } from '@/lib/skipMigration';
import { toUserMessage } from '@/lib/api-error';
import { reportApiError } from '@/lib/error-reporter';
import { generateUniqueId } from '@/lib/utils';

interface SurveyState {
    // ReactFlow state
    nodes: ReactFlowNode[];
    edges: ReactFlowEdge[];
    selectedNodeId: string | null;

    // Metadata
    survey: Survey | any | null;
    quotas: SurveyQuota[];
    versions: any[];
    workflowId: string | null;

    // Status
    saveStatus: 'saved' | 'saving' | 'error' | 'unsaved';
    isPublishing: boolean;
    isSyncingTest: boolean;
    isReadOnly: boolean;
    selectedVersionId: string | null;

    // Computed
    hasChanges: boolean;
    loadRequestId: number;
    loadError: string | null;
    autosaveInFlight: boolean;
    autosavePending: boolean;
    autosavePendingRuntimeJson: any | null;
    autosaveRequestSeq: number;
    lastSavedAt: string | null;

    // Actions
    setNodes: (nodes: ReactFlowNode[]) => void;
    setEdges: (edges: ReactFlowEdge[]) => void;
    onNodesChange: OnNodesChange;
    onEdgesChange: OnEdgesChange;
    onConnect: OnConnect;
    setSelectedNodeId: (id: string | null) => void;
    setSaveStatus: (status: 'saved' | 'saving' | 'error' | 'unsaved') => void;
    updateNodeData: (nodeId: string, data: Record<string, any>) => void;

    // Data Loaders
    loadSurveyData: (surveyId: string) => Promise<void>;
    refreshSurveyData: (surveyId: string) => Promise<void>;

    // Workflow Actions
    autosave: (surveyId: string, runtimeJson: any) => Promise<void>;
    publish: (surveyId: string, mode: 'LIVE' | 'TEST') => Promise<void>;
    pause: (surveyId: string) => Promise<void>;
    close: (surveyId: string) => Promise<void>;
    resume: (surveyId: string) => Promise<void>;
    selectVersion: (surveyId: string, versionId: string | null) => Promise<void>;
    duplicateNode: () => void;
}

const newUuid = (): string => {
    if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
        return globalThis.crypto.randomUUID();
    }
    return generateUniqueId('id');
};


const needsTechnicalId = (type?: string | null): boolean => (
    Boolean(type) && !['start', 'end', 'branch', 'skip', 'validation', 'merge', 'branchOut'].includes(String(type))
);

const cloneRecord = (source: Record<string, any>): Record<string, any> => JSON.parse(JSON.stringify(source || {}));

const ensureStableNodeDataIds = (type: string | undefined, source: Record<string, any>): { data: Record<string, any>; changed: boolean } => {
    const data = cloneRecord(source);
    let changed = false;

    const ensureKey = (record: Record<string, any>, key: string) => {
        if (typeof record[key] !== 'string' || record[key].trim().length === 0) {
            record[key] = newUuid();
            changed = true;
        }
    };

    const ensureExportIds = (items: unknown) => {
        if (!Array.isArray(items)) return;
        items.forEach((item) => {
            if (item && typeof item === 'object') ensureKey(item as Record<string, any>, 'exportId');
        });
    };

    if (needsTechnicalId(type)) ensureKey(data, 'technicalId');

    if (['singleChoice', 'multipleChoice', 'dropdown', 'ranking', 'emojiRating'].includes(String(type))) {
        ensureExportIds(data.options);
    }

    if (['image', 'video', 'audio'].includes(String(type))) {
        ensureExportIds(data.choices);
    }

    if (['rating', 'slider'].includes(String(type))) {
        ensureExportIds(data.items);
    }

    if (type === 'matrixChoice') {
        ensureExportIds(data.rows);
        ensureExportIds(data.columns);
    }

    if (type === 'cascadingChoice' && Array.isArray(data.steps)) {
        data.steps.forEach((step: any) => {
            if (!step || typeof step !== 'object') return;
            ensureKey(step, 'exportId');
            ensureExportIds(step.options);
        });
    }

    if (type === 'multiInput' && Array.isArray(data.fields)) {
        data.fields.forEach((field: any) => {
            if (!field || typeof field !== 'object') return;
            ensureKey(field, 'id');
            ensureKey(field, 'exportId');
        });
    }

    return { data, changed };
};

const ensureStableNodeIds = (nodes: ReactFlowNode[]): { nodes: ReactFlowNode[]; changed: boolean } => {
    let changed = false;
    const repairedNodes = nodes.map((node) => {
        const repaired = ensureStableNodeDataIds(node.type, (node.data || {}) as Record<string, any>);
        if (!repaired.changed) return node;
        changed = true;
        return { ...node, data: repaired.data };
    });
    return { nodes: repairedNodes, changed };
};

const regenerateDuplicatedNodeDataIds = (source: Record<string, any>): Record<string, any> => {
    const data = JSON.parse(JSON.stringify(source || {}));
    data.technicalId = newUuid();

    const withExportIds = (items: any[]) =>
        items.map((item: any) => ({
            ...item,
            exportId: newUuid(),
        }));

    if (Array.isArray(data.options)) data.options = withExportIds(data.options);
    if (Array.isArray(data.items)) data.items = withExportIds(data.items);
    if (Array.isArray(data.rows)) data.rows = withExportIds(data.rows);
    if (Array.isArray(data.columns)) data.columns = withExportIds(data.columns);
    if (Array.isArray(data.choices)) data.choices = withExportIds(data.choices);

    if (Array.isArray(data.fields)) {
        data.fields = data.fields.map((field: any) => ({
            ...field,
            id: newUuid(),
            exportId: newUuid(),
        }));
    }

    if (Array.isArray(data.steps)) {
        data.steps = data.steps.map((step: any) => ({
            ...step,
            exportId: newUuid(),
            options: Array.isArray(step?.options) ? withExportIds(step.options) : [],
        }));
    }

    return data;
};

export const useSurveyStore = create<SurveyState>((set, get) => ({
    nodes: [],
    edges: [],
    selectedNodeId: null,
    survey: null,
    quotas: [],
    versions: [],
    workflowId: null,
    saveStatus: 'saved',
    isPublishing: false,
    isSyncingTest: false,
    isReadOnly: false,
    selectedVersionId: null,
    hasChanges: false,
    loadRequestId: 0,
    loadError: null,
    autosaveInFlight: false,
    autosavePending: false,
    autosavePendingRuntimeJson: null,
    autosaveRequestSeq: 0,
    lastSavedAt: null,

    setNodes: (nodes) => {
        const repaired = ensureStableNodeIds(nodes);
        set({ nodes: repaired.nodes, saveStatus: 'unsaved' });
    },
    setEdges: (edges) => set({ edges, saveStatus: 'unsaved' }),

    updateNodeData: (nodeId, newData) => {
        const { nodes, isReadOnly } = get();
        if (isReadOnly) return;
        set({
            nodes: nodes.map(n => {
                if (n.id !== nodeId) return n;
                const repaired = ensureStableNodeDataIds(n.type, { ...n.data, ...newData });
                return { ...n, data: repaired.data };
            }),
            saveStatus: 'unsaved'
        });
    },

    onNodesChange: (changes) => {
        const { nodes, isReadOnly } = get();
        if (isReadOnly) return;
        const removedIds = new Set(
            changes.filter((change) => change.type === 'remove').map((change) => change.id)
        );
        let nextNodes = applyNodeChanges(changes, nodes);
        if (removedIds.size > 0) {
            // Detach skip rules that jumped to a deleted node; validation surfaces the missing target.
            nextNodes = nextNodes.map((node) => {
                const skips = Array.isArray((node.data as any)?.skips) ? (node.data as any).skips : null;
                if (!skips || !skips.some((rule: any) => rule && removedIds.has(rule.targetId))) return node;
                return {
                    ...node,
                    data: {
                        ...node.data,
                        skips: skips.map((rule: any) => (
                            rule && removedIds.has(rule.targetId) ? { ...rule, targetId: null } : rule
                        )),
                    },
                };
            });
        }
        set({
            nodes: nextNodes,
            saveStatus: 'unsaved'
        });
    },

    onEdgesChange: (changes) => {
        const { edges, isReadOnly } = get();
        if (isReadOnly) return;
        set({
            edges: applyEdgeChanges(changes, edges),
            saveStatus: 'unsaved'
        });
    },

    onConnect: (connection) => {
        const { edges, nodes, isReadOnly } = get();
        if (isReadOnly) return;
        if (!connection.source || !connection.target) return;
        if (connection.source === connection.target) return;

        const sourceNode = nodes.find((node) => node.id === connection.source);
        const targetNode = nodes.find((node) => node.id === connection.target);
        if (!sourceNode || !targetNode) return;

        const isBranchLikeSource = sourceNode.type === 'branch' || sourceNode.type === 'validation' || sourceNode.type === 'branchOut';
        const allowsMultipleIncoming = targetNode.type === 'merge';

        const hasDuplicate = edges.some((edge) =>
            edge.source === connection.source &&
            edge.target === connection.target &&
            (edge.sourceHandle ?? null) === (connection.sourceHandle ?? null) &&
            (allowsMultipleIncoming || (edge.targetHandle ?? null) === (connection.targetHandle ?? null))
        );
        if (hasDuplicate) return;

        const constrainedEdges = edges.filter((edge) => {
            // Most nodes accept one incoming edge; merge nodes intentionally accept many.
            if (edge.target === connection.target && !allowsMultipleIncoming) {
                return false;
            }

            if (edge.source !== connection.source) {
                return true;
            }

            // Regular nodes keep a single outgoing edge; skip jumps live in node data, not edges.
            if (!isBranchLikeSource) {
                return false;
            }

            // Branch-like sources can have multiple outgoing edges, but only one per handle.
            const existingSourceHandle = edge.sourceHandle ?? null;
            const incomingSourceHandle = connection.sourceHandle ?? null;
            if (existingSourceHandle === incomingSourceHandle) {
                return false;
            }

            return true;
        });

        set({
            edges: addEdge({ ...connection, type: 'default' }, constrainedEdges),
            saveStatus: 'unsaved'
        });
    },

    setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId }),
    setSaveStatus: (saveStatus) => set({ saveStatus }),

    loadSurveyData: async (surveyId) => {
        const requestId = get().loadRequestId + 1;
        set({ loadRequestId: requestId, loadError: null });
        try {
            const [survey, versions, quotas, workflow] = await Promise.all([
                surveyApi.getSurvey(surveyId),
                surveyWorkflowApi.getWorkflowsMetadata(surveyId),
                quotaApi.getQuotas(surveyId),
                surveyWorkflowApi.getLatestWorkflowBySurveyId(surveyId)
            ]);

            if (get().loadRequestId !== requestId) {
                return;
            }

            const hasDbChanges = versions.length > 0 && versions[0].status === 'DRAFT';

            // Hydrate design nodes with stable IDs from runtimeJson
            // so generateRuntimeJson won't regenerate UUIDs on autosave
            const rawNodes = workflow?.designJson?.nodes || [];
            const hydratedNodes = workflow?.runtimeJson
                ? hydrateNodeIds(rawNodes, workflow.runtimeJson)
                : rawNodes;
            const repaired = ensureStableNodeIds(hydratedNodes);
            const migrated = migrateSkipNodes(repaired.nodes, workflow?.designJson?.edges || []);

            set({
                survey,
                versions,
                quotas,
                workflowId: workflow?.id || null,
                nodes: migrated.nodes,
                edges: migrated.edges,
                isReadOnly: false,
                selectedVersionId: null,
                hasChanges: hasDbChanges || repaired.changed || migrated.changed,
                loadError: null,
                lastSavedAt: null,
                // Autosave repaired legacy ids / migrated skip nodes after load
                saveStatus: repaired.changed || migrated.changed ? 'unsaved' : 'saved'
            });
        } catch (err) {
            console.error("Failed to load survey data", err);
            if (get().loadRequestId === requestId) {
                const message = toUserMessage(err, "Failed to load survey data");
                set({ loadError: message });
                toast.error(message);
            }
            reportApiError(err, { location: "useSurveyStore.loadSurveyData", surveyId });
        }
    },

    refreshSurveyData: async (surveyId) => {
        const requestId = get().loadRequestId + 1;
        set({ loadRequestId: requestId, loadError: null });
        try {
            const [survey, versions] = await Promise.all([
                surveyApi.getSurvey(surveyId),
                surveyWorkflowApi.getWorkflowsMetadata(surveyId)
            ]);
            if (get().loadRequestId !== requestId) {
                return;
            }

            const hasDbChanges = versions.length > 0 && versions[0].status === 'DRAFT';

            set({
                survey,
                versions,
                loadError: null,
                hasChanges: hasDbChanges
            });
        } catch (err) {
            console.error("Failed to refresh survey data", err);
            if (get().loadRequestId === requestId) {
                toast.error(toUserMessage(err, "Failed to refresh survey data"));
            }
            reportApiError(err, { location: "useSurveyStore.refreshSurveyData", surveyId });
        }
    },

    autosave: async (surveyId, runtimeJson) => {
        const state = get();
        if (state.autosaveInFlight) {
            set({
                autosavePending: true,
                autosavePendingRuntimeJson: runtimeJson,
                saveStatus: 'unsaved',
            });
            return;
        }

        const { nodes, edges, workflowId } = get();
        const requestSeq = get().autosaveRequestSeq + 1;
        set({
            saveStatus: 'saving',
            autosaveInFlight: true,
            autosaveRequestSeq: requestSeq,
        });

        try {
            const data = await surveyWorkflowApi.autosaveWorkflow({
                surveyId,
                workflowId,
                designJson: { nodes, edges },
                runtimeJson
            });

            // Refresh versions to update change detection
            const versions = await surveyWorkflowApi.getWorkflowsMetadata(surveyId);
            if (get().autosaveRequestSeq !== requestSeq) {
                return;
            }

            const hasDbChanges = versions.length > 0 && versions[0].status === 'DRAFT';

            set({
                workflowId: data.id,
                saveStatus: 'saved',
                versions,
                lastSavedAt: new Date().toISOString(),
                hasChanges: hasDbChanges
            });
        } catch (err) {
            console.error("Save failed", err);
            if (get().autosaveRequestSeq === requestSeq) {
                set({ saveStatus: 'error' });
            }
            reportApiError(err, { location: "useSurveyStore.autosave", surveyId });
        } finally {
            const hasPending = get().autosavePending;
            const pendingRuntimeJson = get().autosavePendingRuntimeJson;
            set({
                autosaveInFlight: false,
                autosavePending: false,
                autosavePendingRuntimeJson: null,
            });

            if (hasPending && pendingRuntimeJson) {
                void get().autosave(surveyId, pendingRuntimeJson);
            }
        }
    },

    publish: async (surveyId, mode) => {
        if (mode === 'LIVE') set({ isPublishing: true });
        else set({ isSyncingTest: true });

        try {
            const accepted = await surveyApi.publish(surveyId, mode);
            const op = await operationsApi.waitForOperation(accepted.operationId);

            if (op.status !== "SUCCEEDED") {
                throw new Error(op.errorDetail || "Publish operation failed");
            }

            // Refresh all data
            const [survey, versions] = await Promise.all([
                surveyApi.getSurvey(surveyId),
                surveyWorkflowApi.getWorkflowsMetadata(surveyId)
            ]);

            set({
                survey,
                versions,
                hasChanges: false
            });

            if (mode === 'LIVE') {
                const resultPayload = op.resultPayload as Record<string, unknown> | null | undefined;
                if (resultPayload?.runnerVerificationWarning) {
                    toast.success("Published to LIVE. Runner verification pending — survey will activate shortly.");
                } else {
                    toast.success("Successfully published to LIVE mode!");
                }
            }
        } catch (error: any) {
            if (error?.code === "OPERATION_TIMEOUT") {
                toast.info("Publish is still processing in background. We will refresh status shortly.");
                try {
                    await get().refreshSurveyData(surveyId);
                } catch {
                    // no-op
                }
                return;
            }

            // Reconcile local UI state with backend even when operation polling reports failure.
            // This avoids stale "Publish to Live" UI when publish side effects were actually applied.
            try {
                await get().refreshSurveyData(surveyId);
                const refreshedStatus = get().survey?.status;
                if (mode === 'LIVE' && (refreshedStatus === 'LIVE' || refreshedStatus === 'PAUSED')) {
                    toast.warning("Survey is live, but publish verification failed. UI has been refreshed.");
                    return;
                }
            } catch {
                // no-op; preserve original error handling below
            }

            console.error("Publish failed", error);
            toast.error(toUserMessage(error, "Failed to publish survey"));
            reportApiError(error, { location: "useSurveyStore.publish", surveyId, mode });
        } finally {
            if (mode === 'LIVE') set({ isPublishing: false });
            else set({ isSyncingTest: false });
        }
    },

    pause: async (surveyId) => {
        try {
            const accepted = await surveyApi.pause(surveyId);
            const op = await operationsApi.waitForOperation(accepted.operationId);
            if (op.status !== "SUCCEEDED") {
                throw new Error(op.errorDetail || "Pause operation failed");
            }

            const survey = await surveyApi.getSurvey(surveyId);
            set({ survey });
            toast.success("Survey Paused");
        } catch (error: any) {
            if (error?.code === "OPERATION_TIMEOUT") {
                toast.info("Pause is still processing. Refreshing shortly.");
                try {
                    await get().refreshSurveyData(surveyId);
                } catch {
                    // no-op
                }
                return;
            }
            toast.error(toUserMessage(error, "Failed to pause"));
            reportApiError(error, { location: "useSurveyStore.pause", surveyId });
        }
    },

    close: async (surveyId) => {
        try {
            const accepted = await surveyApi.close(surveyId);
            const op = await operationsApi.waitForOperation(accepted.operationId);
            if (op.status !== "SUCCEEDED") {
                throw new Error(op.errorDetail || "Close operation failed");
            }

            const survey = await surveyApi.getSurvey(surveyId);
            set({ survey });
            toast.success("Survey Closed");
        } catch (error: any) {
            if (error?.code === "OPERATION_TIMEOUT") {
                toast.info("Close is still processing. Refreshing shortly.");
                try {
                    await get().refreshSurveyData(surveyId);
                } catch {
                    // no-op
                }
                return;
            }
            toast.error(toUserMessage(error, "Failed to close"));
            reportApiError(error, { location: "useSurveyStore.close", surveyId });
        }
    },

    resume: async (surveyId) => {
        try {
            const accepted = await surveyApi.publish(surveyId, 'LIVE');
            const op = await operationsApi.waitForOperation(accepted.operationId);
            if (op.status !== "SUCCEEDED") {
                throw new Error(op.errorDetail || "Resume operation failed");
            }

            const survey = await surveyApi.getSurvey(surveyId);
            set({ survey });
            toast.success("Survey Resumed");
        } catch (error) {
            if ((error as any)?.code === "OPERATION_TIMEOUT") {
                toast.info("Resume is still processing. Refreshing shortly.");
                try {
                    await get().refreshSurveyData(surveyId);
                } catch {
                    // no-op
                }
                return;
            }
            toast.error(toUserMessage(error, "Failed to resume"));
            reportApiError(error, { location: "useSurveyStore.resume", surveyId });
        }
    },

    selectVersion: async (surveyId, versionId) => {
        set({ selectedVersionId: versionId });
        if (versionId) {
            set({ isReadOnly: true });
            try {
                const data = await surveyWorkflowApi.getWorkflowById(versionId);
                if (data && data.designJson) {
                    const migrated = migrateSkipNodes(data.designJson.nodes || [], data.designJson.edges || []);
                    set({
                        nodes: migrated.nodes,
                        edges: migrated.edges,
                        workflowId: data.id,
                        saveStatus: 'saved' // Prevent autosave when viewing version history
                    });
                }
            } catch (err) {
                console.error("Failed to load version", err);
                toast.error("Failed to load version history");
                reportApiError(err, { location: "useSurveyStore.selectVersion.version", surveyId, versionId });
            }
        } else {
            set({ isReadOnly: false });
            try {
                // Instead of reload, we should re-fetch current latest
                const workflow = await surveyWorkflowApi.getLatestWorkflowBySurveyId(surveyId);
                const rawNodes = workflow?.designJson?.nodes || [];
                const hydratedNodes = workflow?.runtimeJson
                    ? hydrateNodeIds(rawNodes, workflow.runtimeJson)
                    : rawNodes;
                const repaired = ensureStableNodeIds(hydratedNodes);
                const migrated = migrateSkipNodes(repaired.nodes, workflow?.designJson?.edges || []);

                set({
                    nodes: migrated.nodes,
                    edges: migrated.edges,
                    workflowId: workflow?.id || null,
                    saveStatus: repaired.changed || migrated.changed ? 'unsaved' : 'saved'
                });
            } catch (error) {
                console.error("Failed to load latest version", error);
                toast.error(toUserMessage(error, "Failed to load latest version"));
                reportApiError(error, { location: "useSurveyStore.selectVersion.latest", surveyId });
            }
        }
    },

    duplicateNode: () => {
        const { nodes, selectedNodeId, isReadOnly, setSelectedNodeId, setNodes } = get();
        if (isReadOnly || !selectedNodeId) return;

        const nodeToDuplicate = nodes.find(n => n.id === selectedNodeId);
        if (!nodeToDuplicate) return;

        const newNodeId = generateUniqueId('node');
        const newNode: ReactFlowNode = {
            ...nodeToDuplicate,
            id: newNodeId,
            selected: true,
            position: {
                x: nodeToDuplicate.position.x + 40,
                y: nodeToDuplicate.position.y + 40,
            },
            data: regenerateDuplicatedNodeDataIds(nodeToDuplicate.data || {})
        };

        // Deselect all existing nodes and add the new one
        const updatedNodes: ReactFlowNode[] = [
            ...nodes.map(n => ({
                ...n,
                selected: false
            })),
            newNode
        ];

        setNodes(updatedNodes);
        setSelectedNodeId(newNodeId);
        toast.info("Node duplicated");
    }
}));
