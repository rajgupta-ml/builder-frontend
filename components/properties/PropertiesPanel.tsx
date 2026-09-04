import React, { useEffect, useMemo, useState } from "react";
import { useReactFlow, Node, Edge } from "@xyflow/react";
import apiClient from "@/lib/api-client";
import { getNodeDefinition, PropertyField } from "@/components/nodes/definitions";
import { IconX, IconFolderPlus, IconTrash, IconPlus, IconPhoto, IconSearch, IconArrowUp, IconArrowDown, IconFilter, IconAlertTriangle, IconChevronDown, IconRefresh, IconUpload } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { ConditionBuilder } from "./ConditionBuilder";
import type { LogicGroup } from "./conditionTypes";
import { SkipRulesBuilder } from "./SkipRulesBuilder";
import { BranchPathEditor } from "./BranchPathEditor";
import type { PropertyPanelTabId } from "@surveystudio/node-registery/builder";
import { isGhostLogicEdge, type FlowRuleInspection } from "@/lib/skipMigration";
import { StepsBuilder } from "./StepsBuilder";
import EmojiPicker from "./EmojiPicker";
import { MediaPreview } from "../nodes/MediaPreview";
import { surveyWorkflowApi, type OpenEndQualityPolicyPreview, type WorkflowValidationIssue } from "@/api/surveyWorkflow";
import { generateRuntimeJson } from "@/lib/compiler";
import { useSurveyStore } from "@/src/store/useSurveyStore";
import type { Survey } from "@/src/shared/types/survey";
import type { SessionOutcome } from "@/components/modals/SurveySettingsModal";

// ... (imports remain same)

interface PropertiesPanelProps {
    node: Node | null;
    nodes: Node[]; // Full list of nodes needed for logic builder
    issues?: WorkflowValidationIssue[];
    surveyId?: string;
    survey?: Survey | null;
    onChange: (fieldName: string, value: any) => void;
    onClose: () => void;
    onInspectFlowRule?: (inspection: FlowRuleInspection | null) => void;
    onQualityPoliciesChange?: (policies: Record<string, OpenEndQualityPolicyPreview>) => void;
    onOpenSettings?: (focusOutcome?: SessionOutcome) => void;
    readOnly?: boolean;
}

const OUTCOME_REDIRECT_LABELS: Record<SessionOutcome, string> = {
    completed: "Completed",
    disqualified: "Disqualified",
    quality_terminate: "Quality Terminate",
    security_terminate: "Security Terminate",
};

const resolveOutcomeRedirectUrl = (outcome: unknown, survey: Survey | null | undefined): string | null => {
    switch (String(outcome || "completed") as SessionOutcome) {
        case "disqualified":
            return survey?.disqualifiedRedirectUrl || null;
        case "quality_terminate":
            return survey?.qualityTerminateRedirectUrl || null;
        case "security_terminate":
            return survey?.securityTerminateUrl || null;
        case "completed":
        default:
            return survey?.redirectUrl || null;
    }
};

type OpenEndQualityPreviewState = {
    automaticPolicies: Record<string, OpenEndQualityPolicyPreview>;
    policies: Record<string, OpenEndQualityPolicyPreview>;
    loading: boolean;
    error: string | null;
    retry?: () => void;
};

const EMPTY_OPEN_END_PREVIEW: OpenEndQualityPreviewState = {
    automaticPolicies: {},
    policies: {},
    loading: false,
    error: null,
};

const OPEN_END_NODE_TYPES = new Set(["textInput", "multiInput"]);
const supportsStraightLiningPolicy = (node: Node | null, data: Record<string, unknown>) => {
    if (node?.type === "matrixChoice") return data.multiple !== true;
    if (node?.type !== "rating" && node?.type !== "slider") return false;
    const items = Array.isArray(data.items) ? data.items : [];
    return data.responseMode === "multi" && items.length >= 2;
};

type StraightLiningPolicyMode = "inherit" | "enabled" | "disabled";

const straightLiningPolicyMode = (data: Record<string, unknown>): StraightLiningPolicyMode => {
    const policy = data.straightLiningPolicy && typeof data.straightLiningPolicy === "object"
        ? data.straightLiningPolicy as Record<string, unknown>
        : {};
    return policy.mode === "enabled" || policy.mode === "disabled" ? policy.mode : "inherit";
};

const OPEN_END_QUALITY_PREVIEW_CACHE_LIMIT = 150;

const OPEN_END_QUALITY_PREVIEW_CACHE = new Map<string, Pick<OpenEndQualityPreviewState, "automaticPolicies" | "policies">>();

const NODE_SIGNATURE_DATA_FIELDS = [
    "label",
    "description",
    "questionLabel",
    "placeholder",
    "longAnswer",
    "branchLabel",
    "logic",
    "condition",
    "openEndPolicyMode",
    "openEndAnswerIntent",
    "openEndQualityEnabled",
    "openEndAiJudgeEnabled",
    "openEndTooShortEnabled",
    "openEndKeyboardMashEnabled",
    "openEndDuplicateEnabled",
    "openEndRelevanceEnabled",
    "openEndLanguageMismatchEnabled",
    "openEndAiGeneratedEnabled",
] as const;

const MULTI_INPUT_SIGNATURE_FIELD_KEYS = [
    "id",
    "exportId",
    "label",
    "value",
    "openEndPolicyMode",
    "openEndAnswerIntent",
    "openEndQualityEnabled",
    "openEndAiJudgeEnabled",
    "openEndTooShortEnabled",
    "openEndKeyboardMashEnabled",
    "openEndDuplicateEnabled",
    "openEndRelevanceEnabled",
    "openEndLanguageMismatchEnabled",
    "openEndAiGeneratedEnabled",
] as const;

const buildOpenEndPolicyKey = (questionId?: string, subQuestionId?: string | null) => (
    questionId ? (subQuestionId ? questionId + "::" + encodeURIComponent(subQuestionId) : questionId) : ""
);

const pickExistingKeys = (source: Record<string, unknown>, keys: readonly string[]) => keys.reduce<Record<string, unknown>>((picked, key) => {
    if (Object.prototype.hasOwnProperty.call(source, key)) picked[key] = source[key];
    return picked;
}, {});

const stableStringify = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
    if (value && typeof value === "object") {
        const record = value as Record<string, unknown>;
        return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
    }
    return JSON.stringify(value);
};

const buildOpenEndNodePreviewCacheKey = (surveyId: string | undefined, node: Node | null) => {
    if (!surveyId || !node?.id || !node.type || !OPEN_END_NODE_TYPES.has(String(node.type))) return null;

    const data = (node.data || {}) as Record<string, unknown>;
    const signatureData = pickExistingKeys(data, NODE_SIGNATURE_DATA_FIELDS);
    if (node.type === "multiInput") {
        signatureData.fields = Array.isArray(data.fields)
            ? data.fields.map((field) => pickExistingKeys((field || {}) as Record<string, unknown>, MULTI_INPUT_SIGNATURE_FIELD_KEYS))
            : [];
    }

    return stableStringify({
        version: 2,
        surveyId,
        nodeId: node.id,
        nodeType: node.type,
        data: signatureData,
    });
};

const setCachedOpenEndPreview = (
    cacheKey: string,
    preview: Pick<OpenEndQualityPreviewState, "automaticPolicies" | "policies">,
) => {
    OPEN_END_QUALITY_PREVIEW_CACHE.set(cacheKey, preview);
    while (OPEN_END_QUALITY_PREVIEW_CACHE.size > OPEN_END_QUALITY_PREVIEW_CACHE_LIMIT) {
        const oldestKey = OPEN_END_QUALITY_PREVIEW_CACHE.keys().next().value;
        if (!oldestKey) break;
        OPEN_END_QUALITY_PREVIEW_CACHE.delete(oldestKey);
    }
};

const cacheOpenEndPreviewForNodes = (
    surveyId: string | undefined,
    nodes: Node[],
    preview: Pick<OpenEndQualityPreviewState, "automaticPolicies" | "policies">,
) => {
    for (const node of nodes) {
        const cacheKey = buildOpenEndNodePreviewCacheKey(surveyId, node);
        if (cacheKey) setCachedOpenEndPreview(cacheKey, preview);
    }
};

type PanelTab = PropertyPanelTabId;

const TAB_LABELS: Record<PanelTab, string> = { content: "Content", flow: "Flow", quality: "Quality" };

// Survives node switches and panel remounts: auditing e.g. Quality across
// several nodes keeps the panel on the Quality tab.
let LAST_ACTIVE_TAB: PanelTab = "content";

const PANEL_WIDTH_STORAGE_KEY = "builder:properties-panel-width";
const PANEL_MIN_WIDTH = 320;
const PANEL_MAX_WIDTH = 520;

const clampPanelWidth = (width: number) => Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, width));

const isFieldVisible = (field: PropertyField, data: Record<string, unknown>) => (
    !field.visible || field.visible(data) !== false
);

