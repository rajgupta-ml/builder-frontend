import apiClient from "@/lib/api-client"
import { SurveyWorkflow } from "@/src/shared/types/survey";
import pako from 'pako';

export const surveyWorkflowApi = {
    getLatestWorkflowBySurveyId: async (surveyId: string): Promise<SurveyWorkflow> => {
        const response = await apiClient.get(`/workflows/${surveyId}/latest`)
        const data = response.data.data;
        
        if (data && data.runtimeJson && data.designJson) {
            // Decompress
            try {
                // Helper to decompress base64 gzip string
                const decompress = (base64: string) => {
                     const binaryString = atob(base64);
                     const len = binaryString.length;
                     const bytes = new Uint8Array(len);
                     for (let i = 0; i < len; i++) {
                         bytes[i] = binaryString.charCodeAt(i);
                     }
                     const decompressed = pako.ungzip(bytes, { to: 'string' });
                     return JSON.parse(decompressed);
                };

                return {
                    ...data,
                    runtimeJson: decompress(data.runtimeJson),
                    designJson: decompress(data.designJson)
                };
            } catch (e) {
                console.error("Failed to decompress workflow", e);
                // Fallback if not compressed (e.g. old data or error)
                return data;
            }
        }
        
        return data
    }   
}