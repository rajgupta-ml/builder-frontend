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
import { toast } from 'sonner';
import { Survey, SurveyQuota } from '@/src/shared/types/survey';

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

    setNodes: (nodes) => set({ nodes }),
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
                surveyApi.getQuotas(surveyId),
                surveyWorkflowApi.getLatestWorkflowBySurveyId(surveyId)
            ]);

            set({
                survey,
                versions,
                quotas,
                workflowId: workflow?.id || null,
                nodes: workflow?.designJson?.nodes || [],
                edges: workflow?.designJson?.edges || [],
                // Compute hasChanges
                hasChanges: (survey?.status === 'LIVE' || survey?.status === 'PAUSED') && 
                            versions.length > 0 && 
                            versions[0].status === 'DRAFT'
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
            set({ 
                survey, 
                versions,
                hasChanges: (survey?.status === 'LIVE' || survey?.status === 'PAUSED') && 
                            versions.length > 0 && 
                            versions[0].status === 'DRAFT'
            });
        } catch (err) {
            console.error("Failed to refresh survey data", err);
        }
    },

    autosave: async (surveyId, runtimeJson) => {
        const { nodes, edges } = get();
        set({ saveStatus: 'saving' });
        try {
            const data = await surveyWorkflowApi.autosaveWorkflow({
                surveyId,
                designJson: { nodes, edges },
                runtimeJson
            });
            
            // Refresh versions to update change detection
            const versions = await surveyWorkflowApi.getWorkflowsMetadata(surveyId);
            const survey = get().survey;

            set({ 
                workflowId: data.id, 
                saveStatus: 'saved',
                versions,
                hasChanges: (survey?.status === 'LIVE' || survey?.status === 'PAUSED') && 
                            versions.length > 0 && 
                            versions[0].status === 'DRAFT'
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
                        edges: data.designJson.edges || []
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
            set({
                nodes: workflow?.designJson?.nodes || [],
                edges: workflow?.designJson?.edges || []
            });
        }
    }
}));