export default function PropertiesPanel({ node, nodes, issues = [], surveyId, survey, onChange, onClose, onInspectFlowRule, onQualityPoliciesChange, onOpenSettings, readOnly = false }: PropertiesPanelProps) {
    const { getEdges: getCanvasEdges } = useReactFlow();
    // The canvas injects transient dependency edges while inspecting flow rules; keep them out
    // of everything that compiles or inspects the persisted workflow.
    const getEdges = () => getCanvasEdges().filter((edge) => !isGhostLogicEdge(edge));
    const edges = getEdges();
    const [qualityPreview, setQualityPreview] = useState<OpenEndQualityPreviewState>(EMPTY_OPEN_END_PREVIEW);
    const [qualityPreviewRequestVersion, setQualityPreviewRequestVersion] = useState(0);

    const isOpenEndNode = Boolean(node?.type && OPEN_END_NODE_TYPES.has(String(node.type)));
    const selectedPolicyKey = useMemo(() => buildOpenEndPolicyKey(node?.id), [node?.id]);
    const selectedNodePreviewCacheKey = useMemo(() => buildOpenEndNodePreviewCacheKey(surveyId, node), [surveyId, node?.id, node?.type, node?.data]);

    useEffect(() => {
        if (!surveyId || !node || !isOpenEndNode || !selectedNodePreviewCacheKey) {
            setQualityPreview(EMPTY_OPEN_END_PREVIEW);
            return;
        }

        const cached = OPEN_END_QUALITY_PREVIEW_CACHE.get(selectedNodePreviewCacheKey);
        if (cached) {
            setQualityPreview({ ...cached, loading: false, error: null });
            return;
        }

        const controller = new AbortController();
        const timeout = window.setTimeout(async () => {
            setQualityPreview({ ...EMPTY_OPEN_END_PREVIEW, loading: true });
            try {
                const latestEdges = getEdges();
                const runtimeJson = generateRuntimeJson(nodes, latestEdges);
                const result = await surveyWorkflowApi.previewOpenEndQuality(
                    { surveyId, runtimeJson, designJson: { nodes, edges: latestEdges } },
                    { signal: controller.signal },
                );
                const nextPreview = {
                    automaticPolicies: result.automaticPolicies,
                    policies: result.policies,
                };
                cacheOpenEndPreviewForNodes(surveyId, nodes, nextPreview);
                setQualityPreview({ ...nextPreview, loading: false, error: null });
            } catch (error: any) {
                if (controller.signal.aborted) return;
                setQualityPreview((current) => ({
                    ...current,
                    loading: false,
                    error: error?.message || "Could not preview quality policy",
                }));
            }
        }, 350);

        return () => {
            controller.abort();
            window.clearTimeout(timeout);
        };
    }, [surveyId, node?.id, isOpenEndNode, selectedNodePreviewCacheKey, qualityPreviewRequestVersion]);

    useEffect(() => {
        if (!isOpenEndNode || qualityPreview.loading || qualityPreview.error) return;
        onQualityPoliciesChange?.(qualityPreview.policies);
    }, [isOpenEndNode, onQualityPoliciesChange, qualityPreview.error, qualityPreview.loading, qualityPreview.policies]);

    const retryQualityPreview = () => {
        if (selectedNodePreviewCacheKey) {
            OPEN_END_QUALITY_PREVIEW_CACHE.delete(selectedNodePreviewCacheKey);
        }
        setQualityPreviewRequestVersion((version) => version + 1);
    };

    // Get the definition for this node type
    const definition = node ? getNodeDefinition(node.type || "") : null;
    const data = useMemo(() => (node?.data || {}) as Record<string, unknown>, [node?.data]);
    const hasStraightLiningPolicy = supportsStraightLiningPolicy(node, data);

    const isEndNode = node?.type === "end";

    const panelGroups = useMemo(() => (definition
        ? definition.propertyPanel.groups
            .map((group) => ({
                ...group,
                fields: (group.fields as readonly PropertyField[]).filter((field) => (
                    isFieldVisible(field, data) && !(isEndNode && field.name === "redirectUrl")
                )),
            }))
            .filter((group) => group.fields.length > 0)
        : []), [definition, data, isEndNode]);

    const contentGroups = useMemo(() => panelGroups.filter((group) => group.tab === "content"), [panelGroups]);
    const contentFields = useMemo(() => contentGroups.flatMap((group) => group.fields), [contentGroups]);
    const flowFields = useMemo(
        () => panelGroups.filter((group) => group.tab === "flow").flatMap((group) => group.fields),
        [panelGroups]
    );
    const qualityFields = useMemo(
        () => panelGroups.filter((group) => group.tab === "quality").flatMap((group) => group.fields),
        [panelGroups]
    );
    const visibleFields = useMemo(() => panelGroups.flatMap((group) => group.fields), [panelGroups]);
    const qualityFieldNames = useMemo(() => new Set(qualityFields.map((field) => field.name)), [qualityFields]);

    const flowCapabilities = definition?.propertyPanel.flow;
    const supportsConditionalDestinations = flowCapabilities?.supportsConditionalDestinations === true;
    const questionConditionField = flowCapabilities?.visibilityField
        ? flowFields.find((field) => field.name === flowCapabilities.visibilityField)
        : undefined;

    const availableTabs = useMemo(() => {
        const tabs: PanelTab[] = [];
        if (contentFields.length > 0) tabs.push("content");
        if (flowFields.length > 0 || supportsConditionalDestinations) tabs.push("flow");
        if (qualityFields.length > 0 || hasStraightLiningPolicy) tabs.push("quality");
        return tabs.length > 0 ? tabs : (["content"] as PanelTab[]);
    }, [contentFields.length, flowFields.length, hasStraightLiningPolicy, qualityFields.length, supportsConditionalDestinations]);

    const [activeTab, setActiveTab] = useState<PanelTab>(LAST_ACTIVE_TAB);
    const [search, setSearch] = useState("");
    const [panelWidth, setPanelWidth] = useState(PANEL_MIN_WIDTH);
    const [isResizing, setIsResizing] = useState(false);

    useEffect(() => {
        const stored = Number(window.localStorage.getItem(PANEL_WIDTH_STORAGE_KEY));
        if (Number.isFinite(stored) && stored >= PANEL_MIN_WIDTH && stored <= PANEL_MAX_WIDTH) {
            setPanelWidth(stored);
        }
    }, []);

    useEffect(() => {
        setSearch("");
    }, [node?.id]);

    useEffect(() => {
        if (!availableTabs.includes(activeTab)) {
            setActiveTab(availableTabs[0]);
        }
    }, [availableTabs, activeTab]);

    const selectTab = (tab: PanelTab) => {
        LAST_ACTIVE_TAB = tab;
        setActiveTab(tab);
        setSearch("");
    };

    const hasFlowRule = useMemo(() => {
        if (supportsConditionalDestinations && Array.isArray(data.skips) && data.skips.length > 0) return true;
        return flowFields.some((field) => {
            const fieldValue = data[field.name];
            if (Array.isArray(fieldValue)) {
                return fieldValue.some((item) => {
                    const condition = (item as Record<string, unknown> | null)?.condition as Record<string, unknown> | undefined;
                    return Boolean(condition && (condition.field || Array.isArray(condition.children) && condition.children.length > 0));
                });
            }
            if (!fieldValue || typeof fieldValue !== "object") return false;
            const condition = fieldValue as Record<string, unknown>;
            return Boolean(condition.field || Array.isArray(condition.children) && condition.children.length > 0);
        });
    }, [data, flowFields, supportsConditionalDestinations]);

    const qualityBadge = useMemo<"manual" | "off" | null>(() => {
        if (!node) return null;
        if (hasStraightLiningPolicy) {
            const mode = straightLiningPolicyMode(data);
            if (mode === "enabled") return "manual";
            if (mode === "disabled") return "off";
        }
        if (node.type === "multiInput") {
            const subFields = Array.isArray(data.fields) ? data.fields as Record<string, unknown>[] : [];
            if (subFields.some((field) => getPolicyMode(field) === "manual")) return "manual";
            if (subFields.length > 0 && subFields.every((field) => getPolicyMode(field) === "disabled")) return "off";
            return null;
        }
        const mode = getPolicyMode(data);
        if (mode === "manual") return "manual";
        if (mode === "disabled") return "off";
        return null;
    }, [data, hasStraightLiningPolicy, node]);

    const searchResults = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return null;
        return contentFields.filter((field) => field.label.toLowerCase().includes(query));
    }, [search, contentFields]);

    const showSearch = activeTab === "content" && contentFields.length >= 10;
    const hasErrorIssue = issues.some((issue) => issue.type === "error");

    if (!node || !definition) {
        return null;
    }

    const handleFieldChange = (field: PropertyField, val: any) => {
        if (readOnly) return;
        if (field.name === 'bulkOptions') {
            const lines = String(val).split('\n').map(l => l.trim()).filter(l => l.length > 0);
            if (lines.length > 0) {
                const newOptions = lines.map((l, i) => ({ label: l, value: `opt${Date.now()}_${i}` }));
                const optionsField = definition.properties.find(p => p.type === 'options');
                if (optionsField) onChange(optionsField.name, newOptions);
            }
        }
        onChange(field.name, val);
    };

    const renderPanelField = (field: PropertyField) => {
        const control = (
            <FieldRenderer
                field={field}
                value={data[field.name] ?? field.defaultValue}
                onChange={(val) => handleFieldChange(field, val)}
                nodes={nodes}
                edges={edges}
                readOnly={readOnly}
                nodeType={node.type}
                nodeId={node.id}
                fieldData={data}
                qualityPreview={{ ...qualityPreview, retry: retryQualityPreview }}
                isQuestionFlow={supportsConditionalDestinations}
                activePolicy={qualityPreview.policies[selectedPolicyKey]}
                automaticPolicy={qualityPreview.automaticPolicies[selectedPolicyKey]}
                onPatchData={(updates) => {
                    if (readOnly) return;
                    Object.entries(updates).forEach(([fieldName, nextValue]) => onChange(fieldName, nextValue));
                }}
            />
        );

        // Composite editors render their own content beneath the registry group heading.
        if (qualityFieldNames.has(field.name) || field.type === "condition" || field.panel?.presentation === "unlabeled") {
            return <div key={field.name}>{control}</div>;
        }

        if (field.panel?.presentation === "disclosure") {
            return (
                <details key={field.name} className="group rounded-md border border-border bg-muted/10">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-foreground [&::-webkit-details-marker]:hidden">
                        <span>{field.label}</span>
                        <IconChevronDown size={14} className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="space-y-1.5 border-t border-border p-3">
                        {control}
                        {field.helperText && <p className="text-[10px] leading-4 text-muted-foreground">{field.helperText}</p>}
                    </div>
                </details>
            );
        }

        if (field.type === "switch") {
            return (
                <div key={field.name} className="flex items-start justify-between gap-3 py-1">
                    <div className="min-w-0">
                        <label className="text-xs font-medium text-foreground">{field.label}</label>
                        {field.helperText && <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">{field.helperText}</p>}
                    </div>
                    <div className="shrink-0 pt-0.5">{control}</div>
                </div>
            );
        }

        if (isEndNode && field.name === "outcome") {
            const outcome = String(data.outcome ?? field.defaultValue ?? "completed") as SessionOutcome;
            const resolvedUrl = resolveOutcomeRedirectUrl(outcome, survey);
            return (
                <React.Fragment key={field.name}>
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">{field.label}</label>
                        {control}
                        {field.helperText && <p className="text-[10px] text-muted-foreground italic">{field.helperText}</p>}
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">Redirect URL</label>
                        <div className="flex items-center gap-2">
                            <div className={cn(
                                "flex-1 min-w-0 truncate rounded-md border border-input bg-muted/30 px-2.5 py-1.5 text-xs",
                                resolvedUrl ? "text-foreground" : "text-muted-foreground italic"
                            )}>
                                {resolvedUrl || "Not set"}
                            </div>
                            <button
                                type="button"
                                onClick={() => onOpenSettings?.(outcome)}
                                className="shrink-0 rounded-md border border-input px-2 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted transition-colors"
                            >
                                Edit URL
                            </button>
                        </div>
                        <p className="text-[10px] text-muted-foreground italic">
                            {OUTCOME_REDIRECT_LABELS[outcome]} redirect, managed in Survey Settings.
                        </p>
                    </div>
                </React.Fragment>
            );
        }

        return (
            <div key={field.name} className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">{field.label}</label>
                {control}
                {field.helperText && <p className="text-[10px] text-muted-foreground italic">{field.helperText}</p>}
            </div>
        );
    };

    const tabBadge = (tab: PanelTab) => {
        if (tab === "flow" && hasFlowRule) {
            return <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-primary" title="A flow rule is set" />;
        }
        if (tab === "quality" && qualityPreview.error) {
            return <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive/10 px-1 text-[9px] font-bold text-destructive" title="Quality preview unavailable">!</span>;
        }
        if (tab === "quality" && qualityBadge === "manual") {
            return <span className="ml-1 rounded-full bg-amber-500/15 px-1.5 py-px text-[9px] font-bold uppercase text-amber-600">Manual</span>;
        }
        if (tab === "quality" && qualityBadge === "off") {
            return <span className="ml-1 rounded-full bg-muted px-1.5 py-px text-[9px] font-bold uppercase text-muted-foreground">Off</span>;
        }
        return null;
    };

    const startResize = (event: React.PointerEvent) => {
        event.preventDefault();
        const startX = event.clientX;
        const startWidth = panelWidth;
        setIsResizing(true);

        const handleMove = (moveEvent: PointerEvent) => {
            setPanelWidth(clampPanelWidth(startWidth + (startX - moveEvent.clientX)));
        };
        const handleUp = (upEvent: PointerEvent) => {
            window.removeEventListener("pointermove", handleMove);
            window.removeEventListener("pointerup", handleUp);
            setIsResizing(false);
            window.localStorage.setItem(
                PANEL_WIDTH_STORAGE_KEY,
                String(clampPanelWidth(startWidth + (startX - upEvent.clientX)))
            );
        };
        window.addEventListener("pointermove", handleMove);
        window.addEventListener("pointerup", handleUp);
    };

    return (
        <aside
            style={{ width: panelWidth }}
            className={cn(
                "relative h-full bg-background border-l border-border flex flex-col shadow-xl z-20",
                isResizing && "select-none"
            )}
        >
            {/* Resize handle */}
            <div
                onPointerDown={startResize}
                className={cn(
                    "absolute inset-y-0 left-0 z-30 w-1.5 cursor-col-resize transition-colors touch-none",
                    isResizing ? "bg-primary/50" : "hover:bg-primary/30"
                )}
                title="Drag to resize"
            />

            {/* Header */}
            <div className="h-14 flex items-center justify-between px-4 border-b border-border bg-muted/10 shrink-0">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                        <definition.icon size={16} />
                    </div>
                    <span className="font-semibold text-sm tracking-tight">{definition.label}</span>
                    {readOnly && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-md border border-border text-muted-foreground">Read Only</span>}
                </div>
                <button title="Close panel" onClick={onClose} className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-md transition-colors">
                    <IconX size={16} />
                </button>
            </div>

            {/* Tabs */}
            {availableTabs.length > 1 && (
                <div className="flex items-center gap-4 border-b border-border px-4 shrink-0">
                    {availableTabs.map((tab) => (
                        <button
                            key={tab}
                            onClick={() => selectTab(tab)}
                            className={cn(
                                "-mb-px flex items-center border-b-2 pb-2 pt-2.5 text-xs font-semibold transition-colors",
                                activeTab === tab && !searchResults
                                    ? "border-primary text-foreground"
                                    : "border-transparent text-muted-foreground hover:text-foreground"
                            )}
                            aria-current={activeTab === tab ? "true" : undefined}
                        >
                            {TAB_LABELS[tab]}
                            {tabBadge(tab)}
                        </button>
                    ))}
                </div>
            )}

            {issues.length > 0 && (
                <details
                    className={cn(
                        "group mx-4 mt-3 shrink-0 rounded-md border",
                        hasErrorIssue
                            ? "border-destructive/30 bg-destructive/5"
                            : "border-amber-500/30 bg-amber-500/5"
                    )}
                >
                    <summary className="flex cursor-pointer list-none items-center gap-2 px-2.5 py-2 text-[11px] [&::-webkit-details-marker]:hidden">
                        <IconAlertTriangle
                            size={14}
                            className={hasErrorIssue ? "shrink-0 text-destructive" : "shrink-0 text-amber-600"}
                        />
                        <span className="shrink-0 font-semibold">
                            {issues.length} {issues.length === 1 ? "issue" : "issues"}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-muted-foreground">
                            {issues[0].message}
                        </span>
                        <IconChevronDown size={13} className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="space-y-1 border-t border-current/10 px-2.5 py-2" aria-live="polite">
                        {issues.map((issue, idx) => (
                            <div key={issue.code + "-" + idx} className="flex gap-1.5 text-[11px] leading-4">
                                <span className={cn(
                                    "shrink-0 font-semibold",
                                    issue.type === "error" ? "text-destructive" : "text-amber-700 dark:text-amber-300"
                                )}>
                                    {issue.type === "error" ? "Error" : "Warning"}
                                </span>
                                <span className="text-foreground/80">{issue.message}</span>
                            </div>
                        ))}
                    </div>
                </details>
            )}

            {showSearch && (
                <div className="px-4 pt-3 shrink-0">
                    <div className="relative">
                        <IconSearch size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Find a setting..."
                            className="w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-2 text-xs transition-all focus:outline-hidden focus:ring-1 focus:ring-primary"
                        />
                    </div>
                </div>
            )}

            {/* Form Fields */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className={cn("space-y-4", readOnly && "pointer-events-none opacity-60 grayscale")}>
                    {searchResults ? (
                        searchResults.length > 0 ? (
                            <div className="space-y-4">
                                {searchResults.map(renderPanelField)}
                            </div>
                        ) : (
                            <p className="py-6 text-center text-xs text-muted-foreground">
                                No settings match &ldquo;{search.trim()}&rdquo;
                            </p>
                        )
                    ) : (
                        <>
                            {activeTab === "content" && contentGroups.map((group) => {
                                const configuredCount = group.fields.filter((field) => {
                                    const fieldValue = data[field.name];
                                    return fieldValue !== undefined && fieldValue !== null && fieldValue !== "" && fieldValue !== false && fieldValue !== 0;
                                }).length;
                                const compactNumbers = group.fields.length > 1 && group.fields.every((field) => field.type === "number");

                                if (group.collapsible) {
                                    return (
                                        <details key={group.id} className="group border-t border-border pt-3">
                                            <summary className="flex cursor-pointer list-none items-center justify-between py-1 text-xs font-semibold text-foreground [&::-webkit-details-marker]:hidden">
                                                <span>{group.title}</span>
                                                <span className="flex items-center gap-2">
                                                    {configuredCount > 0 && (
                                                        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
                                                            {configuredCount} set
                                                        </span>
                                                    )}
                                                    <IconChevronDown size={14} className="text-muted-foreground transition-transform group-open:rotate-180" />
                                                </span>
                                            </summary>
                                            <div className={cn("pt-3", compactNumbers ? "grid grid-cols-2 gap-3" : "space-y-3")}>
                                                {group.fields.map(renderPanelField)}
                                            </div>
                                        </details>
                                    );
                                }

                                return (
                                    <section key={group.id} className="space-y-3">
                                        {contentGroups.length > 1 && (
                                            <h3 className="border-b border-border pb-2 text-xs font-semibold text-muted-foreground">
                                                {group.title}
                                            </h3>
                                        )}
                                        <div className={compactNumbers ? "grid grid-cols-2 gap-3" : "space-y-3"}>
                                            {group.fields.map(renderPanelField)}
                                        </div>
                                    </section>
                                );
                            })}
                            {activeTab === "flow" && (
                                supportsConditionalDestinations ? (
                                    <SkipRulesBuilder
                                        value={data.skips}
                                        onChange={(rules) => onChange("skips", rules)}
                                        condition={questionConditionField ? data[questionConditionField.name] : undefined}
                                        onConditionChange={questionConditionField
                                            ? (condition) => handleFieldChange(questionConditionField, condition)
                                            : undefined}
                                        nodes={nodes}
                                        edges={edges}
                                        currentNodeId={node.id}
                                        nodeType={node.type}
                                        nodeData={data}
                                        onInspectRule={onInspectFlowRule}
                                        readOnly={readOnly}
                                    />
                                ) : (
                                    flowFields.map(renderPanelField)
                                )
                            )}
                            {activeTab === "quality" && (
                                <>
                                    {qualityFields.map(renderPanelField)}
                                    {hasStraightLiningPolicy && (
                                        <StraightLiningQualityEditor
                                            nodeType={String(node.type)}
                                            fieldData={data}
                                            readOnly={readOnly}
                                            onChange={(policy) => onChange("straightLiningPolicy", policy)}
                                        />
                                    )}
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Node identity footer */}
            <div className="shrink-0 border-t border-border px-4 py-1.5 text-[10px] font-mono text-muted-foreground truncate" title={`${node.id} · ${node.type}`}>
                {node.id} · {node.type}
            </div>
        </aside>
    );
}

function StraightLiningQualityEditor({
    nodeType,
    fieldData,
    readOnly,
    onChange,
}: {
    nodeType: string;
    fieldData: Record<string, unknown>;
    readOnly?: boolean;
    onChange: (policy: Record<string, unknown>) => void;
}) {
    const rawPolicy = fieldData.straightLiningPolicy && typeof fieldData.straightLiningPolicy === "object"
        ? fieldData.straightLiningPolicy as Record<string, unknown>
        : {};
    const mode = straightLiningPolicyMode(fieldData);
    const comparableItems = nodeType === "matrixChoice"
        ? (Array.isArray(fieldData.rows) ? fieldData.rows.length : 0)
        : (Array.isArray(fieldData.items) ? fieldData.items.length : 0);
    const optionCount = nodeType === "matrixChoice"
        ? (Array.isArray(fieldData.columns) ? fieldData.columns.length : 0)
        : nodeType === "rating"
            ? Math.max(0, Math.floor(Number(fieldData.maxRating) || 0))
            : (() => {
                const min = Number(fieldData.min);
                const max = Number(fieldData.max);
                const step = Number(fieldData.step);
                return Number.isFinite(min) && Number.isFinite(max) && Number.isFinite(step) && step > 0 && max >= min
                    ? Math.floor((max - min) / step) + 1
                    : 0;
            })();
    const defaultMinResponses = optionCount === 2 ? 10 : 8;
    const minResponses = Number.isInteger(Number(rawPolicy.minResponses)) && Number(rawPolicy.minResponses) >= 2
        ? Number(rawPolicy.minResponses)
        : defaultMinResponses;
    const configuredRatio = Number(rawPolicy.nearStraightLineRatio);
    const thresholdPercent = Number.isFinite(configuredRatio) && configuredRatio > 0 && configuredRatio <= 1
        ? Math.round(configuredRatio * 100)
        : 90;
    const inputClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50";

    const setMode = (nextMode: StraightLiningPolicyMode) => {
        if (nextMode === "inherit" || nextMode === "disabled") {
            onChange({ mode: nextMode });
            return;
        }
        onChange({
            mode: "enabled",
            minResponses,
            nearStraightLineRatio: thresholdPercent / 100,
        });
    };

    const updateEnabledPolicy = (updates: Record<string, unknown>) => {
        onChange({
            mode: "enabled",
            minResponses,
            nearStraightLineRatio: thresholdPercent / 100,
            ...updates,
        });
    };

    return (
        <section className="space-y-3 rounded-lg border border-border bg-muted/10 p-3">
            <div>
                <p className="text-xs font-semibold text-foreground">Uniform response patterns</p>
                <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                    Applies only to comparable items in this {nodeType === "matrixChoice" ? "grid" : "multi-item scale"}. A finding requests review; it does not prove careless responding.
                </p>
            </div>

            <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Policy</label>
                <select
                    disabled={readOnly}
                    value={mode}
                    onChange={(event) => setMode(event.target.value as StraightLiningPolicyMode)}
                    className={inputClass}
                >
                    <option value="inherit">Use survey defaults</option>
                    <option value="enabled">Override for this question</option>
                    <option value="disabled">Disable for this question</option>
                </select>
            </div>

            {mode === "enabled" && (
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-semibold text-muted-foreground">Minimum comparable answers</label>
                        <input
                            type="number"
                            min={2}
                            step={1}
                            disabled={readOnly}
                            value={minResponses}
                            onChange={(event) => updateEnabledPolicy({ minResponses: Math.max(2, Math.floor(Number(event.target.value) || 2)) })}
                            className={inputClass}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-semibold text-muted-foreground">Same-answer threshold</label>
                        <div className="relative">
                            <input
                                type="number"
                                min={1}
                                max={100}
                                step={1}
                                disabled={readOnly}
                                value={thresholdPercent}
                                onChange={(event) => updateEnabledPolicy({
                                    nearStraightLineRatio: Math.min(100, Math.max(1, Number(event.target.value) || 1)) / 100,
                                })}
                                className={`${inputClass} pr-8`}
                            />
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                        </div>
                    </div>
                </div>
            )}

            <div className="rounded-md bg-background px-3 py-2 text-[11px] text-muted-foreground">
                This question currently has <span className="font-semibold text-foreground">{comparableItems}</span> comparable item{comparableItems === 1 ? "" : "s"}
                {optionCount > 0 && <> and <span className="font-semibold text-foreground">{optionCount}</span> answer options</>}.
                {mode === "inherit" && " Survey-level minimums and threshold apply."}
                {mode === "disabled" && " This question will not be evaluated for uniform patterns."}
                {mode === "enabled" && comparableItems < minResponses && ` It will not be evaluated until it has at least ${minResponses} comparable items.`}
            </div>
        </section>
    );
}


const MULTI_INPUT_FIELD_TYPES = [
    { label: "Text", value: "text" },
    { label: "Email", value: "email" },
    { label: "Number", value: "number" },
] as const;

const OPEN_END_INTENT_OPTIONS = [
    { label: "Name / identifier", value: "name_identifier" },
    { label: "Contact info", value: "contact" },
    { label: "Short fact", value: "short_fact" },
    { label: "Yes/no or short option", value: "yes_no_short_option" },
    { label: "Single word", value: "single_word" },
    { label: "Reason / opinion", value: "reason_opinion" },
    { label: "Long explanation", value: "long_explanation" },
    { label: "Other / ambiguous", value: "other" },
] as const;

type PolicyMode = "auto" | "manual" | "disabled";

type MultiInputFieldItem = {
    id?: string;
    exportId?: string;
    label?: string;
    value?: string;
    openEndPolicyMode?: PolicyMode | string;
    openEndQualityEnabled?: boolean;
    openEndAnswerIntent?: string;
    openEndAiJudgeEnabled?: boolean;
    openEndTooShortEnabled?: boolean;
    openEndKeyboardMashEnabled?: boolean;
    openEndDuplicateEnabled?: boolean;
    openEndRelevanceEnabled?: boolean;
    openEndLanguageMismatchEnabled?: boolean;
    openEndAiGeneratedEnabled?: boolean;
};

const QUALITY_OVERRIDE_KEYS = [
    "openEndAiJudgeEnabled",
    "openEndTooShortEnabled",
    "openEndKeyboardMashEnabled",
    "openEndDuplicateEnabled",
    "openEndRelevanceEnabled",
    "openEndLanguageMismatchEnabled",
    "openEndAiGeneratedEnabled",
] as const;

const QUALITY_FIELD_NAMES = new Set<string>([
    "openEndPolicyMode",
    "openEndAnswerIntent",
    "openEndQualityEnabled",
    ...QUALITY_OVERRIDE_KEYS,
]);

const POLICY_MODE_OPTIONS: Array<{ label: string; value: PolicyMode; description: string }> = [
    { label: "Auto-detect", value: "auto", description: "Recommended. The compiler chooses the right policy from the question text." },
    { label: "Manual override", value: "manual", description: "Use when the detected policy is wrong for this field." },
    { label: "Disable checks", value: "disabled", description: "Use for fields where open-ended quality should not run." },
];

const INTENT_LABELS: Record<OpenEndQualityPolicyPreview["answerIntent"], string> = {
    IDENTITY: "Identity / name",
    CONTACT: "Contact info",
    SHORT_FACT: "Short fact",
    YES_NO: "Yes/no",
    SINGLE_WORD: "Single word",
    REASON_OPINION: "Reason / opinion",
    LONG_FEEDBACK: "Long feedback",
    AMBIGUOUS: "Other / ambiguous",
};

const SHAPE_LABELS: Record<OpenEndQualityPolicyPreview["expectedAnswerShape"], string> = {
    single_word: "Single word",
    short_phrase: "Short phrase",
    sentence: "Sentence",
    paragraph: "Paragraph",
};

const SOURCE_LABELS: Record<OpenEndQualityPolicyPreview["source"], string> = {
    AI_INFERRED: "AI inferred",
    SYSTEM_DEFAULT: "Auto heuristic",
    CREATOR_OVERRIDE: "Creator override",
};

const SUMMARY_CHECK_LABELS: Array<{ key: keyof OpenEndQualityPolicyPreview["checks"]; label: string }> = [
    { key: "tooShort", label: "Too short" },
    { key: "keyboardMash", label: "Keyboard mash" },
    { key: "duplicateWithinSession", label: "Duplicate" },
    { key: "relevance", label: "Relevance" },
    { key: "gibberish", label: "Gibberish" },
    { key: "languageMismatch", label: "Language" },
    { key: "aiGeneratedText", label: "AI text" },
];

const MANUAL_CHECK_DEFINITIONS: Array<{
    label: string;
    dataKey: typeof QUALITY_OVERRIDE_KEYS[number];
    policyKey: keyof OpenEndQualityPolicyPreview["checks"];
    requiresAi?: boolean;
}> = [
    { label: "Too short", dataKey: "openEndTooShortEnabled", policyKey: "tooShort" },
    { label: "Keyboard mash", dataKey: "openEndKeyboardMashEnabled", policyKey: "keyboardMash" },
    { label: "Duplicate", dataKey: "openEndDuplicateEnabled", policyKey: "duplicateWithinSession" },
    { label: "Relevance", dataKey: "openEndRelevanceEnabled", policyKey: "relevance", requiresAi: true },
    { label: "Language", dataKey: "openEndLanguageMismatchEnabled", policyKey: "languageMismatch", requiresAi: true },
    { label: "AI text", dataKey: "openEndAiGeneratedEnabled", policyKey: "aiGeneratedText", requiresAi: true },
];

const hasOwn = (source: Record<string, unknown>, key: string) => Object.prototype.hasOwnProperty.call(source, key);

const getBooleanOverride = (source: Record<string, unknown>, key: string): boolean | undefined => (
    hasOwn(source, key) && typeof source[key] === "boolean" ? source[key] as boolean : undefined
);

const normalizePolicyMode = (value: unknown): PolicyMode | null => (
    value === "auto" || value === "manual" || value === "disabled" ? value : null
);

const hasManualQualityOverrides = (source: Record<string, unknown>) => {
    const intent = typeof source.openEndAnswerIntent === "string" ? source.openEndAnswerIntent : "";
    return Boolean(source.openEndQualityEnabled)
        || (intent.length > 0 && intent !== "auto_detect")
        || QUALITY_OVERRIDE_KEYS.some((key) => hasOwn(source, key));
};

const getPolicyMode = (source: Record<string, unknown> = {}): PolicyMode => {
    const explicitMode = normalizePolicyMode(source.openEndPolicyMode);
    if (explicitMode) return explicitMode;
    return hasManualQualityOverrides(source) ? "manual" : "auto";
};

const intentToUiIntent = (intent?: OpenEndQualityPolicyPreview["answerIntent"]): string => {
    switch (intent) {
        case "IDENTITY":
            return "name_identifier";
        case "CONTACT":
            return "contact";
        case "SHORT_FACT":
            return "short_fact";
        case "YES_NO":
            return "yes_no_short_option";
        case "SINGLE_WORD":
            return "single_word";
        case "REASON_OPINION":
            return "reason_opinion";
        case "LONG_FEEDBACK":
            return "long_explanation";
        case "AMBIGUOUS":
            return "other";
        default:
            return "reason_opinion";
    }
};

const clearQualityOverridePatch = (): Record<string, unknown> => ({
    openEndPolicyMode: "auto",
    openEndAnswerIntent: "auto_detect",
    openEndQualityEnabled: undefined,
    openEndAiJudgeEnabled: undefined,
    openEndTooShortEnabled: undefined,
    openEndKeyboardMashEnabled: undefined,
    openEndDuplicateEnabled: undefined,
    openEndRelevanceEnabled: undefined,
    openEndLanguageMismatchEnabled: undefined,
    openEndAiGeneratedEnabled: undefined,
});

const disableQualityPatch = (): Record<string, unknown> => ({
    ...clearQualityOverridePatch(),
    openEndPolicyMode: "disabled",
    openEndQualityEnabled: false,
});

const manualQualityPatch = (intent: string): Record<string, unknown> => ({
    openEndPolicyMode: "manual",
    openEndQualityEnabled: true,
    openEndAnswerIntent: intent,
});

const activeCheckLabels = (policy?: OpenEndQualityPolicyPreview) => {
    if (!policy?.enabled) return [];
    return SUMMARY_CHECK_LABELS.filter((check) => policy.checks[check.key]).map((check) => check.label);
};

const policyReason = (policy: OpenEndQualityPolicyPreview) => policy.reasonCode
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());

function TinySwitch({ checked, onChange, disabled = false }: { checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={cn(
                "relative inline-flex h-4 w-7 items-center rounded-full transition-colors focus:outline-hidden disabled:opacity-50 disabled:cursor-not-allowed",
                checked ? "bg-primary" : "bg-input"
            )}
        >
            <span className={cn("inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform", checked ? "translate-x-4" : "translate-x-1")} />
        </button>
    );
}

function PolicySummaryCard({
    title,
    policy,
    loading,
    error,
    onRetry,
}: {
    title: string;
    policy?: OpenEndQualityPolicyPreview;
    loading?: boolean;
    error?: string | null;
    onRetry?: () => void;
}) {
    if (loading && !policy) {
        return (
            <div className="rounded-md border border-border bg-muted/20 p-3" aria-live="polite">
                <p className="text-xs font-semibold text-foreground">{title}</p>
                <div className="mt-2 space-y-2 animate-pulse" aria-label="Detecting quality policy">
                    <div className="h-2 w-3/4 rounded bg-muted" />
                    <div className="h-2 w-1/2 rounded bg-muted" />
                </div>
            </div>
        );
    }

    if (error && !policy) {
        return (
            <div className="rounded-md border border-destructive/25 bg-muted/15 p-3" role="status">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground">{title}</p>
                        <p className="mt-1 text-[11px] font-medium text-destructive">Quality policy unavailable</p>
                    </div>
                    {onRetry && (
                        <button
                            type="button"
                            onClick={onRetry}
                            className="flex shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[10px] font-semibold text-foreground transition-colors hover:bg-muted"
                        >
                            <IconRefresh size={12} /> Retry
                        </button>
                    )}
                </div>
                <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
                    The preview could not be loaded. Your saved settings are unchanged.
                </p>
            </div>
        );
    }

    if (!policy) {
        return (
            <div className="rounded-md border border-border bg-muted/30 p-3">
                <p className="text-xs font-semibold text-foreground">{title}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">No policy preview yet. Save or edit the field label to refresh detection.</p>
            </div>
        );
    }

    const checks = activeCheckLabels(policy);

    return (
        <div className="rounded-md border border-border bg-background p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
                <div>
                    <p className="text-xs font-semibold text-foreground">{title}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {SOURCE_LABELS[policy.source]} - {Math.round(policy.confidence * 100)}% confidence
                    </p>
                </div>
                <span className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    policy.enabled ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"
                )}>
                    {policy.enabled ? "Enabled" : "Disabled"}
                </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded bg-muted/50 px-2 py-1.5">
                    <span className="block text-muted-foreground">Intent</span>
                    <span className="font-medium text-foreground">{INTENT_LABELS[policy.answerIntent]}</span>
                </div>
                <div className="rounded bg-muted/50 px-2 py-1.5">
                    <span className="block text-muted-foreground">Expected</span>
                    <span className="font-medium text-foreground">{SHAPE_LABELS[policy.expectedAnswerShape]}</span>
                </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
                {checks.length > 0 ? checks.map((check) => (
                    <span key={check} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{check}</span>
                )) : (
                    <span className="text-[11px] text-muted-foreground">No active detectors for this policy.</span>
                )}
            </div>
            <p className="text-[10px] text-muted-foreground">Reason: {policyReason(policy)}</p>
        </div>
    );
}

function PolicyModeSelect({ mode, readOnly, onChange }: { mode: PolicyMode; readOnly?: boolean; onChange: (mode: PolicyMode) => void }) {
    return (
        <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground">Policy mode</label>
            <select
                disabled={readOnly}
                value={mode}
                onChange={(event) => onChange(event.target.value as PolicyMode)}
                className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-hidden focus:ring-1 focus:ring-primary transition-all appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {POLICY_MODE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                ))}
            </select>
            <p className="text-[10px] text-muted-foreground italic">{POLICY_MODE_OPTIONS.find((option) => option.value === mode)?.description}</p>
        </div>
    );
}

