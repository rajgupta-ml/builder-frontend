"use client"

import { useEffect, useMemo, useState } from "react";
import {
  IconAlertCircle,
  IconCheck,
  IconLoader2,
  IconSparkles,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { surveyWorkflowApi, type WorkflowImportJobStatus } from "@/api/surveyWorkflow";
import { ModalPortal } from "@/components/ui/ModalPortal";

type ImportStatus = "IDLE" | "QUEUED" | "PROCESSING" | "SUCCEEDED" | "FAILED";

interface AiImportModalProps {
  isOpen: boolean;
  surveyId: string;
  onClose: () => void;
  onImported?: () => void;
  onStatusChange?: (status: ImportStatus) => void;
}

const ALLOWED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

const MAX_FILE_BYTES = 20 * 1024 * 1024;

const toBase64DataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

export function AiImportModal({ isOpen, surveyId, onClose, onImported, onStatusChange }: AiImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [languageHint, setLanguageHint] = useState("");
  const [strictLogic, setStrictLogic] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<ImportStatus>("IDLE");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string>("");
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [qualityScore, setQualityScore] = useState<number>(0);
  const [selectedStrategy, setSelectedStrategy] = useState<string>("primary_model");
  const [branchRulesDetected, setBranchRulesDetected] = useState<number>(0);
  const [branchRulesApplied, setBranchRulesApplied] = useState<number>(0);
  const [skipConditionsDetected, setSkipConditionsDetected] = useState<number>(0);
  const [skipConditionsApplied, setSkipConditionsApplied] = useState<number>(0);
  const [legacyWhenParsedCount, setLegacyWhenParsedCount] = useState<number>(0);
  const [ambiguousLogicCount, setAmbiguousLogicCount] = useState<number>(0);
  const [placeholderLabelCount, setPlaceholderLabelCount] = useState<number>(0);
  const [emptyChoiceNodeCount, setEmptyChoiceNodeCount] = useState<number>(0);
  const [debugPayload, setDebugPayload] = useState<WorkflowImportJobStatus["debug"] | null>(null);

  const canSubmit = useMemo(
    () => Boolean(file) && !isSubmitting && !isPolling && Boolean(surveyId),
    [file, isSubmitting, isPolling, surveyId],
  );

  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setLanguageHint("");
      setStrictLogic(false);
      setJobId(null);
      setStatus("IDLE");
      setIsSubmitting(false);
      setIsPolling(false);
      setWarnings([]);
      setError("");
      setWorkflowId(null);
      setQualityScore(0);
      setSelectedStrategy("primary_model");
      setBranchRulesDetected(0);
      setBranchRulesApplied(0);
      setSkipConditionsDetected(0);
      setSkipConditionsApplied(0);
      setLegacyWhenParsedCount(0);
      setAmbiguousLogicCount(0);
      setPlaceholderLabelCount(0);
      setEmptyChoiceNodeCount(0);
      setDebugPayload(null);
      onStatusChange?.("IDLE");
    }
  }, [isOpen, onStatusChange]);

  useEffect(() => {
    if (!isOpen || !jobId || (status !== "QUEUED" && status !== "PROCESSING")) return;

    let cancelled = false;
    setIsPolling(true);

    const poll = async () => {
      try {
        const job: WorkflowImportJobStatus = await surveyWorkflowApi.getAiImportJob(jobId);
        if (cancelled) return;

        setStatus(job.status);
        setWarnings(job.warnings || []);
        setError(job.errorDetail || "");
        setWorkflowId(job.resultWorkflowId || null);
        setQualityScore(job.qualityScore || 0);
        setSelectedStrategy(job.selectedStrategy || "primary_model");
        setBranchRulesDetected(job.branchRulesDetected || 0);
        setBranchRulesApplied(job.branchRulesApplied || 0);
        setSkipConditionsDetected(job.skipConditionsDetected || 0);
        setSkipConditionsApplied(job.skipConditionsApplied || 0);
        setLegacyWhenParsedCount(job.legacyWhenParsedCount || 0);
        setAmbiguousLogicCount(job.ambiguousLogicCount || 0);
        setPlaceholderLabelCount(job.placeholderLabelCount || 0);
        setEmptyChoiceNodeCount(job.emptyChoiceNodeCount || 0);
        setDebugPayload(job.debug || null);

        if (job.status === "SUCCEEDED") {
          const result = await surveyWorkflowApi.getAiImportResult(jobId);
          if (cancelled) return;

          setWarnings(result.warnings || []);
          setWorkflowId(result.workflowId || null);
          setQualityScore(result.qualityScore || 0);
          setSelectedStrategy(result.selectedStrategy || "primary_model");
          setBranchRulesDetected(result.branchRulesDetected || 0);
          setBranchRulesApplied(result.branchRulesApplied || 0);
          setSkipConditionsDetected(result.skipConditionsDetected || 0);
          setSkipConditionsApplied(result.skipConditionsApplied || 0);
          setLegacyWhenParsedCount(result.legacyWhenParsedCount || 0);
          setAmbiguousLogicCount(result.ambiguousLogicCount || 0);
          setPlaceholderLabelCount(result.placeholderLabelCount || 0);
          setEmptyChoiceNodeCount(result.emptyChoiceNodeCount || 0);
          setDebugPayload(result.debug || null);
          setIsPolling(false);

          toast.success("AI import completed", {
            description: "A new draft workflow was generated.",
          });
          onImported?.();
          return;
        }

        if (job.status === "FAILED") {
          setIsPolling(false);
          toast.error("AI import failed", {
            description: job.errorDetail || "The import job failed. Please try again.",
          });
          return;
        }

        setTimeout(() => {
          void poll();
        }, 1800);
      } catch (err: any) {
        if (cancelled) return;
        setIsPolling(false);
        setStatus("FAILED");
        setError(err?.message || "Failed to poll import status");
      }
    };

    void poll();

    return () => {
      cancelled = true;
    };
  }, [isOpen, jobId, status, onImported]);

  const onSelectFile = (selected: File | null) => {
    if (!selected) return;

    if (!ALLOWED_MIME.includes(selected.type)) {
      toast.error("Unsupported file type", {
        description: "Only PDF, DOCX, and TXT are allowed.",
      });
      return;
    }

    if (selected.size > MAX_FILE_BYTES) {
      toast.error("File too large", {
        description: "Maximum allowed size is 20 MB.",
      });
      return;
    }

    setFile(selected);
    setError("");
  };

  const handleSubmit = async () => {
    if (!file || !surveyId) return;

    try {
      setIsSubmitting(true);
      setError("");
      setWarnings([]);

      const fileBase64 = await toBase64DataUrl(file);
      const created = await surveyWorkflowApi.createAiImportJob({
        surveyId,
        fileName: file.name,
        mimeType: file.type,
        fileBase64,
        languageHint: languageHint.trim() || undefined,
        mode: "AUTO",
        strictLogic,
      });

      setJobId(created.jobId);
      setStatus(created.status);

      toast.success("Import started", {
        description: "We are generating a draft from your questionnaire.",
      });
    } catch (err: any) {
      setStatus("FAILED");
      setError(err?.response?.data?.detail || err?.message || "Failed to start import");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-120 h-dvh w-screen flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div
          className="bg-background border border-border shadow-2xl rounded-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <IconSparkles size={18} className="text-primary" />
              <h3 className="font-semibold text-lg">Import Questionnaire with AI</h3>
            </div>
            <button title="X Icon" onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded-full">
              <IconX size={20} />
            </button>
          </div>

          <div className="p-6 space-y-5">
            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                Upload a questionnaire file and Survey Studios will generate design JSON and runtime JSON as a new draft.
              </p>

              <label className="block">
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                  onChange={(e) => onSelectFile(e.target.files?.[0] || null)}
                  disabled={isSubmitting || isPolling}
                />
                <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border px-4 py-3 bg-background hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{file?.name || "Choose file (PDF, DOCX, TXT)"}</p>
                    <p className="text-[11px] text-muted-foreground">Max 20 MB</p>
                  </div>
                  <IconUpload size={18} className="text-muted-foreground shrink-0" />
                </div>
              </label>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Language Hint (optional)</label>
                <input
                  value={languageHint}
                  onChange={(e) => setLanguageHint(e.target.value)}
                  placeholder="e.g. en, en-US, hi"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  disabled={isSubmitting || isPolling}
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={strictLogic}
                  onChange={(e) => setStrictLogic(e.target.checked)}
                  disabled={isSubmitting || isPolling}
                />
                Strict logic mode (fail import when logic is ambiguous)
              </label>
            </div>

            {(status === "QUEUED" || status === "PROCESSING") && (
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 flex items-start gap-2">
                <IconLoader2 size={16} className="text-blue-600 animate-spin mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-700">Processing import</p>
                  <p className="text-xs text-blue-700/80">Job {jobId ? `#${jobId.slice(0, 8)}` : ""} is running in background.</p>
                </div>
              </div>
            )}

            {status === "SUCCEEDED" && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 flex items-start gap-2">
                <IconCheck size={16} className="text-emerald-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-emerald-700">Import completed</p>
                  <p className="text-xs text-emerald-700/80">
                    {workflowId ? `Workflow ${workflowId.slice(0, 8)} was created as draft.` : "Draft workflow generated."}
                  </p>
                </div>
              </div>
            )}

            {(status === "FAILED" || error) && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 flex items-start gap-2">
                <IconAlertCircle size={16} className="text-destructive mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-destructive">Import failed</p>
                  <p className="text-xs text-destructive/80">{error || "Please retry with a cleaner file."}</p>
                </div>
              </div>
            )}

            {warnings.length > 0 && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-2">Warnings</p>
                <ul className="space-y-1 max-h-36 overflow-auto pr-1">
                  {warnings.slice(0, 12).map((item, idx) => (
                    <li key={`${item}-${idx}`} className="text-xs text-amber-800">• {item}</li>
                  ))}
                </ul>
              </div>
            )}

            {status === "SUCCEEDED" && (
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-blue-700 mb-2">Import Diagnostics</p>
                <div className="grid grid-cols-2 gap-2 text-xs text-blue-900">
                  <div>Strategy: <span className="font-semibold">{selectedStrategy.replace(/_/g, " ")}</span></div>
                  <div>Quality Score: <span className="font-semibold">{qualityScore}</span></div>
                  <div>Branch Rules: <span className="font-semibold">{branchRulesApplied}/{branchRulesDetected}</span></div>
                  <div>Skip Conditions: <span className="font-semibold">{skipConditionsApplied}/{skipConditionsDetected}</span></div>
                  <div>Legacy `when` Parsed: <span className="font-semibold">{legacyWhenParsedCount}</span></div>
                  <div>Ambiguous Logic: <span className="font-semibold">{ambiguousLogicCount}</span></div>
                  <div>Placeholder Labels: <span className="font-semibold">{placeholderLabelCount}</span></div>
                  <div>Empty Choice Nodes: <span className="font-semibold">{emptyChoiceNodeCount}</span></div>
                </div>
              </div>
            )}

            {status === "SUCCEEDED" && debugPayload && (
              <details className="rounded-lg border border-border bg-muted/20 p-3">
                <summary className="text-xs font-bold uppercase tracking-wider text-muted-foreground cursor-pointer">
                  Import Debug
                </summary>
                <pre className="mt-2 max-h-52 overflow-auto rounded-md bg-background p-2 text-[11px] leading-4">
                  {JSON.stringify(debugPayload, null, 2)}
                </pre>
              </details>
            )}
          </div>

          <div className="p-4 bg-muted/30 border-t border-border flex items-center justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white border border-border text-sm font-medium rounded-md"
              disabled={isSubmitting || isPolling}
            >
              Close
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Starting..." : "Start AI Import"}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
