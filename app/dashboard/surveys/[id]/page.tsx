"use client"
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import SurveyNodeSidebar from '@/components/SurveyNodeSidebar';
import PropertiesPanel from '@/components/properties/PropertiesPanel';
import NodeViewer from '@/components/NodeViewer';
import { SurveySettingsModal } from '@/components/modals/SurveySettingsModal';
import { SurveyQuotaModal } from '@/components/modals/SurveyQuotaModal';

import { useSurveyStore } from '@/src/store/useSurveyStore';
import { useAutosave } from '@/src/hooks/useAutosave';
import { EditorHeader } from '@/components/editor/EditorHeader';
import { EditorCanvas } from '@/components/editor/EditorCanvas';
import { ShareModal } from '@/components/editor/ShareModal';

function SurveyFlow() {
    const { id: surveyIdParam } = useParams();
    const surveyId = Array.isArray(surveyIdParam) ? surveyIdParam[0] : surveyIdParam;

    const {
        nodes,
        survey,
        selectedNodeId,
        isReadOnly,
        setNodes,
        setSelectedNodeId,
        loadSurveyData,
        refreshSurveyData
    } = useSurveyStore();

    // Modal States
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isQuotaOpen, setIsQuotaOpen] = useState(false);
    const [isShareOpen, setIsShareOpen] = useState(false);

    // Load Data
    useEffect(() => {
        if (surveyId) {
            loadSurveyData(surveyId);
        }
    }, [surveyId, loadSurveyData]);

    // Autosave Hook
    useAutosave(surveyId || "");

    if (!survey) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-muted-foreground animate-pulse">Loading Survey Data...</p>
                </div>
            </div>
        );
    }

    const testLink = `${process.env.NEXT_PUBLIC_SURVEY_URL || 'http://localhost:5173'}/s/${survey.testSlug}?transactionid=[%%TRANSACTION_ID%%]`

    const liveLink = `${process.env.NEXT_PUBLIC_SURVEY_URL || 'http://localhost:5173'}/s/${survey.slug}?transactionid=[%%TRANSACTION_ID%%]`

    const isLive = survey?.status === 'LIVE' || survey?.status === 'PAUSED';

    return (
        <div className="flex w-full h-screen bg-background overflow-hidden relative">
            <SurveyNodeSidebar />

            <div className="flex-1 h-full relative" >
                <EditorCanvas />

                <NodeViewer nodes={nodes} onSelect={setSelectedNodeId} />

                <EditorHeader
                    surveyId={surveyId || ""}
                    setIsQuotaOpen={setIsQuotaOpen}
                    setIsSettingsOpen={setIsSettingsOpen}
                    setIsShareOpen={setIsShareOpen}
                />
            </div>

            {/* Overlays / Modals */}
            <ShareModal
                isOpen={isShareOpen}
                onClose={() => setIsShareOpen(false)}
                testLink={testLink}
                liveLink={liveLink}
                isLive={isLive}
            />

            {/* Right Sidebar: Properties Panel */}
            {selectedNodeId && nodes.find(n => n.id === selectedNodeId) && !isReadOnly && (
                <PropertiesPanel
                    node={nodes.find(n => n.id === selectedNodeId) || null}
                    nodes={nodes}
                    onChange={(fieldName, value) => {
                        setNodes(nodes.map(n => {
                            if (n.id === selectedNodeId) return { ...n, data: { ...n.data, [fieldName]: value } };
                            return n;
                        }));
                    }}
                    onClose={() => setSelectedNodeId(null)}
                />
            )}

            <SurveySettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                surveyId={surveyId || ""}
                onSave={() => refreshSurveyData(surveyId || "")}
            />
            <SurveyQuotaModal
                isOpen={isQuotaOpen}
                onClose={() => setIsQuotaOpen(false)}
                surveyId={surveyId || ""}
                onSave={() => refreshSurveyData(surveyId || "")}
            />
        </div>
    );
}

export default function App() {
    return (
        <div style={{ width: '100%', height: 'calc(100vh - 64px)' }}>
            <ReactFlowProvider>
                <SurveyFlow />
            </ReactFlowProvider>
        </div>
    );
}