function ManualQualityControls({
    source,
    policy,
    readOnly,
    onUpdate,
}: {
    source: Record<string, unknown>;
    policy?: OpenEndQualityPolicyPreview;
    readOnly?: boolean;
    onUpdate: (updates: Record<string, unknown>) => void;
}) {
    const explicitAiJudge = getBooleanOverride(source, "openEndAiJudgeEnabled");
    const aiJudgeEnabled = explicitAiJudge ?? Boolean(policy?.checks.relevance || policy?.checks.gibberish || policy?.checks.languageMismatch || policy?.checks.aiGeneratedText);

    const checkValue = (dataKey: string, policyKey: keyof OpenEndQualityPolicyPreview["checks"], requiresAi?: boolean) => {
        if (requiresAi && !aiJudgeEnabled) return false;
        return getBooleanOverride(source, dataKey) ?? Boolean(policy?.checks[policyKey]);
    };

    return (
        <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-xs font-medium text-foreground">AI judge checks</p>
                    <p className="text-[10px] text-muted-foreground">Controls relevance, gibberish, language, and AI-text signals.</p>
                </div>
                <TinySwitch
                    checked={aiJudgeEnabled}
                    disabled={readOnly}
                    onChange={(next) => onUpdate(next ? { openEndAiJudgeEnabled: true } : {
                        openEndAiJudgeEnabled: false,
                        openEndRelevanceEnabled: false,
                        openEndLanguageMismatchEnabled: false,
                        openEndAiGeneratedEnabled: false,
                    })}
                />
            </div>
            <div className="grid grid-cols-2 gap-2">
                {MANUAL_CHECK_DEFINITIONS.map((definition) => {
                    const checked = checkValue(definition.dataKey, definition.policyKey, definition.requiresAi);
                    return (
                        <div key={definition.dataKey} className="rounded-md border border-border bg-background px-2 py-2 flex items-center justify-between gap-2">
                            <span className="text-[11px] text-foreground">{definition.label}</span>
                            <TinySwitch
                                checked={checked}
                                disabled={readOnly || (definition.requiresAi && !aiJudgeEnabled)}
                                onChange={(next) => onUpdate({ [definition.dataKey]: next })}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function OpenEndQualityEditor({
    fieldData,
    automaticPolicy,
    activePolicy,
    previewLoading,
    previewError,
    onRetry,
    readOnly,
    onPatchData,
}: {
    fieldData: Record<string, unknown>;
    automaticPolicy?: OpenEndQualityPolicyPreview;
    activePolicy?: OpenEndQualityPolicyPreview;
    previewLoading: boolean;
    previewError: string | null;
    onRetry?: () => void;
    readOnly?: boolean;
    onPatchData?: (updates: Record<string, unknown>) => void;
}) {
    const mode = getPolicyMode(fieldData);
    const inferredIntent = intentToUiIntent(automaticPolicy?.answerIntent || activePolicy?.answerIntent);
    const configuredIntent = typeof fieldData.openEndAnswerIntent === "string" && fieldData.openEndAnswerIntent !== "auto_detect"
        ? fieldData.openEndAnswerIntent
        : inferredIntent;

    const handleModeChange = (nextMode: PolicyMode) => {
        if (!onPatchData) return;
        if (nextMode === "auto") onPatchData(clearQualityOverridePatch());
        if (nextMode === "manual") onPatchData(manualQualityPatch(configuredIntent));
        if (nextMode === "disabled") onPatchData(disableQualityPatch());
    };

    return (
        <div className="space-y-3">
            <PolicySummaryCard title="Auto-detected policy" policy={automaticPolicy} loading={previewLoading} error={previewError} onRetry={onRetry} />
            <div className="rounded-md border border-border bg-muted/10 p-3 space-y-3">
                <PolicyModeSelect mode={mode} readOnly={readOnly} onChange={handleModeChange} />
                {mode === "auto" && (
                    <p className="rounded-md bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-700 dark:text-emerald-300">
                        Auto-detect is active. Identity, contact, and short factual fields stay lightweight; explanation and feedback fields get stricter checks.
                    </p>
                )}
                {mode === "manual" && (
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-muted-foreground">Manual intent</label>
                            <select
                                disabled={readOnly}
                                value={configuredIntent}
                                onChange={(event) => onPatchData?.(manualQualityPatch(event.target.value))}
                                className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-hidden focus:ring-1 focus:ring-primary transition-all appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {OPEN_END_INTENT_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </div>
                        <ManualQualityControls source={fieldData} policy={activePolicy} readOnly={readOnly} onUpdate={(updates) => onPatchData?.(updates)} />
                    </div>
                )}
                {mode === "disabled" && (
                    <p className="rounded-md bg-muted px-3 py-2 text-[11px] text-muted-foreground">
                        Quality checks are disabled for this field. The runner will collect the answer without open-ended scoring.
                    </p>
                )}
            </div>
            {mode !== "auto" && (
                <PolicySummaryCard title="Effective runtime policy" policy={activePolicy} loading={previewLoading} error={previewError} onRetry={onRetry} />
            )}
        </div>
    );
}

function MultiInputQualityEditor({
    field,
    automaticPolicy,
    activePolicy,
    previewLoading,
    previewError,
    onRetry,
    readOnly,
    onUpdate,
}: {
    field: MultiInputFieldItem;
    automaticPolicy?: OpenEndQualityPolicyPreview;
    activePolicy?: OpenEndQualityPolicyPreview;
    previewLoading: boolean;
    previewError: string | null;
    onRetry?: () => void;
    readOnly?: boolean;
    onUpdate: (updates: Partial<MultiInputFieldItem>) => void;
}) {
    const source = field as Record<string, unknown>;
    const mode = getPolicyMode(source);
    const inferredIntent = intentToUiIntent(automaticPolicy?.answerIntent || activePolicy?.answerIntent);
    const configuredIntent = typeof field.openEndAnswerIntent === "string" && field.openEndAnswerIntent !== "auto_detect"
        ? field.openEndAnswerIntent
        : inferredIntent;

    const patchField = (updates: Record<string, unknown>) => onUpdate(updates as Partial<MultiInputFieldItem>);
    const handleModeChange = (nextMode: PolicyMode) => {
        if (nextMode === "auto") patchField(clearQualityOverridePatch());
        if (nextMode === "manual") patchField(manualQualityPatch(configuredIntent));
        if (nextMode === "disabled") patchField(disableQualityPatch());
    };

    return (
        <div className="rounded-md border border-border bg-background/60 p-3 space-y-3">
            <PolicySummaryCard title="Auto-detected subfield policy" policy={automaticPolicy} loading={previewLoading} error={previewError} onRetry={onRetry} />
            <PolicyModeSelect mode={mode} readOnly={readOnly} onChange={handleModeChange} />
            {mode === "manual" && (
                <div className="space-y-3">
                    <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-muted-foreground">Manual intent</label>
                        <select
                            disabled={readOnly}
                            value={configuredIntent}
                            onChange={(event) => patchField(manualQualityPatch(event.target.value))}
                            className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-hidden focus:ring-1 focus:ring-primary transition-all appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {OPEN_END_INTENT_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                    <ManualQualityControls source={source} policy={activePolicy} readOnly={readOnly} onUpdate={patchField} />
                </div>
            )}
            {mode === "disabled" && (
                <p className="rounded-md bg-muted px-3 py-2 text-[11px] text-muted-foreground">
                    Disabled for this subfield only. Other fields in this multi-input can still use auto-detect.
                </p>
            )}
            {mode !== "auto" && <PolicySummaryCard title="Effective subfield policy" policy={activePolicy} loading={previewLoading} error={previewError} onRetry={onRetry} />}
        </div>
    );
}

function MultiInputFieldsBuilder({
    value,
    onChange,
    readOnly = false,
    nodeId,
    qualityPreview = EMPTY_OPEN_END_PREVIEW,
}: {
    value: MultiInputFieldItem[];
    onChange: (next: MultiInputFieldItem[]) => void;
    readOnly?: boolean;
    nodeId?: string;
    qualityPreview?: OpenEndQualityPreviewState;
}) {
    const fields = Array.isArray(value) ? value : [];

    const addField = () => {
        onChange([
            ...fields,
            {
                id: `field_${Date.now()}`,
                label: `Field ${fields.length + 1}`,
                value: "text",
                openEndPolicyMode: "auto",
                openEndAnswerIntent: "auto_detect",
            },
        ]);
    };

    const updateField = (index: number, updates: Partial<MultiInputFieldItem>) => {
        const next = [...fields];
        next[index] = { ...next[index], ...updates };
        onChange(next);
    };

    const removeField = (index: number) => {
        onChange(fields.filter((_, currentIndex) => currentIndex !== index));
    };

    if (!fields.length) {
        return readOnly ? (
            <div className="text-xs text-muted-foreground italic">No fields defined</div>
        ) : (
            <button
                type="button"
                onClick={addField}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border px-3 py-3 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/50 hover:text-primary"
            >
                                    <IconPlus size={14} />
                <span className="text-sm font-medium">Add Your First Field</span>
                <p className="text-[10px] opacity-70">Each field gets its own auto-detected quality policy</p>
            </button>
        );
    }

    return (
        <div className="space-y-3">
            {fields.map((field, index) => {
                const policyKey = buildOpenEndPolicyKey(nodeId, field.id || null);
                return (
                    <MultiInputFieldCard
                        key={field.id || field.exportId || index}
                        field={field}
                        index={index}
                        readOnly={readOnly}
                        automaticPolicy={qualityPreview.automaticPolicies[policyKey]}
                        activePolicy={qualityPreview.policies[policyKey]}
                        previewLoading={qualityPreview.loading}
                        previewError={qualityPreview.error}
                        onRetry={qualityPreview.retry}
                        onUpdate={(updates) => updateField(index, updates)}
                        onRemove={() => removeField(index)}
                    />
                );
            })}
            {!readOnly && (
                <button
                    type="button"
                    onClick={addField}
                    className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-border py-2 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                    <IconPlus size={14} /> Add Field
                </button>
            )}
        </div>
    );
}

function MultiInputFieldCard({
    field,
    index,
    onUpdate,
    onRemove,
    automaticPolicy,
    activePolicy,
    previewLoading,
    previewError,
    onRetry,
    readOnly = false,
}: {
    field: MultiInputFieldItem;
    index: number;
    onUpdate: (updates: Partial<MultiInputFieldItem>) => void;
    onRemove: () => void;
    automaticPolicy?: OpenEndQualityPolicyPreview;
    activePolicy?: OpenEndQualityPolicyPreview;
    previewLoading: boolean;
    previewError: string | null;
    onRetry?: () => void;
    readOnly?: boolean;
}) {
    const [isExpanded, setIsExpanded] = useState(index === 0);

    return (
        <div className="overflow-hidden rounded-md border border-border bg-muted/5">
            <div className={cn("flex items-center gap-2 bg-muted/20 px-3 py-2", isExpanded && "border-b border-border")}>
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{field.label || `Field ${index + 1}`}</p>
                    <p className="text-[10px] text-muted-foreground">{field.value || "text"} subfield</p>
                </div>
                <button
                    type="button"
                    title={isExpanded ? "Collapse field" : "Expand field"}
                    onClick={() => setIsExpanded((expanded) => !expanded)}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                    <IconChevronDown size={14} className={cn("transition-transform", isExpanded && "rotate-180")} />
                </button>
                {!readOnly && (
                    <button type="button" onClick={onRemove} className="p-1 text-muted-foreground hover:text-destructive">
                        <IconTrash size={14} />
                    </button>
                )}
            </div>
            {isExpanded && (
                <div className="space-y-3 p-3">
                <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground">Field label</label>
                    <input
                        type="text"
                        disabled={readOnly}
                        value={field.label || ""}
                        onChange={(event) => onUpdate({ label: event.target.value })}
                        className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-hidden focus:ring-1 focus:ring-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        placeholder={`Field ${index + 1}`}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground">Input type</label>
                    <select
                        disabled={readOnly}
                        value={field.value || "text"}
                        onChange={(event) => onUpdate({ value: event.target.value })}
                        className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-hidden focus:ring-1 focus:ring-primary transition-all appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {MULTI_INPUT_FIELD_TYPES.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                </div>
                <MultiInputQualityEditor
                    field={field}
                    automaticPolicy={automaticPolicy}
                    activePolicy={activePolicy}
                    previewLoading={previewLoading}
                    previewError={previewError}
                    onRetry={onRetry}
                    readOnly={readOnly}
                    onUpdate={onUpdate}
                />
                </div>
            )}
        </div>
    );
}


type BranchOutRoute = {
    id: string;
    label: string;
    condition: LogicGroup;
};

const createEmptyCondition = (): LogicGroup => ({
    id: "root",
    type: "group",
    logicType: "AND",
    children: [],
});

const createRouteId = () => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return `path-${crypto.randomUUID().slice(0, 8)}`;
    }
    return `path-${Date.now().toString(36)}`;
};

const normalizeBranchRoutes = (value: unknown): BranchOutRoute[] => (
    Array.isArray(value)
        ? value.map((route, index) => {
            const record = (route || {}) as Record<string, unknown>;
            return {
                id: typeof record.id === "string" && record.id.trim() ? record.id : `path-${index + 1}`,
                label: typeof record.label === "string" && record.label.trim() ? record.label : `Path ${index + 1}`,
                condition: record.condition && typeof record.condition === "object" ? record.condition as LogicGroup : createEmptyCondition(),
            };
        })
        : []
);

function BranchRoutesBuilder({
    value,
    onChange,
    nodes,
    edges,
    nodeId,
    readOnly,
}: {
    value: unknown;
    onChange: (val: BranchOutRoute[]) => void;
    nodes: Node[];
    edges: Edge[];
    nodeId?: string;
    readOnly?: boolean;
}) {
    const setSurveyEdges = useSurveyStore((state) => state.setEdges);
    const routes = normalizeBranchRoutes(value);

    const commit = (nextRoutes: BranchOutRoute[]) => {
        if (readOnly) return;
        onChange(nextRoutes);
    };

    const updateRoute = (index: number, patch: Partial<BranchOutRoute>) => {
        const nextRoutes = routes.map((route, routeIndex) => routeIndex === index ? { ...route, ...patch } : route);
        commit(nextRoutes);
    };

    const moveRoute = (index: number, direction: -1 | 1) => {
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= routes.length) return;
        const nextRoutes = [...routes];
        const [route] = nextRoutes.splice(index, 1);
        if (!route) return;
        nextRoutes.splice(targetIndex, 0, route);
        commit(nextRoutes);
    };

    const removeRoute = (index: number) => {
        const removedRoute = routes[index];
        if (removedRoute && nodeId) {
            setSurveyEdges(edges.filter((edge) => !(edge.source === nodeId && edge.sourceHandle === removedRoute.id)));
        }
        commit(routes.filter((_, routeIndex) => routeIndex !== index));
    };

    const addRoute = () => {
        commit([
            ...routes,
            {
                id: createRouteId(),
                label: `Path ${routes.length + 1}`,
                condition: createEmptyCondition(),
            },
        ]);
    };

    return (
        <div className="space-y-3">
            {routes.map((route, index) => (
                <div key={route.id} className="rounded-lg border border-border bg-card overflow-hidden">
                    <div className="flex items-center gap-1.5 border-b border-border bg-muted/25 p-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-cyan-500/10 text-[10px] font-bold text-cyan-700">
                            {index + 1}
                        </span>
                        <input
                            type="text"
                            disabled={readOnly}
                            value={route.label}
                            onChange={(event) => updateRoute(index, { label: event.target.value })}
                            className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs font-medium outline-hidden focus:ring-1 focus:ring-primary disabled:opacity-50"
                            placeholder={`Path ${index + 1}`}
                        />
                        <button
                            type="button"
                            disabled={readOnly || index === 0}
                            title="Move route up"
                            onClick={() => moveRoute(index, -1)}
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
                        >
                            <IconArrowUp size={14} />
                        </button>
                        <button
                            type="button"
                            disabled={readOnly || index === routes.length - 1}
                            title="Move route down"
                            onClick={() => moveRoute(index, 1)}
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
                        >
                            <IconArrowDown size={14} />
                        </button>
                        <button
                            type="button"
                            disabled={readOnly}
                            title="Delete route"
                            onClick={() => removeRoute(index)}
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-35"
                        >
                            <IconTrash size={14} />
                        </button>
                    </div>
                    <div className="p-2">
                        <ConditionBuilder
                            value={route.condition || createEmptyCondition()}
                            onChange={(condition) => updateRoute(index, { condition })}
                            nodes={nodes}
                            edges={edges}
                            currentNodeId={nodeId}
                        />
                    </div>
                </div>
            ))}
            {!readOnly && (
                <button
                    type="button"
                    onClick={addRoute}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs font-semibold text-primary transition-colors hover:border-primary/60 hover:bg-primary/5"
                >
                    <IconPlus size={14} />
                    Add Route
                </button>
            )}
        </div>
    );
}

const getConditionPanelCopy = (nodeType?: string, fallbackTitle = "Display condition") => {
    if (nodeType === "validation") {
        return {
            title: "Validation rules",
            description: "Check answers against these rules before the flow continues.",
        };
    }
    if (nodeType === "branch") {
        return {
            title: "Branch condition",
            description: "Send respondents through this branch when the condition matches.",
        };
    }
    if (nodeType === "skip") {
        return {
            title: "Skip when",
            description: "Jump respondents through the skip path when the condition matches.",
        };
    }
    return {
        title: fallbackTitle === "Logic Rule" ? "Show condition" : fallbackTitle,
        description: "Show this question only when the condition matches. With no rules, it is always shown.",
    };
};

const countConditionRules = (value: unknown): number => {
    if (!value || typeof value !== "object") return 0;
    const item = value as { type?: string; children?: unknown[] };
    if (item.type === "rule") return 1;
    if (!Array.isArray(item.children)) return 0;
    let total = 0;
    for (const child of item.children) total += countConditionRules(child);
    return total;
};

function BulkOptionsEditor({
    placeholder,
    onApply,
    readOnly = false,
}: {
    placeholder?: string;
    onApply: (value: string) => void;
    readOnly?: boolean;
}) {
    const [draft, setDraft] = useState("");
    const optionCount = draft.split("\n").filter((line) => line.trim().length > 0).length;

    const applyList = () => {
        if (optionCount === 0 || readOnly) return;
        onApply(draft);
        setDraft("");
    };

    return (
        <div className="space-y-2">
            <textarea
                disabled={readOnly}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={placeholder}
                rows={4}
                className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm transition-all focus:outline-hidden focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
            />
            <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] text-muted-foreground">
                    {optionCount === 0 ? "No options" : optionCount + " " + (optionCount === 1 ? "option" : "options")}
                </span>
                <button
                    type="button"
                    disabled={readOnly || optionCount === 0}
                    onClick={applyList}
                    className="rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    Apply list
                </button>
            </div>
        </div>
    );
}

function FieldRenderer({
    field,
    value,
    onChange,
    nodes,
    edges,
    readOnly,
    nodeType,
    nodeId,
    fieldData = {},
    qualityPreview = EMPTY_OPEN_END_PREVIEW,
    isQuestionFlow = false,
    activePolicy,
    automaticPolicy,
    onPatchData,
}: {
    field: PropertyField,
    value: any,
    onChange: (val: any) => void,
    nodes: Node[],
    edges: Edge[],
    readOnly?: boolean,
    nodeType?: string,
    nodeId?: string,
    fieldData?: Record<string, unknown>,
    qualityPreview?: OpenEndQualityPreviewState,
    isQuestionFlow?: boolean,
    activePolicy?: OpenEndQualityPolicyPreview,
    automaticPolicy?: OpenEndQualityPolicyPreview,
    onPatchData?: (updates: Record<string, unknown>) => void,
}) {
    if (field.name === "bulkOptions") {
        return (
            <BulkOptionsEditor
                placeholder={field.placeholder}
                onApply={onChange}
                readOnly={readOnly}
            />
        );
    }

    if (QUALITY_FIELD_NAMES.has(field.name)) {
        if (field.name !== "openEndAnswerIntent") return null;
        if (nodeType === "textInput") {
            return (
                <OpenEndQualityEditor
                    fieldData={fieldData}
                    automaticPolicy={automaticPolicy}
                    activePolicy={activePolicy}
                    previewLoading={qualityPreview.loading}
                    previewError={qualityPreview.error}
                    onRetry={qualityPreview.retry}
                    readOnly={readOnly}
                    onPatchData={onPatchData}
                />
            );
        }
        if (nodeType === "multiInput") {
            return (
                <div className="rounded-md border border-border bg-muted/30 p-3">
                    <p className="text-xs font-semibold text-foreground">Per-subfield quality policies</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">Each input field above shows its own auto-detected policy and override controls.</p>
                </div>
            );
        }
        return null;
    }

    if (readOnly) {
        // Logic fields and complex builders should be disabled
        if (['condition', 'branchRoutes', 'stepBuilder', 'emojiOptions'].includes(field.type)) {
            return (
                <div className="pointer-events-none opacity-60 grayscale">
                    <FieldRenderer field={field} value={value} onChange={() => { }} nodes={nodes} edges={edges} readOnly={false} nodeType={nodeType} nodeId={nodeId} fieldData={fieldData} qualityPreview={qualityPreview} isQuestionFlow={isQuestionFlow} activePolicy={activePolicy} automaticPolicy={automaticPolicy} onPatchData={onPatchData} />
                </div>
            );
        }
    }

    switch (field.type) {
        case 'condition': {
            if (nodeType === 'branch' && nodeId) {
                return (
                    <BranchPathEditor
                        value={value || { id: 'root', type: 'group', logicType: 'OR', children: [] }}
                        onChange={onChange}
                        nodes={nodes}
                        edges={edges}
                        currentNodeId={nodeId}
                        readOnly={readOnly}
                    />
                );
            }
            const copy = getConditionPanelCopy(nodeType, field.label);
            const ruleCount = countConditionRules(value);
            const isActive = ruleCount > 0;
            const emptyStatus = isQuestionFlow ? "Always shown" : "Not configured";
            return (
                <div className="space-y-3">
                    <div className={cn(
                        "rounded-md border px-3 py-2 transition-colors",
                        isActive
                            ? "border-emerald-200/60 bg-emerald-50/50 dark:border-emerald-500/30 dark:bg-emerald-500/10"
                            : "border-border bg-muted/20"
                    )}>
                        <div className="flex items-center justify-between gap-2">
                            <p className={cn(
                                "flex min-w-0 items-center gap-1.5 text-xs font-semibold",
                                isActive ? "text-emerald-700 dark:text-emerald-300" : "text-foreground"
                            )}>
                                <IconFilter size={14} className="shrink-0" /> {copy.title}
                            </p>
                            <span className={cn(
                                "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
                                isActive ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"
                            )}>
                                {isActive ? ruleCount + (ruleCount === 1 ? " rule" : " rules") : emptyStatus}
                            </span>
                        </div>
                        <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
                            {copy.description}
                        </p>
                    </div>
                    <div className="rounded-lg border border-border bg-card p-2">
                        <ConditionBuilder
                            value={value || { field: '', operator: 'equals', value: '' }}
                            onChange={onChange}
                            nodes={nodes}
                            edges={edges}
                            currentNodeId={nodeId}
                            builderMode={nodeType === 'validation' ? 'validation' : 'default'}
                        />
                    </div>
                </div>
            );
        }
        case 'branchRoutes':
            return (
                <BranchRoutesBuilder
                    value={Array.isArray(value) ? value : []}
                    onChange={onChange}
                    nodes={nodes}
                    edges={edges}
                    nodeId={nodeId}
                    readOnly={readOnly}
                />
            );
        case 'stepBuilder':
            return (
                <StepsBuilder
                    value={value || []}
                    onChange={onChange}
                />
            );
        case 'text':
            return (
                <input
                    type="text"
                    disabled={readOnly}
                    value={value || ""}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-hidden focus:ring-1 focus:ring-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
            );
        case 'textarea':
            return (
                <textarea
                    disabled={readOnly}
                    value={value || ""}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={field.placeholder}
                    rows={3}
                    className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-hidden focus:ring-1 focus:ring-primary transition-all resize-y disabled:opacity-50 disabled:cursor-not-allowed"
                />
            );
        case 'fileTextarea':
            const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
                const file = e.target.files?.[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (event) => {
                    const text = event.target?.result as string;
                    if (text) {
                        const tokens = text.split(/[\n,]+/).map(t => t.trim()).filter(t => t.length > 0);
                        if (tokens.length > 0) {
                            const unique = Array.from(new Set(tokens)).join(', ');
                            onChange(unique);
                        }
                    }
                };
                reader.readAsText(file);
            };

            return (
                <div className="space-y-1">
                    <textarea
                        disabled={readOnly}
                        value={value || ""}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={field.placeholder}
                        rows={3}
                        className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-hidden focus:ring-1 focus:ring-primary transition-all resize-y disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    {!readOnly && (
                        <div className="flex justify-end">
                            <label className="text-xs flex items-center gap-1 cursor-pointer text-primary hover:underline bg-primary/5 px-2 py-1 rounded-md transition-colors">
                                <IconFolderPlus size={12} />
                                <span>Import from .txt</span>
                                <input type="file" accept=".txt,.csv" className="hidden" onChange={handleFileUpload} />
                            </label>
                        </div>
                    )}
                </div>
            );
        case 'file':
            const handleS3Upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
                const file = e.target.files?.[0];
                if (!file) return;

                try {
                    const res = await apiClient.post('/storage/upload-url', {
                        filename: file.name,
                        fileType: file.type
                    });

                    const { uploadUrl, key } = res.data;
                    const upload = await fetch(uploadUrl, {
                        method: 'PUT',
                        body: file,
                        headers: { 'Content-Type': file.type }
                    });
                    if (!upload.ok) throw new Error("Failed to upload file to S3");
                    // Save ONLY the storage key, not the public URL
                    onChange(key);
                } catch (err) {
                    console.error("Upload failed", err);
                    alert("Upload failed. Check console for details.");
                }
            };

            return (
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        disabled={readOnly}
                        value={value || ""}
                        onChange={(event) => onChange(event.target.value)}
                        placeholder={field.placeholder || "Storage key..."}
                        className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm transition-all focus:outline-hidden focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    {!readOnly && (
                        <label
                            title="Upload file"
                            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-input text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                            <IconUpload size={16} />
                            <span className="sr-only">Upload file</span>
                            <input type="file" className="hidden" onChange={handleS3Upload} />
                        </label>
                    )}
                </div>
            );
        case "files":
            const handleMultiUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
                const files = e.target.files;
                if (!files || files.length === 0) return;

                const uploadedKeys = [...(value || [])];

                // 1. Get Presigned URLs and upload each
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    try {
                        const res = await apiClient.post('/storage/upload-url', {
                            filename: file.name,
                            fileType: file.type
                        });

                        const { uploadUrl, key } = res.data;

                        await fetch(uploadUrl, {
                            method: 'PUT',
                            body: file,
                            headers: { 'Content-Type': file.type }
                        });

                        uploadedKeys.push(key);
                    } catch (err) {
                        console.error("Upload failed for file:", file.name, err);
                    }
                }
                onChange(uploadedKeys);
            };

            return (
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                        {(value || []).map((storageKey: string, idx: number) => (
                            <div key={idx} className="relative group aspect-square rounded-md overflow-hidden border border-border bg-muted">
                                <MediaPreview storageKey={storageKey} type="image" className="w-full h-full" />
                                {!readOnly && (
                                    <button
                                        title="Trash Icon"
                                        onClick={() => {
                                            const newFiles = value.filter((_: any, i: number) => i !== idx);
                                            onChange(newFiles);
                                        }}
                                        className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                    >
                                        <IconTrash size={12} />
                                    </button>
                                )}
                            </div>
                        ))}
                        {!readOnly && (
                            <label className="flex flex-col items-center justify-center aspect-square border-2 border-dashed border-border rounded-md cursor-pointer hover:bg-muted/50 hover:border-primary/50 transition-all text-muted-foreground hover:text-primary">
                                <IconPlus size={24} />
                                <span className="text-[10px] font-medium mt-1">Add Image</span>
                                <input type="file" multiple className="hidden" onChange={handleMultiUpload} accept="image/*" />
                            </label>
                        )}
                    </div>
                </div>
            );
        case 'number':
            return (
                <input
                    title="Number Input"
                    type="number"
                    disabled={readOnly}
                    value={value ?? ""}
                    onChange={(e) => onChange(Number(e.target.value))}
                    min={field.min}
                    max={field.max}
                    className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-hidden focus:ring-1 focus:ring-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
            );
        case "switch":
            return (
                <button
                    type="button"
                    title={field.label + ": " + (value ? "Enabled" : "Disabled")}
                    aria-label={field.label}
                    aria-pressed={Boolean(value)}
                    disabled={readOnly}
                    onClick={() => onChange(!value)}
                    className={cn(
                        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-hidden focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                        value ? "bg-primary" : "bg-input"
                    )}
                >
                    <span
                        className={cn(
                            "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
                            value ? "translate-x-5" : "translate-x-1"
                        )}
                    />
                </button>
            );
        case "options":
            if (nodeType === 'multiInput' && field.name === 'fields') {
                return (
                    <MultiInputFieldsBuilder
                        value={Array.isArray(value) ? value : []}
                        onChange={onChange}
                        readOnly={readOnly}
                        nodeId={nodeId}
                        qualityPreview={qualityPreview}
                    />
                );
            }
            const optionValues = Array.isArray(value) ? value : [];
            const isScaleItemsField = (nodeType === 'rating' || nodeType === 'slider') && field.name === 'items';
            const handleOptionImageUpload = async (index: number) => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = async (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (!file) return;

                    try {
                        const res = await apiClient.post('/storage/upload-url', {
                            filename: file.name,
                            fileType: file.type
                        });
                        const { uploadUrl, key } = res.data;

                        const upload = await fetch(uploadUrl, {
                            method: 'PUT',
                            body: file,
                            headers: { 'Content-Type': file.type }
                        });

                        if (!upload.ok) throw new Error("Failed to upload image");

                        const newOptions = [...optionValues];
                        newOptions[index] = { ...newOptions[index], imageUrl: key };
                        onChange(newOptions);
                    } catch (err) {
                        console.error("Upload failed", err);
                        alert("Upload failed. Please try again.");
                    }
                };
                input.click();
            };

            return (
                <div className="space-y-2">
                    {optionValues.map((option: any, index: number) => (
                        <div key={index} className="flex flex-col gap-1.5 rounded-md border border-border bg-muted/5 p-1.5 group">
                            <div className="flex gap-1 items-center">
                                <input
                                    type="text"
                                    disabled={readOnly}
                                    value={option.label}
                                    onChange={(e) => {
                                        const newOptions = [...optionValues];
                                        newOptions[index] = { ...newOptions[index], label: e.target.value };
                                        onChange(newOptions);
                                    }}
                                    className="flex-1 px-3 py-1.5 text-sm bg-background border border-input rounded-md focus:ring-1 focus:ring-primary outline-hidden disabled:opacity-50 disabled:cursor-not-allowed"
                                    placeholder={isScaleItemsField ? `Item ${index + 1}` : `Option ${index + 1}`}
                                />
                                {!readOnly && (
                                    <div className="flex items-center shrink-0">
                                        <button
                                            onClick={() => handleOptionImageUpload(index)}
                                            className={cn(
                                                "p-2 transition-colors rounded-md hover:bg-muted",
                                                option.imageUrl ? "text-primary" : "text-muted-foreground hover:text-primary"
                                            )}
                                            title={option.imageUrl ? "Change Image" : "Add Image"}
                                        >
                                            <IconPhoto size={16} />
                                        </button>
                                        <button
                                            onClick={() => {
                                                const newOptions = optionValues.filter((_: any, i: number) => i !== index);
                                                onChange(newOptions);
                                            }}
                                            className="p-2 text-muted-foreground hover:text-destructive transition-colors rounded-md hover:bg-muted"
                                            title="Delete Option"
                                        >
                                            <IconTrash size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {option.imageUrl && (
                                <div className="relative group/preview mx-1 mb-1">
                                    <MediaPreview
                                        storageKey={option.imageUrl}
                                        type="image"
                                        className="w-full h-24 rounded-md object-cover border border-border bg-white"
                                    />
                                    {!readOnly && (
                                        <button
                                            onClick={() => {
                                                const newOptions = [...optionValues];
                                                const updatedOption = { ...newOptions[index] };
                                                delete updatedOption.imageUrl;
                                                newOptions[index] = updatedOption;
                                                onChange(newOptions);
                                            }}
                                            className="absolute top-1 right-1 p-1.5 bg-destructive/90 text-white rounded-full opacity-0 group-hover/preview:opacity-100 transition-opacity shadow-sm hover:bg-destructive"
                                            title="Remove Image"
                                        >
                                            <IconTrash size={12} />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                    {!readOnly && (
                        (optionValues.length > 0) ? (
                            <button
                                onClick={() => onChange([
                                    ...optionValues,
                                    {
                                        label: isScaleItemsField ? `Item ${optionValues.length + 1}` : `Option ${optionValues.length + 1}`,
                                        value: isScaleItemsField ? `item${Date.now()}` : `opt${Date.now()}`
                                    }
                                ])}
                                className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/5"
                            >
                                <IconPlus size={14} />
                                {isScaleItemsField ? "Add item" : "Add option"}
                            </button>
                        ) : (
                            isScaleItemsField ? (
                                <button
                                    onClick={() => onChange([
                                        { label: 'Overall Rating', value: `item${Date.now()}_overall` },
                                        { label: 'Item 2', value: `item${Date.now()}_2` }
                                    ])}
                                    className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border px-3 py-3 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/50 hover:text-primary"
                                >
                                    <IconPlus size={14} />
                                    <span>Add rating items</span>
                                </button>
                            ) : (
                                <button
                                    onClick={() => onChange([{ label: 'Option 1', value: `opt${Date.now()}` }])}
                                    className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border px-3 py-3 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/50 hover:text-primary"
                                >
                                    <IconPlus size={14} />
                                    <span>Add first option</span>
                                </button>
                            )
                        )
                    )}
                </div>
            );
        case 'select':
            return (
                <div className="relative">
                    <select
                        title="Select Dropdown"
                        disabled={readOnly}
                        value={value || ""}
                        onChange={(e) => onChange(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-hidden focus:ring-1 focus:ring-primary transition-all appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {field.options?.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                    {/* Chevron icon for better UI */}
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                </div>
            );
        case 'emojiOptions':
            return (
                <EmojiPicker
                    value={value || []}
                    onChange={onChange}
                />
            );
        default:
            return <div className="text-xs text-destructive">Unsupported field type: {field.type}</div>;
    }
}
