import apiClient from "@/lib/api-client"
import * as XLSX from "xlsx";
import JSZip from "jszip";

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

function downloadCSV(data: any[], headers: string[], surveyId: string) {
    const csvContent = [
        headers.join(','), // Header row
        ...data.map((row: any) => headers.map((header: string) => {
            const val = row[header];
            // Escape CSV values
            const str = String(val);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveFile(blob, `survey-export-${surveyId}.csv`);
}

function downloadXLSX(data: any[], surveyId: string) {
    const workSheet = XLSX.utils.json_to_sheet(data);
    const workBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workBook, workSheet, "Responses");
    XLSX.writeFile(workBook, `survey-export-${surveyId}.xlsx`);
}

async function downloadSPSS(data: any[], headers: string[], meta: any, surveyId: string) {
    const zip = new JSZip();
    
    const csvContent = [
        headers.join(','),
        ...data.map((row: any) => headers.map((header: string) => {
            const val = row[header];
            const str = String(val);
             if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        }).join(','))
    ].join('\n');

    zip.file("data.csv", csvContent);

    // 2. Create SPSS Syntax File (.sps)
    let syntax = `* SPSS Syntax for Survey ${surveyId}.\n\n`;
    syntax += `GET DATA\n`;
    syntax += `  /TYPE=TXT\n`;
    syntax += `  /FILE="data.csv"\n`;
    syntax += `  /DELCASE=LINE\n`;
    syntax += `  /DELIMITERS=","\n`;
    syntax += `  /QUALIFIER='"\n`; // Double quote qualifier
    syntax += `  /ARRANGEMENT=DELIMITED\n`;
    syntax += `  /FIRSTCASE=2\n`; // Skip header row
    syntax += `  /IMPORTCASE=ALL\n`;
    syntax += `  /VARIABLES=\n`;

    // Define Variables based on headers
    // We need to map friendly headers back to technical variable names if possible, but here we just have headers.
    // This is tricky because headers in CSV are "Q1 [Choice A]", which are not valid SPSS variable names.
    // We should probably rely on `meta.spss` to map headers relative to variable mapping.
    // BUT `data` has mapped headers.
    
    // Simplification for now: Use generic V1 to Vn mapping or try to sanitize headers to valid variable names.
    // Better approach: User `meta.spss` to generate variable labels.
    
    const varNames: string[] = [];
    headers.forEach((header, index) => {
        // Create valid variable name: V_1, V_2 etc. or sanitize header
        // SPSS vars: max 64 chars, no spaces, starts with letter/substitutes.
        // Let's use V001, V002... and map them to Labels.
        const varName = `V${String(index + 1).padStart(3, '0')}`;
        varNames.push(varName);
        
        // Guess format: String mostly
        syntax += `  ${varName} A255\n`;
    });
    syntax += `  .\n\n`;

    syntax += `CACHE.\n`;
    syntax += `EXECUTE.\n\n`;

    // Variable Labels
    syntax += `VARIABLE LABELS\n`;
    headers.forEach((header, index) => {
        const varName = varNames[index];
        // Escape quotes in label
        const label = header.replace(/'/g, "''").replace(/"/g, '""');
        syntax += `  ${varName} '${label}'\n`;
    });
    syntax += `.\n`;

    // Value Labels? 
    // Since we are exporting "Hydrated" text (Yes/No, Agreed), we don't strictly *need* value labels for the data 
    // because the data is already labeled. SPSS Value Labels are for numeric codes.
    // If we wanted codes, we'd need to export Raw Data + Labels. 
    // Current requirement is just "SPSS Export". The current Hydrated export is fine as string data.
    // If we have access to metadata, we can add it as comments.

    // If we have `meta.spss`, we can try to add variable level info if we could match headers to variables, 
    // but headers are already "Question [Answer]".
    
    zip.file("syntax.sps", syntax);

    // Generate Zip
    const content = await zip.generateAsync({ type: "blob" });
    saveFile(content, `survey-export-${surveyId}-spss.zip`);
}

function saveFile(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
}
