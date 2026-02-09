import { useEffect } from 'react';
import { useSurveyStore } from '@/src/store/useSurveyStore';
import { generateRuntimeJson } from '@/lib/compiler';

export function useAutosave(surveyId: string) {
    const { nodes, edges, saveStatus, isReadOnly, autosave } = useSurveyStore();

    useEffect(() => {
        if (saveStatus !== 'unsaved' || !surveyId || isReadOnly) return;

        const timer = setTimeout(async () => {
            const runtimeJson = generateRuntimeJson(nodes, edges);
            await autosave(surveyId, runtimeJson);
        }, 1000); // 1s debounce

        return () => clearTimeout(timer);
    }, [nodes, edges, saveStatus, surveyId, isReadOnly, autosave]);
}
