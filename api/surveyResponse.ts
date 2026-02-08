import apiClient from "@/lib/api-client"
import { downloadCSV, downloadXLSX, downloadSPSS } from "../lib/export-utils";

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
        const response = await apiClient.get(`/responses/export/${surveyId}`, {
            params: { format: 'json', mode } // Always fetch JSON
        });
        
        const { data, meta } = response.data;

        if (!data || data.length === 0) {
             alert("No data available to export.");
             return;
        }

        // 1. Define Fixed Headers (Metrics)
        const fixedHeaders = ['Respondent ID', 'Date', 'Status', 'Outcome', 'Duration', 'Survey ID'];

        // 2. Get Dynamic Headers in Order
        let dynamicHeaders: string[] = [];
        if (meta && meta.orderedHeaders && Array.isArray(meta.orderedHeaders)) {
            // Filter out system headers that were already included in fixedHeaders to prevent duplicates
            dynamicHeaders = meta.orderedHeaders.filter((h: string) => !fixedHeaders.includes(h));
        } else {
            // Fallback: collect and sort alphabetic
            const allKeys = new Set<string>();
            data.forEach((row: any) => {
                Object.keys(row).forEach(k => {
                    if (!fixedHeaders.includes(k)) {
                        allKeys.add(k);
                    }
                });
            });
            dynamicHeaders = Array.from(allKeys).sort();
        }
        
        // 3. Ensure all dynamic headers used in data are included (capture any drift/missing)
        const usedKeys = new Set<string>();
        data.forEach((row: any) => Object.keys(row).forEach(k => usedKeys.add(k)));
        
        dynamicHeaders.forEach(h => usedKeys.delete(h));
        fixedHeaders.forEach(h => usedKeys.delete(h));
        
        // Append any remaining unknown keys (e.g. from old versions not in current workflow)
        const remainingKeys = Array.from(usedKeys).sort();
        
        // Final Header Order
        const headers = [...fixedHeaders, ...dynamicHeaders, ...remainingKeys];

        // 2. Normalize every row to have every header, filling missing with 'N/A'
        const normalizedData = data.map((row: any) => {
            const newRow: any = {};
            
            // Inject Survey ID if not present
            if (!row['Survey ID']) row['Survey ID'] = surveyId;

            headers.forEach(header => {
                const val = row[header];
                if (val === null || val === undefined || val === '' || val === '-') {
                    newRow[header] = 'N/A';
                } else {
                    newRow[header] = val;
                }
            });
            return newRow;
        });

        if (format === 'csv') {
            downloadCSV(normalizedData, headers, surveyId);
        } else if (format === 'xlsx') {
            downloadXLSX(normalizedData, surveyId);
        } else if (format === 'spss') {
            await downloadSPSS(normalizedData, headers, meta, surveyId);
        }
    }
}
