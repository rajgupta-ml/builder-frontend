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
import { toast } from 'sonner';
import { Survey, SurveyQuota } from '@/src/shared/types/survey';
import { hydrateNodeIds } from '@/lib/hydrateNodeIds';

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

    // Actions
    setNodes: (nodes: ReactFlowNode[]) => void;
    setEdges: (edges: ReactFlowEdge[]) => void;
    onNodesChange: OnNodesChange;
    onEdgesChange: OnEdgesChange;
    onConnect: OnConnect;
    setSelectedNodeId: (id: string | null) => void;
    setSaveStatus: (status: 'saved' | 'saving' | 'error' | 'unsaved') => void;

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
}

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

    setNodes: (nodes) => set({ nodes, saveStatus: 'unsaved' }),
    setEdges: (edges) => set({ edges }),

    onNodesChange: (changes) => {
        const { nodes, isReadOnly } = get();
        if (isReadOnly) return;
        set({ 
            nodes: applyNodeChanges(changes, nodes),
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
        const { edges, isReadOnly } = get();
        if (isReadOnly) return;
        set({ 
            edges: addEdge({ ...connection, type: 'custom' }, edges),
            saveStatus: 'unsaved'
        });
    },

    setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId }),
    setSaveStatus: (saveStatus) => set({ saveStatus }),

    loadSurveyData: async (surveyId) => {
        try {
            const [survey, versions, quotas, workflow] = await Promise.all([
                surveyApi.getSurvey(surveyId),
                surveyWorkflowApi.getWorkflowsMetadata(surveyId),
                quotaApi.getQuotas(surveyId),
                surveyWorkflowApi.getLatestWorkflowBySurveyId(surveyId)
            ]);

            const hasDbChanges = versions.length > 0 && versions[0].status === 'DRAFT';
            
            console.log(`[SurveyStore] Load Data - Latest Version: ${versions[0]?.version}, Status: ${versions[0]?.status}, hasDbChanges: ${hasDbChanges}`);

            // Hydrate design nodes with stable IDs from runtimeJson
            // so generateRuntimeJson won't regenerate UUIDs on autosave
            const rawNodes = workflow?.designJson?.nodes || [];
            const hydratedNodes = workflow?.runtimeJson 
                ? hydrateNodeIds(rawNodes, workflow.runtimeJson) 
                : rawNodes;

            set({
                survey,
                versions,
                quotas,
                workflowId: workflow?.id || null,
                nodes: hydratedNodes,
                edges: workflow?.designJson?.edges || [],
                hasChanges: hasDbChanges,
                saveStatus: 'saved' // Prevent autosave from triggering on initial load
            });
        } catch (err) {
            console.error("Failed to load survey data", err);
            toast.error("Failed to load survey data");
        }
    },

    refreshSurveyData: async (surveyId) => {
        try {
            const [survey, versions] = await Promise.all([
                surveyApi.getSurvey(surveyId),
                surveyWorkflowApi.getWorkflowsMetadata(surveyId)
            ]);
            
            const hasDbChanges = versions.length > 0 && versions[0].status === 'DRAFT';
            console.log(`[SurveyStore] Refresh Data - Latest Version: ${versions[0]?.version}, Status: ${versions[0]?.status}, hasDbChanges: ${hasDbChanges}`);

            set({ 
                survey, 
                versions,
                hasChanges: hasDbChanges
            });
        } catch (err) {
            console.error("Failed to refresh survey data", err);
        }
    },

    autosave: async (surveyId, runtimeJson) => {
        const { nodes, edges, workflowId } = get();
        set({ saveStatus: 'saving' });
        try {
            console.log(runtimeJson)
            const data = await surveyWorkflowApi.autosaveWorkflow({
                surveyId,
                workflowId,
                designJson: { nodes, edges },
                runtimeJson
            });
            
            // Refresh versions to update change detection
            const versions = await surveyWorkflowApi.getWorkflowsMetadata(surveyId);
            const survey = get().survey;

            const hasDbChanges = versions.length > 0 && versions[0].status === 'DRAFT';
            console.log(`[SurveyStore] Autosave - Latest Version: ${versions[0]?.version}, Status: ${versions[0]?.status}, hasDbChanges: ${hasDbChanges}`);

            set({ 
                workflowId: data.id, 
                saveStatus: 'saved',
                versions,
                hasChanges: hasDbChanges
            });
        } catch (err) {
            console.error("Save failed", err);
            set({ saveStatus: 'error' });
        }
    },

    publish: async (surveyId, mode) => {
        if (mode === 'LIVE') set({ isPublishing: true });
        else set({ isSyncingTest: true });

        try {
            await surveyApi.publish(surveyId, mode);
            
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

            if (mode === 'LIVE') toast.success("Successfully published to LIVE mode!");
        } catch (error: any) {
            console.error("Publish failed", error);
            const msg = error?.response?.data?.error || "Failed to publish survey";
            toast.error(msg);
        } finally {
            if (mode === 'LIVE') set({ isPublishing: false });
            else set({ isSyncingTest: false });
        }
    },

    pause: async (surveyId) => {
        try {
            await surveyApi.pause(surveyId);
            const survey = await surveyApi.getSurvey(surveyId);
            set({ survey });
            toast.success("Survey Paused");
        } catch (e) {
            toast.error("Failed to pause");
        }
    },

    close: async (surveyId) => {
        try {
            await surveyApi.close(surveyId);
            const survey = await surveyApi.getSurvey(surveyId);
            set({ survey });
            toast.success("Survey Closed");
        } catch (e) {
            toast.error("Failed to close");
        }
    },

    resume: async (surveyId) => {
        try {
            await surveyApi.publish(surveyId, 'LIVE');
            const survey = await surveyApi.getSurvey(surveyId);
            set({ survey });
            toast.success("Survey Resumed");
        } catch (e) {
            toast.error("Failed to resume");
        }
    },

    selectVersion: async (surveyId, versionId) => {
        set({ selectedVersionId: versionId });
        if (versionId) {
            set({ isReadOnly: true });
            try {
                const data = await surveyWorkflowApi.getWorkflowById(versionId);
                if (data && data.designJson) {
                    set({
                        nodes: data.designJson.nodes || [],
                        edges: data.designJson.edges || [],
                        workflowId: data.id,
                        saveStatus: 'saved' // Prevent autosave when viewing version history
                    });
                }
            } catch (err) {
                console.error("Failed to load version", err);
                toast.error("Failed to load version history");
            }
        } else {
            set({ isReadOnly: false });
            // Instead of reload, we should re-fetch current latest
            const workflow = await surveyWorkflowApi.getLatestWorkflowBySurveyId(surveyId);
            const rawNodes = workflow?.designJson?.nodes || [];
            const hydratedNodes = workflow?.runtimeJson 
                ? hydrateNodeIds(rawNodes, workflow.runtimeJson) 
                : rawNodes;

            set({
                nodes: hydratedNodes,
                edges: workflow?.designJson?.edges || [],
                workflowId: workflow?.id || null,
                saveStatus: 'saved' // Prevent autosave when returning to latest version
            });
        }
    }
}));
