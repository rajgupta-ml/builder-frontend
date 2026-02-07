import apiClient from "@/lib/api-client"

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

    exportResponses: async (surveyId: string, format: 'csv' | 'xlsx' = 'csv', mode: 'LIVE' | 'TEST' = 'LIVE') => {
        const response = await apiClient.get(`/responses/export/${surveyId}`, {
            params: { format, mode },
            responseType: 'blob'
        });
        
        // Helper to trigger download
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        const extension = format === 'xlsx' ? 'xlsx' : 'csv';
        link.setAttribute('download', `survey-export-${surveyId}.${extension}`);
        document.body.appendChild(link);
        link.click();
        link.parentNode?.removeChild(link);
        window.URL.revokeObjectURL(url);
    }
}
