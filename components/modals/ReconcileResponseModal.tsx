
import { useState, useRef } from "react";
import { reconcileApi } from "@/api/reconcile";
import { operationsApi } from "@/api/operations";
import { toast } from "sonner";
import { IconAlertTriangle, IconLoader, IconCheck, IconUpload, IconFileSpreadsheet, IconX } from "@tabler/icons-react";
import { motion, AnimatePresence } from "motion/react";
import * as XLSX from 'xlsx';
import { ModalPortal } from "@/components/ui/ModalPortal";

interface ReconcileResponseModalProps {
    isOpen: boolean;
    onClose: () => void;
    surveyId: string;
    onSuccess: () => void;
}

export const ReconcileResponseModal = ({
    isOpen,
    onClose,
    surveyId,
    onSuccess
}: ReconcileResponseModalProps) => {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [parsedIds, setParsedIds] = useState<string[]>([]);
    const [fileName, setFileName] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const headerTokens = new Set([
        'id',
        'responseid',
        'response id',
        'respondentid',
        'respondent id',
    ]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        setLoading(true);

        try {
            const ids = await parseFile(file);
            if (ids.length === 0) {
                toast.error("No valid IDs found in file");
                setFileName(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
            } else {
                setParsedIds(ids);
                toast.success(`Found ${ids.length} response IDs`);
            }
        } catch (error) {
            console.error("Parse error:", error);
            toast.error("Failed to parse file");
            setFileName(null);
        } finally {
            setLoading(false);
        }
    };

    const normalizeIds = (rawValues: unknown[]): string[] => {
        const seen = new Set<string>();
        const parsed: string[] = [];

        for (const raw of rawValues) {
            if (raw === null || raw === undefined) continue;
            const normalized = String(raw).replace(/\uFEFF/g, '').trim();
            if (!normalized) continue;

            const tokens = normalized
                .split(/[\r\n,;\t ]+/)
                .map((token) => token.trim().replace(/^['"]+|['"]+$/g, ''))
                .filter(Boolean);

            for (const token of tokens) {
                const lower = token.toLowerCase();
                if (headerTokens.has(lower)) continue;
                if (!seen.has(token)) {
                    seen.add(token);
                    parsed.push(token);
                }
            }
        }

        return parsed;
    };

    const parseFile = (file: File): Promise<string[]> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const data = e.target?.result;
                    let ids: string[] = [];

                    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                        const workbook = XLSX.read(data, { type: 'array' });
                        const rawCells: unknown[] = [];

                        for (const sheetName of workbook.SheetNames) {
                            const sheet = workbook.Sheets[sheetName];
                            const rows = XLSX.utils.sheet_to_json(sheet, {
                                header: 1,
                                raw: false,
                                defval: '',
                            }) as unknown[][];
                            for (const row of rows) {
                                rawCells.push(...row);
                            }
                        }

                        ids = normalizeIds(rawCells);
                    } else {
                        const text = typeof data === 'string'
                            ? data
                            : new TextDecoder().decode(data as ArrayBuffer);
                        ids = normalizeIds([text]);
                    }

                    resolve(ids);
                } catch (err) {
                    reject(err);
                }
            };

            reader.onerror = (err) => reject(err);

            if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                reader.readAsArrayBuffer(file);
            } else {
                reader.readAsText(file);
            }
        });
    };

    const handleDisqualify = async () => {
        if (parsedIds.length === 0) return;

        setLoading(true);
        try {
            const accepted = await reconcileApi.disqualifyResponses(surveyId, parsedIds);
            const op = await operationsApi.waitForOperation(accepted.operationId, {
                timeoutMs: 120000,
                intervalMs: 1500,
            });

            if (op.status !== "SUCCEEDED") {
                throw new Error(op.errorDetail || "Disqualification failed");
            }

            const data = (op.resultPayload || {}) as any;
            setResult({
                success: true,
                message: `Successfully disqualified ${data.decrementedCompleted || 0} responses.`,
                data
            });
            toast.success("Responses disqualified successfully");
        } catch (error: any) {
            if (error?.code === "OPERATION_TIMEOUT") {
                toast.info("Disqualification is still processing in background.");
                return;
            }
            console.error("Disqualification failed:", error);
            toast.error("Failed to disqualify responses");
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setParsedIds([]);
        setFileName(null);
        setResult(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleClose = () => {
        if (result) {
            onSuccess(); // Refresh data on parent
        }
        handleReset();
        onClose();
    };

    if (!isOpen) return null;

    return (
        <ModalPortal>
            <AnimatePresence>
                {isOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={handleClose}
                            className="fixed inset-0 z-120 h-dvh w-screen bg-black/50 backdrop-blur-sm"
                        />
                        <div className="fixed inset-0 z-120 h-dvh w-screen flex items-center justify-center p-4 pointer-events-none">
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                                className="bg-card w-full max-w-md rounded-2xl shadow-xl overflow-hidden pointer-events-auto border border-border"
                            >
                            {!result ? (
                                <div className="p-6">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="p-3 rounded-full bg-amber-100 text-amber-600">
                                            <IconAlertTriangle size={24} />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold">Reconcile Responses</h3>
                                            <p className="text-sm text-muted-foreground">
                                                Upload IDs to bulk disqualify.
                                            </p>
                                        </div>
                                    </div>

                                    {!parsedIds.length ? (
                                        <div
                                            className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:bg-muted/50 transition-colors cursor-pointer group"
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            <input
                                            title="file handler"
                                                type="file"
                                                ref={fileInputRef}
                                                className="hidden"
                                                accept=".csv,.txt,.xlsx,.xls"
                                                onChange={handleFileUpload}
                                            />
                                            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                                                <IconUpload size={24} />
                                            </div>
                                            <p className="text-sm font-medium">Click to upload file</p>
                                            <p className="text-xs text-muted-foreground mt-1">CSV, Excel, or Text file with IDs</p>
                                        </div>
                                    ) : (
                                        <div className="bg-muted/30 rounded-xl p-4 mb-6">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                                                        <IconFileSpreadsheet size={20} />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold truncate max-w-[150px]">{fileName}</p>
                                                        <p className="text-xs text-muted-foreground">{parsedIds.length} IDs found</p>
                                                    </div>
                                                </div>
                                                <button
                                                    title="X Icon"
                                                    onClick={handleReset}
                                                    className="p-1 hover:bg-muted rounded-full"
                                                >
                                                    <IconX size={16} />
                                                </button>
                                            </div>

                                            <div className="bg-background border border-border rounded-lg p-2 max-h-[100px] overflow-y-auto text-xs font-mono text-muted-foreground">
                                                {parsedIds.slice(0, 10).map(id => (
                                                    <div key={id}>{id}</div>
                                                ))}
                                                {parsedIds.length > 10 && <div className="italic text-[10px] mt-1">...and {parsedIds.length - 10} more</div>}
                                            </div>
                                        </div>
                                    )}

                                    {parsedIds.length > 0 && (
                                        <div className="bg-amber-50 rounded-xl p-4 mb-6 text-sm text-amber-900 border border-amber-100">
                                            <p className="font-bold flex items-center gap-2 mb-1">
                                                <IconAlertTriangle size={16} />
                                                Warning
                                            </p>
                                            <ul className="list-disc list-inside text-xs space-y-1 opacity-90">
                                                <li>Disqualification is irreversible.</li>
                                                <li>Metrics will be updated immediately.</li>
                                            </ul>
                                        </div>
                                    )}

                                    <div className="flex justify-end gap-3 mt-6">
                                        <button
                                            onClick={handleClose}
                                            className="px-4 py-2 text-sm font-semibold rounded-lg hover:bg-muted transition-colors"
                                            disabled={loading}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleDisqualify}
                                            disabled={loading || parsedIds.length === 0}
                                            className="px-4 py-2 text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {loading ? <IconLoader className="animate-spin" size={16} /> : null}
                                            Disqualify {parsedIds.length > 0 ? `(${parsedIds.length})` : ''}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-6 text-center">
                                    <div className="mx-auto w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                                        <IconCheck size={32} strokeWidth={3} />
                                    </div>
                                    <h3 className="text-xl font-bold mb-2">Reconciliation Complete</h3>
                                    <p className="text-muted-foreground mb-6">
                                        Successfully updated metrics and quotas.
                                    </p>

                                    <div className="bg-muted/30 rounded-xl p-4 mb-6 grid grid-cols-2 gap-4 text-left">
                                        <div>
                                            <span className="text-xs text-muted-foreground uppercase font-bold">Completed Decremented</span>
                                            <div className="text-xl font-black text-foreground">{result?.data?.decrementedCompleted || 0}</div>
                                        </div>
                                        <div>
                                            <span className="text-xs text-muted-foreground uppercase font-bold">Disqualified Incremented</span>
                                            <div className="text-xl font-black text-foreground">{result?.data?.incrementedDisqualified || 0}</div>
                                        </div>
                                        <div>
                                            <span className="text-xs text-muted-foreground uppercase font-bold">Requested IDs</span>
                                            <div className="text-xl font-black text-foreground">{result?.data?.requestedIds?.length || 0}</div>
                                        </div>
                                        <div>
                                            <span className="text-xs text-muted-foreground uppercase font-bold">Matched Inputs</span>
                                            <div className="text-xl font-black text-foreground">{result?.data?.matchedInputIds?.length || 0}</div>
                                        </div>
                                        <div className="col-span-2">
                                            <span className="text-xs text-muted-foreground uppercase font-bold">Quotas Freed</span>
                                            <div className="flex flex-wrap gap-2 mt-1">
                                                {Object.entries(result?.data?.quotaDecrements || {}).map(([qId, count]) => (
                                                    <span key={qId} className="px-2 py-1 bg-background border border-border rounded text-xs">
                                                        {String(count)}x {qId.split('-')[0]}...
                                                    </span>
                                                ))}
                                                {Object.keys(result?.data?.quotaDecrements || {}).length === 0 && (
                                                    <span className="text-muted-foreground text-xs italic">No quotas affected</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleClose}
                                        className="w-full py-2.5 font-bold bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity"
                                    >
                                        Done
                                    </button>
                                </div>
                            )}
                            </motion.div>
                        </div>
                    </>
                )}
            </AnimatePresence>
        </ModalPortal>
    );
};
