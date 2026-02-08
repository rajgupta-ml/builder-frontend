import * as XLSX from "xlsx";
import JSZip from "jszip";

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

export function downloadCSV(data: any[], headers: string[], surveyId: string) {
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

export function downloadXLSX(data: any[], surveyId: string) {
    const workSheet = XLSX.utils.json_to_sheet(data);
    const workBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workBook, workSheet, "Responses");
    XLSX.writeFile(workBook, `survey-export-${surveyId}.xlsx`);
}

export async function downloadSPSS(data: any[], headers: string[], meta: any, surveyId: string) {
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
    const varNames: string[] = [];
    headers.forEach((header, index) => {
        // Create valid variable name: V001, V002 etc.
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

    zip.file("syntax.sps", syntax);

    // Generate Zip
    const content = await zip.generateAsync({ type: "blob" });
    saveFile(content, `survey-export-${surveyId}-spss.zip`);
}
