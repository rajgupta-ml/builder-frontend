import apiClient from "@/lib/api-client"
import { downloadCSV, downloadXLSX, downloadSPSS } from "../lib/export-utils";
import { toUserMessage } from "@/lib/api-error";
import { toast } from "sonner";

export const surveyResponseApi = {
    getMetrics: async (surveyId: string) => {
        const response = await apiClient.get(`/responses/metrics/${surveyId}`);
        return response.data.data;
    },

    getResponses: async (surveyId: string) => {
        const response = await apiClient.get(`/responses/responses/${surveyId}`);
        return response.data.data;
    },

    getAllUserResponses: async () => {
        const response = await apiClient.get('/responses/all');
        return response.data.data;
    },

    exportResponses: async (surveyId: string, format: 'csv' | 'xlsx' | 'spss' = 'csv', mode: 'LIVE' | 'TEST' = 'LIVE') => {
        try {
            const response = await apiClient.get(`/responses/export/${surveyId}`, {
                params: { format, mode },
                responseType: 'blob'
            });
            
            // Generate filename based on format
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            let extension = format === 'spss' ? 'sps' : format;
            const filename = `survey-export-${surveyId}-${mode}-${timestamp}.${extension}`;
            
            // Use the saveFile utility (or create a new one inline if we want to avoid import issues)
            // Reusing the existing saveFile logic via a helper if imported, 
            // but since we are replacing the whole function blocks, let's just inline the download logic 
            // or we need to export saveFile from export-utils if it's not exported.
            // Wait, saveFile is not exported in export-utils.ts, only downloadCSV etc are.
            // Let's create a local helper or rely on the fact that existing code imported downloadCSV/XLSX.
            
            /* 
               Step 125 shows: import { downloadCSV, downloadXLSX, downloadSPSS } from "../lib/export-utils";
               Step 126 shows: saveFile is NOT exported.
               
               So I will implement the download trigger here directly.
            */
            
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            
            // Try to get filename from content-disposition
            const contentDisposition = response.headers['content-disposition'];
            let finalFilename = filename;
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
                if (filenameMatch && filenameMatch.length === 2)
                    finalFilename = filenameMatch[1];
            }
            
            link.setAttribute('download', finalFilename);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
            window.URL.revokeObjectURL(url);

        } catch (error) {
            console.error("Export failed", error);
            toast.error(toUserMessage(error, "Failed to export responses. Please try again."));
        }
    }
}
