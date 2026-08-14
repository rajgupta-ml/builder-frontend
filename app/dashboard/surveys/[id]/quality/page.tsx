"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    IconAlertCircle,
    IconCheck,
    IconChevronDown,
    IconChevronLeft,
    IconChevronRight,
    IconFilter,
    IconDownload,
    IconFlag,
    IconGauge,
    IconInfoCircle,
    IconRefresh,
    IconSettings,
    IconShieldLock,
    IconX,
} from "@tabler/icons-react";
import { surveyApi } from "@/api/survey";
import {
    surveyResponseApi,
    type QualityResponseDetail,
    type QualityResponseFlag,
    type QualityResponseListItem,
    type QualitySummary,
} from "@/api/surveyResponse";
import { getStoredUserScopes, hasPermission, PERMISSIONS } from "@/lib/permissions";
import { safeDateTime, safeIdShort } from "@/lib/safe-format";
import { toUserMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import type { Survey } from "@/src/shared/types/survey";
import { toast } from "sonner";
import { QualitySettingsModal } from "@/components/modals/QualitySettingsModal";
import { ModalPortal } from "@/components/ui/ModalPortal";
import { SurveyNavTabs } from "@/components/editor/SurveyNavTabs";

type QualityBadgeMeta = { label: string; description: string; badge: string };

const STATE_META: Record<string, { label: string; description: string; badge: string; dot: string }> = {
    CLEAN: {
        label: "Clean",
        description: "No quality issues detected on this response.",
        badge: "bg-emerald-50 text-emerald-600 border-emerald-200",
        dot: "bg-emerald-500",
    },
    NEEDS_REVIEW: {
        label: "Needs Review",
        description: "A quality finding needs a reviewer's decision.",
        badge: "bg-amber-50 text-amber-700 border-amber-200",
        dot: "bg-amber-500",
    },
    HIGH_RISK: {
        label: "High Risk",
        description: "A duplicate respondent, critical finding, or multiple check types indicate likely bad data.",
        badge: "bg-red-50 text-red-700 border-red-200",
        dot: "bg-red-600",
    },
    UNSCORED: {
        label: "Not Evaluated",
        description: "This response hasn't completed its quality checks yet.",
        badge: "bg-muted text-muted-foreground border-border",
        dot: "bg-slate-400",
    },
};

const REVIEW_META: Record<string, { label: string; description: string; badge: string }> = {
    UNREVIEWED: {
        label: "Awaiting Review",
        description: "No reviewer has looked at this response yet.",
        badge: "bg-muted text-muted-foreground border-border",
    },
    REVIEWED_VALID: {
        label: "Cleared",
        description: "A reviewer checked the flags and found the response legitimate.",
        badge: "bg-blue-50 text-blue-600 border-blue-200",
    },
    REVIEWED_CONFIRMED: {
        label: "Confirmed Bad",
        description: "A reviewer verified the flags — this response is genuinely low quality.",
        badge: "bg-violet-50 text-violet-600 border-violet-200",
    },
};

const PROCESSING_META: Record<string, QualityBadgeMeta> = {
    NOT_SCORABLE: {
        label: "Not Evaluated",
        description: "There is not enough completed response data to run quality checks yet.",
        badge: "bg-muted text-muted-foreground border-border",
    },
    PENDING: {
        label: "Checks Queued",
        description: "Quality checks are queued and have not finished for this response yet.",
        badge: "bg-sky-50 text-sky-600 border-sky-200",
    },
    PARTIAL: {
        label: "Checks Running",
        description: "Some async quality checks are still running for this response.",
        badge: "bg-amber-50 text-amber-600 border-amber-200",
    },
    COMPLETE: {
        label: "Checks Complete",
        description: "All recorded quality checks finished for this response.",
        badge: "bg-emerald-50 text-emerald-600 border-emerald-200",
    },
    FAILED: {
        label: "Checks Failed",
        description: "One or more quality checks failed and need retry or investigation.",
        badge: "bg-rose-50 text-rose-600 border-rose-200",
    },
};

const REVIEW_CHOICES: { value: string; label: string; description: string }[] = [
    {
        value: "REVIEWED_VALID",
        label: "Dismiss flags / mark clean",
        description: "The flags are false alarms or acceptable for this study.",
    },
    {
        value: "REVIEWED_CONFIRMED",
        label: "Confirm issue",
        description: "The flags are correct and this response should be treated as low quality.",
    },
    {
        value: "UNREVIEWED",
        label: "Reset to unreviewed",
        description: "Undo the previous decision and put it back in the review queue.",
    },
];

const REASON_META: Record<string, string> = {
    FALSE_POSITIVE: "False positive — the detector was wrong",
    VALID_EXCEPTION: "Valid exception — unusual but legitimate",
    CONFIRMED_DUPLICATE: "Confirmed duplicate submission",
    CONFIRMED_LOW_QUALITY: "Confirmed low-quality answers",
    PANEL_RECONCILED: "Reconciled with the panel provider",
    OTHER_SANITIZED: "Other reason (see note)",
};

const DETECTOR_META: Record<string, { label: string; description: string }> = {
    SURVEY_SPEEDER: {
        label: "Survey Speeding",
        description: "Finished the whole survey faster than the minimum expected time.",
    },
    QUESTION_SPEEDER: {
        label: "Question Speeding",
        description: "Answered individual questions too quickly to have read them.",
    },
    STRAIGHT_LINE_BEHAVIOR: {
        label: "Straight-lining",
        description: "Picked the same answer position down a grid of questions.",
    },
    DUPLICATE_PID: {
        label: "Duplicate Panelist",
        description: "The same panelist ID submitted more than one response.",
    },
    DUPLICATE_DEVICE: {
        label: "Duplicate Device",
        description: "The same device fingerprint submitted more than one response.",
    },
    TOO_SHORT_OE: {
        label: "Too short answer",
        description: "An open-ended answer is too short to be useful.",
    },
    KEYBOARD_MASH_OE: {
        label: "Keyboard mash",
        description: "An open-ended answer looks like random typing or repeated keys.",
    },
    GIBBERISH_OE: {
        label: "Gibberish / random text",
        description: "The AI judge found an open-ended answer that does not read as meaningful text.",
    },
    DUPLICATE_OE_WITHIN_SESSION: {
        label: "Repeated open-end answer",
        description: "The same open-ended answer was reused across questions in this response.",
    },
    LANGUAGE_MISMATCH: {
        label: "Wrong language",
        description: "The open-ended answer appears to be in a different language than expected.",
    },
    SEMANTIC_IRRELEVANCE: {
        label: "Off-topic / non-answer",
        description: "The AI judge found that the answer does not directly answer the question or is off-topic.",
    },
    AI_GENERATED_TEXT: {
        label: "Possible AI-written answer",
        description: "The AI judge found signs that an open-ended answer may be generated text.",
    },
};

const SEVERITY_TONE: Record<string, string> = {
    LOW: "bg-muted text-muted-foreground border-border",
    MEDIUM: "bg-amber-50 text-amber-600 border-amber-200",
    HIGH: "bg-rose-50 text-rose-600 border-rose-200",
    CRITICAL: "bg-red-50 text-red-700 border-red-200",
};

const OPEN_END_DETECTOR_CODES = new Set([
    "TOO_SHORT_OE",
    "KEYBOARD_MASH_OE",
    "GIBBERISH_OE",
    "DUPLICATE_OE_WITHIN_SESSION",
    "LANGUAGE_MISMATCH",
    "SEMANTIC_IRRELEVANCE",
    "AI_GENERATED_TEXT",
]);

const emptySummary: QualitySummary = {
    totalResponses: 0,
    stateCounts: {},
    detectorCounts: {},
    detectorReviewMetrics: {},
};

const stateMeta = (state?: string | null) => STATE_META[state || "UNSCORED"] || STATE_META.UNSCORED!;
const reviewMeta = (status?: string | null) => REVIEW_META[status || "UNREVIEWED"] || REVIEW_META.UNREVIEWED!;
const processingMeta = (status?: string | null) => PROCESSING_META[status || "PENDING"] || PROCESSING_META.PENDING!;
const detectorMeta = (code: string) =>
    DETECTOR_META[code] || { label: titleCase(code), description: "Automated quality check." };

function titleCase(value: string) {
    return value
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

const formatPercent = (value: number, total: number) => {
    if (total <= 0) return "0%";
    return `${((value / total) * 100).toFixed(1)}%`;
};

const formatOpenEndAnswerCount = (count: number) => `${count} open-ended answer${count === 1 ? "" : "s"}`;

const truncateText = (value: string, maxLength = 180) => {
    if (value.length <= maxLength) return value;
    return `${value.slice(0, maxLength - 1)}…`;
};

type OpenEndFlagEvidence = {
    questionId?: string | null;
    subQuestionId?: string | null;
    questionLabel?: string | null;
    answerPreview?: string | null;
    detectorFamily?: string | null;
    detectorModel?: string | null;
    issueLabel?: string | null;
    issueDetail?: string | null;
    reasonCodes?: string[] | null;
    confidence?: number | null;
    metadata?: Record<string, unknown> | null;
    verdict?: string | null;
    answerIntent?: string | null;
    expectedAnswerShape?: string | null;
};

type OpenEndReviewItem = {
    key: string;
    label: string;
    issue: string;
};

type FlagDecisionCopy = {
    label: string;
    why: string;
    action: string;
};

type DrawerDecisionSummary = {
    title: string;
    description: string;
    className: string;
};

type FlagDisplayGroup = {
    key: string;
    flags: QualityResponseFlag[];
    primaryFlag: QualityResponseFlag;
    primaryEvidence: OpenEndFlagEvidence | null;
    primaryCopy: FlagDecisionCopy;
    issueCopies: FlagDecisionCopy[];
    questionLabels: string[];
    answerPreview: string | null;
    severity: string;
    isOpenEnd: boolean;
};

const asObject = (value: unknown): Record<string, unknown> | null => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
};

const asString = (value: unknown): string | null =>
    typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const asNumber = (value: unknown): number | null =>
    typeof value === "number" && Number.isFinite(value) ? value : null;

const asStringArray = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];

const normalizeReasonCodes = (codes?: string[] | null) =>
    new Set((codes || []).map((code) => code.trim().toUpperCase()).filter(Boolean));

const hasReasonCode = (codes: Set<string>, values: string[]) =>
    values.some((value) => codes.has(value));

const formatWordCharacterCount = (wordCount: number | null, characterCount: number | null) => {
    const parts: string[] = [];
    if (wordCount !== null) parts.push(`${wordCount} word${wordCount === 1 ? "" : "s"}`);
    if (characterCount !== null) parts.push(`${characterCount} character${characterCount === 1 ? "" : "s"}`);
    return parts.join(" / ");
};

const formatOpenEndExpectation = (evidence: OpenEndFlagEvidence | null) => {
    if (!evidence) return "a useful answer";
    const intent = evidence.answerIntent ? titleCase(evidence.answerIntent) : null;
    const shape = evidence.expectedAnswerShape ? titleCase(evidence.expectedAnswerShape) : null;
    if (intent && shape) return `${intent} answer in ${shape.toLowerCase()} form`;
    if (intent) return `${intent} answer`;
    if (shape) return `${shape} answer`;
    return "a useful answer";
};

const getOpenEndFlagDecisionCopy = (flag: QualityResponseFlag, evidence: OpenEndFlagEvidence): FlagDecisionCopy => {
    const reasonCodes = normalizeReasonCodes(evidence.reasonCodes);
    const metadata = evidence.metadata;
    const observed = formatWordCharacterCount(
        asNumber(metadata?.observedWordCount),
        asNumber(metadata?.observedCharacterCount)
    );
    const threshold = formatWordCharacterCount(
        asNumber(metadata?.thresholdWordCount),
        asNumber(metadata?.thresholdCharacterCount)
    );
    const expected = formatOpenEndExpectation(evidence);

    if (flag.detectorCode === "TOO_SHORT_OE") {
        return {
            label: "Too short for this question",
            why: threshold && observed
                ? `Expected ${expected}, but the answer has only ${observed}; minimum is ${threshold}.`
                : `Expected ${expected}, but the answer is too short to be useful.`,
            action: "Confirm if short answers should not count here; dismiss if this field intentionally accepts tiny answers.",
        };
    }

    if (flag.detectorCode === "KEYBOARD_MASH_OE" || flag.detectorCode === "GIBBERISH_OE") {
        return {
            label: "Gibberish / random text",
            why: "The answer reads like random or meaningless text rather than a real response.",
            action: "Confirm unless there is a clear study-specific reason this answer should be accepted.",
        };
    }

    if (flag.detectorCode === "DUPLICATE_OE_WITHIN_SESSION") {
        return {
            label: "Repeated answer",
            why: "The respondent reused the same open-ended answer across multiple questions.",
            action: "Confirm if the repeated answer does not genuinely answer each question.",
        };
    }

    if (flag.detectorCode === "LANGUAGE_MISMATCH") {
        const detectedLanguage = asString(metadata?.detectedLanguage);
        return {
            label: "Wrong language",
            why: detectedLanguage
                ? `The answer appears to be in ${detectedLanguage}, which does not match the expected survey language.`
                : "The answer appears to be in a different language than expected.",
            action: "Confirm if this response cannot be reviewed reliably in the expected language.",
        };
    }

    if (flag.detectorCode === "AI_GENERATED_TEXT") {
        return {
            label: "Possible AI-written answer",
            why: "The answer has patterns that look machine-written rather than a respondent's own wording.",
            action: "Confirm only if the writing style conflicts with your study rules.",
        };
    }

    if (flag.detectorCode === "SEMANTIC_IRRELEVANCE") {
        if (hasReasonCode(reasonCodes, ["GIBBERISH", "NONSENSE", "NONSENSE_TEXT", "CHARACTER_SALAD", "RANDOM_KEYSTROKES"])) {
            return {
                label: "Gibberish / random text",
                why: `Expected ${expected}, but the answer does not read as meaningful text.`,
                action: "Confirm unless the answer has a clear meaning in your study context.",
            };
        }
        if (hasReasonCode(reasonCodes, ["REFUSAL", "EVASIVE", "EVASIVE_RESPONSE", "DOES_NOT_ANSWER", "DOES_NOT_ANSWER_QUESTION", "NON_ANSWER"])) {
            return {
                label: "Refusal / non-answer",
                why: `Expected ${expected}, but the respondent avoided answering the question.`,
                action: "Confirm if this answer should not be counted as usable data.",
            };
        }
        if (hasReasonCode(reasonCodes, ["LOW_RELEVANCE", "LOW_SPECIFICITY", "WEAK_ANSWER", "WEAK_RESPONSE"])) {
            return {
                label: "Weak or vague answer",
                why: `Expected ${expected}, but the answer is too vague to explain the respondent's view.`,
                action: "Dismiss if this level of detail is acceptable; confirm if the study needs a real explanation.",
            };
        }
        if (hasReasonCode(reasonCodes, ["OFF_TOPIC", "UNRELATED", "UNRELATED_TOPIC"])) {
            return {
                label: "Off-topic answer",
                why: `Expected ${expected}, but the answer talks about something unrelated to the question.`,
                action: "Confirm if the answer does not help answer the research question.",
            };
        }
        return {
            label: "Does not answer the question",
            why: evidence.issueDetail || `Expected ${expected}, but the answer does not clearly address the question.`,
            action: "Confirm if the answer is unusable; dismiss if it is acceptable after human review.",
        };
    }

    return {
        label: detectorMeta(flag.detectorCode).label,
        why: evidence.issueDetail || formatEvidenceSummary(flag),
        action: "Confirm if this finding makes the response unusable; dismiss it if it is acceptable.",
    };
};

const getPlainFlagDecisionCopy = (flag: QualityResponseFlag): FlagDecisionCopy => ({
    label: detectorMeta(flag.detectorCode).label,
    why: formatEvidenceSummary(flag),
    action: "Confirm if this finding makes the response unusable; dismiss it if it is acceptable.",
});

const getResponseDecisionSummary = (
    detail: QualityResponseDetail | null,
    activeFlags: QualityResponseFlag[],
    flagGroups: FlagDisplayGroup[]
): DrawerDecisionSummary => {
    if (!detail) {
        return {
            title: "Loading response",
            description: "Fetching the response quality decision.",
            className: "border-border/60 bg-muted/20 text-muted-foreground",
        };
    }

    if (activeFlags.length === 0) {
        return {
            title: "No action needed",
            description: "No active quality flags are attached to this response.",
            className: "border-emerald-200 bg-emerald-50 text-emerald-700",
        };
    }

    const issueLabels = flagGroups.flatMap((group) => group.issueCopies.map((copy) => copy.label));
    const uniqueIssues = Array.from(new Set(issueLabels));
    const issueSummary = uniqueIssues.slice(0, 3).join(", ");
    const extraCount = uniqueIssues.length > 3 ? `, +${uniqueIssues.length - 3} more` : "";
    const state = stateMeta(detail.qualityState);
    const seriousCount = activeFlags.filter((flag) => ["HIGH", "CRITICAL"].includes(flag.severity)).length;
    const action = seriousCount > 0
        ? "Review affected answers before accepting this response into analysis."
        : "Quick human review is enough; these are low-risk warnings.";
    const groupedLabel = flagGroups.length === activeFlags.length
        ? `${activeFlags.length} active flag${activeFlags.length === 1 ? "" : "s"}`
        : `${flagGroups.length} review item${flagGroups.length === 1 ? "" : "s"} from ${activeFlags.length} detector signals`;

    return {
        title: `${state.label}: ${groupedLabel}`,
        description: `Main concern${uniqueIssues.length === 1 ? "" : "s"}: ${issueSummary}${extraCount}. ${action}`,
        className: seriousCount > 0
            ? "border-rose-200 bg-rose-50 text-rose-700"
            : "border-amber-200 bg-amber-50 text-amber-700",
    };
};

const getOpenEndEvidence = (flag: QualityResponseFlag): OpenEndFlagEvidence | null => {
    if (!OPEN_END_DETECTOR_CODES.has(flag.detectorCode)) return null;
    const evidence = asObject(flag.evidence);
    if (!evidence) return null;
    const metadata = asObject(evidence.metadata);
    return {
        questionId: asString(evidence.questionId),
        subQuestionId: asString(evidence.subQuestionId),
        questionLabel: asString(evidence.questionLabel),
        answerPreview: asString(evidence.answerPreview),
        detectorFamily: asString(evidence.detectorFamily),
        detectorModel: asString(evidence.detectorModel),
        issueLabel: asString(evidence.issueLabel),
        issueDetail: asString(evidence.issueDetail),
        reasonCodes: asStringArray(evidence.reasonCodes),
        confidence: asNumber(evidence.confidence),
        verdict: asString(metadata?.verdict),
        answerIntent: asString(metadata?.answerIntent),
        expectedAnswerShape: asString(metadata?.expectedAnswerShape),
        metadata,
    };
};

const SEVERITY_RANK: Record<string, number> = {
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
    CRITICAL: 4,
};

const DETECTOR_DISPLAY_PRIORITY: Record<string, number> = {
    GIBBERISH_OE: 100,
    KEYBOARD_MASH_OE: 95,
    SEMANTIC_IRRELEVANCE: 90,
    LANGUAGE_MISMATCH: 80,
    AI_GENERATED_TEXT: 70,
    DUPLICATE_OE_WITHIN_SESSION: 60,
    TOO_SHORT_OE: 50,
};

const getHighestSeverity = (flags: QualityResponseFlag[]) => {
    return flags.reduce((highest, flag) => (
        (SEVERITY_RANK[flag.severity] || 0) > (SEVERITY_RANK[highest] || 0) ? flag.severity : highest
    ), flags[0]?.severity || "LOW");
};

const getFlagDisplayPriority = (flag: QualityResponseFlag) => (
    ((DETECTOR_DISPLAY_PRIORITY[flag.detectorCode] || 10) * 1000)
    + ((SEVERITY_RANK[flag.severity] || 0) * 100)
);

const getOpenEndGroupKey = (flag: QualityResponseFlag, evidence: OpenEndFlagEvidence) => {
    if (evidence.questionId) {
        return `open-end:${evidence.questionId}:${evidence.subQuestionId || ""}`;
    }
    if (flag.scopeKey.startsWith("question:")) {
        return `open-end:${flag.scopeKey}`;
    }
    const questionLabels = asStringArray(evidence.metadata?.questionLabels);
    const labelPart = questionLabels.length > 0 ? questionLabels.join("|") : (evidence.questionLabel || "open-ended-answer");
    return `open-end:${labelPart}:${evidence.answerPreview || flag.scopeKey}`;
};

const uniqueDecisionCopies = (copies: FlagDecisionCopy[]) => {
    const seen = new Set<string>();
    return copies.filter((copy) => {
        const key = copy.label;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

const getFlagDisplayGroups = (flags: QualityResponseFlag[]): FlagDisplayGroup[] => {
    const grouped = new Map<string, Array<{ flag: QualityResponseFlag; evidence: OpenEndFlagEvidence | null; index: number }>>();

    flags.forEach((flag, index) => {
        const evidence = getOpenEndEvidence(flag);
        const key = evidence ? getOpenEndGroupKey(flag, evidence) : `flag:${flag.id}`;
        const current = grouped.get(key) || [];
        current.push({ flag, evidence, index });
        grouped.set(key, current);
    });

    return Array.from(grouped.entries()).map(([key, items]) => {
        const sortedItems = [...items].sort((a, b) => {
            const priorityDelta = getFlagDisplayPriority(b.flag) - getFlagDisplayPriority(a.flag);
            return priorityDelta !== 0 ? priorityDelta : a.index - b.index;
        });
        const primary = sortedItems[0]!;
        const sortedFlags = sortedItems.map((item) => item.flag);
        const issueCopies = uniqueDecisionCopies(sortedItems.map((item) => (
            item.evidence ? getOpenEndFlagDecisionCopy(item.flag, item.evidence) : getPlainFlagDecisionCopy(item.flag)
        )));
        const openEndEvidenceItems = sortedItems.filter((item): item is { flag: QualityResponseFlag; evidence: OpenEndFlagEvidence; index: number } => Boolean(item.evidence));
        const firstEvidence = openEndEvidenceItems[0]?.evidence || null;
        const questionLabels = Array.from(new Set(openEndEvidenceItems.flatMap((item) => {
            const labels = asStringArray(item.evidence.metadata?.questionLabels);
            if (labels.length > 0) return labels;
            return [item.evidence.questionLabel || item.evidence.questionId || "Open-ended answer"];
        })));
        const answerPreview = firstEvidence?.answerPreview || null;

        return {
            key,
            flags: sortedFlags,
            primaryFlag: primary.flag,
            primaryEvidence: primary.evidence,
            primaryCopy: issueCopies[0] || getPlainFlagDecisionCopy(primary.flag),
            issueCopies,
            questionLabels,
            answerPreview,
            severity: getHighestSeverity(sortedFlags),
            isOpenEnd: openEndEvidenceItems.length > 0,
        };
    }).sort((a, b) => {
        const severityDelta = (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0);
        if (severityDelta !== 0) return severityDelta;
        return flags.findIndex((flag) => flag.id === a.flags[0]?.id) - flags.findIndex((flag) => flag.id === b.flags[0]?.id);
    });
};

const getFlagGroupHeading = (groups: FlagDisplayGroup[], flags: QualityResponseFlag[]) => {
    if (flags.length === 0) return "Quality flags";
    if (groups.length === flags.length) return `Quality flags (${flags.length})`;
    return `Quality issues (${groups.length} review item${groups.length === 1 ? "" : "s"}, ${flags.length} signals)`;
};

const getGroupSuggestedAction = (group: FlagDisplayGroup) => {
    if (group.flags.length <= 1) return group.primaryCopy.action;
    return "Review this answer as one unit. Confirm if these findings make it unusable; dismiss them if it is acceptable in context.";
};

const getOpenEndQuestionCount = (flags: QualityResponseFlag[]) => {
    const questionKeys = new Set<string>();
    for (const flag of flags) {
        const evidence = getOpenEndEvidence(flag);
        const metadata = evidence?.metadata;
        const questionLabels = asStringArray(metadata?.questionLabels);
        if (questionLabels.length > 0) {
            questionLabels.forEach((label) => questionKeys.add(label));
            continue;
        }
        const questionLabel = evidence?.questionLabel || evidence?.questionId;
        if (questionLabel) questionKeys.add(questionLabel);
    }
    return questionKeys.size || flags.length;
};

const getOpenEndReviewItems = (flags: QualityResponseFlag[]): OpenEndReviewItem[] => {
    return flags.flatMap((flag) => {
        const evidence = getOpenEndEvidence(flag);
        const issue = evidence?.issueLabel || detectorMeta(flag.detectorCode).label;
        const metadata = evidence?.metadata;
        const questionLabels = asStringArray(metadata?.questionLabels);
        if (questionLabels.length > 0) {
            return questionLabels.map((label, index) => ({
                key: `${flag.id}-${index}`,
                label,
                issue,
            }));
        }
        return [{
            key: flag.id,
            label: evidence?.questionLabel || evidence?.questionId || "Open-ended answer",
            issue,
        }];
    });
};

const formatEvidenceSummary = (flag: QualityResponseFlag) => {
    const evidence = flag.evidence;
    if (evidence && typeof evidence.summary === "string" && evidence.summary.trim().length > 0) {
        return evidence.summary;
    }
    return detectorMeta(flag.detectorCode).description;
};

const getActiveFlags = (detail: QualityResponseDetail | null) =>
    (detail?.qualityFlags || []).filter((flag) => flag.isActive);

const getOpenEndFlags = (detail: QualityResponseDetail | null) =>
    getActiveFlags(detail).filter((flag) => OPEN_END_DETECTOR_CODES.has(flag.detectorCode));

const getOpenEndCheckMeta = (detail: QualityResponseDetail | null): QualityBadgeMeta & { detail?: string | null; updatedAt?: string | null; attemptCount?: number | null } => {
    if (!detail) {
        return {
            label: "Loading",
            description: "Loading open-ended quality status.",
            badge: "bg-muted text-muted-foreground border-border",
        };
    }

    if (!detail.openEndQuality) {
        return {
            label: "Unavailable",
            description: "Open-ended check status is not available from the API response yet.",
            badge: "bg-slate-50 text-slate-600 border-slate-200",
        };
    }

    const answerCount = detail.openEndQuality.answerCount;
    const eligibleAnswerCount = detail.openEndQuality.eligibleAnswerCount ?? answerCount;
    const aiEligibleAnswerCount = detail.openEndQuality.aiEligibleAnswerCount ?? eligibleAnswerCount;
    const checkedAnswerCount = detail.openEndQuality.checkedAnswerCount ?? 0;
    const answerLabel = formatOpenEndAnswerCount(answerCount);
    const eligibleAnswerLabel = formatOpenEndAnswerCount(eligibleAnswerCount);
    const aiEligibleAnswerLabel = formatOpenEndAnswerCount(aiEligibleAnswerCount);
    const checkedAnswerLabel = formatOpenEndAnswerCount(checkedAnswerCount || aiEligibleAnswerCount);
    const operation = detail.openEndQuality.aiJudgeOperation;
    const openEndFlags = getOpenEndFlags(detail);

    if (answerCount <= 0) {
        return {
            label: "No Open Text",
            description: "No open-ended answers were stored for this response.",
            badge: "bg-muted text-muted-foreground border-border",
        };
    }

    if (operation?.status === "FAILED") {
        return {
            label: "Failed",
            description: `AI text checks failed for ${aiEligibleAnswerLabel}.`,
            badge: "bg-rose-50 text-rose-600 border-rose-200",
            detail: operation.errorDetail || operation.errorCode,
            updatedAt: operation.updatedAt,
            attemptCount: operation.attemptCount,
        };
    }

    if (operation?.status === "QUEUED" || operation?.status === "PROCESSING") {
        return {
            label: operation.status === "QUEUED" ? "Queued" : "Running",
            description: `AI text checks are ${operation.status === "QUEUED" ? "queued" : "running"} for ${aiEligibleAnswerLabel}.`,
            badge: "bg-amber-50 text-amber-600 border-amber-200",
            updatedAt: operation.updatedAt,
            attemptCount: operation.attemptCount,
        };
    }

    if (operation?.status === "SUCCEEDED") {
        const questionCount = getOpenEndQuestionCount(openEndFlags);
        return {
            label: openEndFlags.length > 0 ? "Issues Found" : "Complete",
            description: openEndFlags.length > 0
                ? `${questionCount} open-ended answer${questionCount === 1 ? "" : "s"} need review.`
                : `AI text checks finished for ${checkedAnswerLabel} with no open-ended issues.${answerCount > aiEligibleAnswerCount ? ` ${answerCount - aiEligibleAnswerCount} skipped by node quality settings.` : ""}`,
            badge: openEndFlags.length > 0
                ? "bg-rose-50 text-rose-600 border-rose-200"
                : "bg-emerald-50 text-emerald-600 border-emerald-200",
            updatedAt: operation.completedAt || operation.updatedAt,
            attemptCount: operation.attemptCount,
        };
    }

    if (openEndFlags.length > 0) {
        const questionCount = getOpenEndQuestionCount(openEndFlags);
        return {
            label: "Issues Found",
            description: `${questionCount} open-ended answer${questionCount === 1 ? "" : "s"} need review.`,
            badge: "bg-rose-50 text-rose-600 border-rose-200",
        };
    }

    if (detail.qualityProcessingStatus === "PENDING" || detail.qualityProcessingStatus === "PARTIAL") {
        return {
            label: "Pending",
            description: `Open-ended checks are not finished for ${eligibleAnswerLabel}.`,
            badge: "bg-amber-50 text-amber-600 border-amber-200",
        };
    }

    if (detail.qualityProcessingStatus === "FAILED") {
        return {
            label: "Blocked",
            description: "Overall quality processing failed before open-ended AI checks completed.",
            badge: "bg-rose-50 text-rose-600 border-rose-200",
        };
    }

    return {
        label: "Not Scheduled",
        description: aiEligibleAnswerCount > 0
            ? `Open-ended answers exist (${aiEligibleAnswerLabel}), but no AI judge job is recorded for this response.`
            : answerCount > 0
                ? `Open-ended answers exist (${answerLabel}), but none were eligible for AI checks under the node quality settings.`
                : `Open-ended answers exist (${answerLabel}), but no AI judge job is recorded for this response.`,
        badge: "bg-slate-50 text-slate-600 border-slate-200",
    };
};

const getNoActiveFlagsMessage = (
    detail: QualityResponseDetail,
    openEndMeta: QualityBadgeMeta,
) => {
    if (detail.qualityProcessingStatus === "FAILED") {
        return "No active flags are available from the failed run. Check automated status above.";
    }

    if (detail.qualityProcessingStatus === "PENDING" || detail.qualityProcessingStatus === "PARTIAL") {
        return "No active flags yet — some checks are still running.";
    }

    if (openEndMeta.label === "Unavailable") {
        return "No active flags from completed checks. Open-ended check status is not available from the API yet.";
    }

    if (openEndMeta.label === "Not Scheduled") {
        return "No active flags from completed checks. Open-ended AI checks were not scheduled for this response.";
    }

    if (openEndMeta.label === "Failed" || openEndMeta.label === "Blocked") {
        return "No active flags from completed checks. Open-ended AI checks need attention.";
    }

    return "No active flags — this response passed all completed checks.";
};

export default function SurveyQualityPage() {
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const [survey, setSurvey] = useState<Survey | null>(null);
    const [summary, setSummary] = useState<QualitySummary>(emptySummary);
    const [responses, setResponses] = useState<QualityResponseListItem[]>([]);
    const [selectedResponseId, setSelectedResponseId] = useState<string | null>(null);
    const [selectedDetail, setSelectedDetail] = useState<QualityResponseDetail | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [listLoading, setListLoading] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [savingReview, setSavingReview] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<"LIVE" | "TEST">("LIVE");
    const [qualityState, setQualityState] = useState<string>("ALL");
    const [reviewStatusFilter, setReviewStatusFilter] = useState<string>("ALL");
    const [currentPage, setCurrentPage] = useState(1);
    const [meta, setMeta] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
    const [reviewStatus, setReviewStatus] = useState("REVIEWED_VALID");
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isExportOpen, setIsExportOpen] = useState(false);
    const [isReviewOpen, setIsReviewOpen] = useState(false);
    const [reviewReasonCode, setReviewReasonCode] = useState("");
    const [reviewNote, setReviewNote] = useState("");
    const [reviewedFlagIds, setReviewedFlagIds] = useState<string[]>([]);
    const [userScopes, setUserScopes] = useState<string[]>([]);
    const [roleHydrated, setRoleHydrated] = useState(false);

    useEffect(() => {
        setUserScopes(getStoredUserScopes());
        setRoleHydrated(true);
    }, []);

    const canReadQuality = hasPermission(userScopes, PERMISSIONS.SURVEY_QUALITY_READ);
    const canReviewQuality = hasPermission(userScopes, PERMISSIONS.SURVEY_QUALITY_REVIEW);
    const canConfigureQuality = hasPermission(userScopes, PERMISSIONS.SURVEY_QUALITY_CONFIGURE);
    const canExportQuality = hasPermission(userScopes, PERMISSIONS.SURVEY_QUALITY_EXPORT);
    const canExportDetailedQuality = hasPermission(userScopes, PERMISSIONS.SURVEY_QUALITY_EXPORT_DETAILED);

    const openResponse = (responseId: string) => {
        setSelectedResponseId(responseId);
        setIsDrawerOpen(true);
    };

    const closeDrawer = () => {
        setIsDrawerOpen(false);
    };

    useEffect(() => {
        if (!isDrawerOpen) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") closeDrawer();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [isDrawerOpen]);

    const loadSummary = async (mode: "LIVE" | "TEST") => {
        const nextSummary = await surveyResponseApi.getQualitySummary(id, mode);
        setSummary(nextSummary);
    };

    const loadResponses = async (mode: "LIVE" | "TEST", page = 1) => {
        setListLoading(true);
        try {
            const result = await surveyResponseApi.getQualityResponses(id, {
                mode,
                page,
                limit: 25,
                state: qualityState !== "ALL" ? qualityState : undefined,
                reviewStatus: reviewStatusFilter !== "ALL" ? reviewStatusFilter : undefined,
            });
            setResponses(result.data);
            setMeta(result.meta);
        } finally {
            setListLoading(false);
        }
    };

    const loadDetail = async (responseId: string) => {
        setDetailLoading(true);
        try {
            const detail = await surveyResponseApi.getQualityResponseDetail(id, responseId);
            setSelectedDetail(detail);
            const currentStatus = detail.qualityReviewStatus || "UNREVIEWED";
            setReviewStatus(currentStatus === "UNREVIEWED" ? "REVIEWED_VALID" : currentStatus);
            setReviewReasonCode(detail.qualityReviewReasonCode || "");
            setReviewNote("");
            setReviewedFlagIds(getActiveFlags(detail).map((flag) => flag.id));
            setIsReviewOpen(false);
        } finally {
            setDetailLoading(false);
        }
    };

    useEffect(() => {
        if (!id || !canReadQuality) return;
        let cancelled = false;
        setLoading(true);
        setFetchError(null);
        Promise.all([
            surveyApi.getSurvey(id),
            surveyResponseApi.getQualitySummary(id, viewMode),
            surveyResponseApi.getQualityResponses(id, {
                mode: viewMode,
                page: currentPage,
                limit: 25,
                state: qualityState !== "ALL" ? qualityState : undefined,
                reviewStatus: reviewStatusFilter !== "ALL" ? reviewStatusFilter : undefined,
            }),
        ]).then(([surveyData, summaryData, listData]) => {
            if (cancelled) return;
            setSurvey(surveyData);
            setSummary(summaryData);
            setResponses(listData.data);
            setMeta(listData.meta);
            setLoading(false);
        }).catch((error) => {
            if (cancelled) return;
            const message = toUserMessage(error, "Failed to load quality data");
            setFetchError(message);
            setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [id, canReadQuality, viewMode, currentPage, qualityState, reviewStatusFilter]);

    useEffect(() => {
        if (!selectedResponseId || !isDrawerOpen || !canReadQuality) return;
        void loadDetail(selectedResponseId).catch((error) => {
            setSelectedDetail(null);
            toast.error(toUserMessage(error, "Failed to load response quality detail"));
        });
    }, [selectedResponseId, isDrawerOpen, canReadQuality, id]);

    const detectorRows = useMemo(() => {
        return Object.entries(summary.detectorCounts)
            .map(([detectorCode, count]) => ({
                detectorCode,
                count,
                metrics: summary.detectorReviewMetrics[detectorCode] || {
                    activeCount: count,
                    reviewedValidCount: 0,
                    reviewedConfirmedCount: 0,
                },
            }))
            .sort((a, b) => b.count - a.count);
    }, [summary]);

    const maxDetectorCount = useMemo(
        () => detectorRows.reduce((max, row) => Math.max(max, row.count), 0),
        [detectorRows]
    );

    const activeFlags = useMemo(() => getActiveFlags(selectedDetail), [selectedDetail]);
    const flagGroups = useMemo(() => getFlagDisplayGroups(activeFlags), [activeFlags]);
    const openEndFlags = useMemo(() => getOpenEndFlags(selectedDetail), [selectedDetail]);
    const openEndReviewItems = useMemo(() => getOpenEndReviewItems(openEndFlags), [openEndFlags]);
    const drawerDecisionSummary = useMemo(() => getResponseDecisionSummary(selectedDetail, activeFlags, flagGroups), [selectedDetail, activeFlags, flagGroups]);
    const drawerProcessingMeta = processingMeta(selectedDetail?.qualityProcessingStatus);
    const openEndCheckMeta = getOpenEndCheckMeta(selectedDetail);

    const needsReviewCount = summary.stateCounts.NEEDS_REVIEW || 0;

    const refreshAll = async (page = currentPage, keepDetail = isDrawerOpen ? selectedResponseId : null) => {
        await Promise.all([
            loadSummary(viewMode),
            loadResponses(viewMode, page),
        ]);
        if (keepDetail) {
            await loadDetail(keepDetail);
        }
    };

    const toggleReviewedFlagGroup = (flagIds: string[]) => {
        setReviewedFlagIds((current) => {
            const allSelected = flagIds.every((flagId) => current.includes(flagId));
            if (allSelected) return current.filter((value) => !flagIds.includes(value));
            return Array.from(new Set([...current, ...flagIds]));
        });
    };

    const submitReview = async () => {
        if (!selectedDetail) return;
        if (reviewStatus !== "UNREVIEWED" && activeFlags.length > 1 && reviewedFlagIds.length === 0) {
            toast.error("Select at least one flag this decision applies to.");
            return;
        }
        setSavingReview(true);
        try {
            await surveyResponseApi.reviewQualityResponse(id, selectedDetail.id, {
                reviewStatus,
                reasonCode: reviewStatus === "UNREVIEWED" ? undefined : (reviewReasonCode || undefined),
                note: reviewStatus === "UNREVIEWED" ? undefined : (reviewNote.trim() || undefined),
                reviewedFlagIds: reviewStatus === "UNREVIEWED"
                    ? activeFlags.map((flag) => flag.id)
                    : (activeFlags.length > 1 ? reviewedFlagIds : undefined),
            });
            toast.success("Review saved.");
            await refreshAll(currentPage, selectedDetail.id);
        } catch (error) {
            toast.error(toUserMessage(error, "Failed to save review"));
        } finally {
            setSavingReview(false);
        }
    };

    if (!roleHydrated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-muted-foreground font-medium">Loading quality data...</p>
                </div>
            </div>
        );
    }

    if (!canReadQuality) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-6">
                <div className="max-w-md w-full bg-card border border-border rounded-xl p-6 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-amber-50 text-amber-600 border-amber-200">
                            <IconShieldLock size={20} strokeWidth={1.8} />
                        </div>
                        <h2 className="text-lg font-semibold text-foreground">No access to Response Quality</h2>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Your role doesn't include permission to view response quality data. Ask an admin to grant you quality access if you need it.
                    </p>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.push(`/dashboard/surveys/${id}/metrics`)}
                            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium"
                        >
                            Back to Metrics
                        </button>
                        <button
                            onClick={() => router.push(`/dashboard/surveys/${id}`)}
                            className="px-4 py-2 rounded-md border border-border text-sm font-medium"
                        >
                            Open Builder
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-muted-foreground font-medium">Loading quality data...</p>
                </div>
            </div>
        );
    }

    if (fetchError || !survey) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-6">
                <div className="max-w-md w-full bg-card border border-border rounded-xl p-6 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-rose-50 text-rose-600 border-rose-200">
                            <IconAlertCircle size={20} strokeWidth={1.8} />
                        </div>
                        <h2 className="text-lg font-semibold text-foreground">Could not load quality data</h2>
                    </div>
                    <p className="text-sm text-muted-foreground">{fetchError || "Unknown error"}</p>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium"
                        >
                            Retry
                        </button>
                        <button
                            onClick={() => router.push(`/dashboard/surveys/${id}/metrics`)}
                            className="px-4 py-2 rounded-md border border-border text-sm font-medium"
                        >
                            Back to Metrics
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 md:p-12 w-full max-w-7xl mx-auto space-y-8">
            {/* Header: identity + actions, with section tabs woven into the divider */}
            <header className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                        <h1 className="text-3xl font-semibold tracking-tight text-foreground truncate">{survey.name}</h1>
                        <div className="mt-2 flex items-center gap-2">
                            <p className="text-sm text-muted-foreground font-medium">{survey.client ? `${survey.client} • ` : ""}Response Quality</p>
                            <HowDecisionsWorkPopover />
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {(canExportQuality || canExportDetailedQuality) && (
                            <div className="relative">
                                <button
                                    onClick={() => setIsExportOpen((open) => !open)}
                                    className="flex h-9 items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 text-sm font-medium text-primary shadow-sm transition-colors hover:bg-primary/15"
                                >
                                    <IconDownload size={16} strokeWidth={1.7} />
                                    Export
                                    <IconChevronDown size={14} strokeWidth={1.7} />
                                </button>
                                {isExportOpen && (
                                    <>
                                        <button
                                            aria-label="Close export menu"
                                            className="fixed inset-0 z-40 cursor-default"
                                            onClick={() => setIsExportOpen(false)}
                                        />
                                        <div className="absolute right-0 z-50 mt-2 w-64 rounded-lg border border-border/60 bg-background p-1.5 shadow-xl">
                                            {canExportQuality && (
                                                <>
                                                    <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Quality summary</p>
                                                    <button
                                                        onClick={() => {
                                                            void surveyResponseApi.exportQualityResponses(id, 'csv', viewMode);
                                                            setIsExportOpen(false);
                                                        }}
                                                        className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                                                    >
                                                        Download CSV
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            void surveyResponseApi.exportQualityResponses(id, 'xlsx', viewMode);
                                                            setIsExportOpen(false);
                                                        }}
                                                        className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                                                    >
                                                        Download Excel
                                                    </button>
                                                </>
                                            )}
                                            {canExportDetailedQuality && (
                                                <>
                                                    <div className="my-1 border-t border-border/60" />
                                                    <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Detailed evidence</p>
                                                    <button
                                                        onClick={() => {
                                                            void surveyResponseApi.exportQualityResponses(id, 'json', viewMode, true);
                                                            setIsExportOpen(false);
                                                        }}
                                                        className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                                                    >
                                                        Download evidence JSON
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                        <button
                            onClick={() => void refreshAll()}
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-background text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground transition-colors"
                            title="Refresh Data"
                        >
                            <IconRefresh size={16} strokeWidth={1.7} />
                        </button>

                        {canConfigureQuality && (
                            <button
                                onClick={() => setIsSettingsOpen(true)}
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-background text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground transition-colors"
                                title="Quality Settings"
                            >
                                <IconSettings size={16} strokeWidth={1.7} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Section navigation */}
                <SurveyNavTabs surveyId={id} variant="underline" />
            </header>

            {/* Data scope */}
            <div className="flex h-10 w-fit items-center gap-1 rounded-lg border border-border/60 bg-muted/40 p-1">
                <button
                    onClick={() => {
                        setViewMode("LIVE");
                        setCurrentPage(1);
                    }}
                    className={cn(
                        "h-8 rounded-md px-5 text-xs font-semibold transition-all",
                        viewMode === "LIVE" ? "bg-background text-foreground shadow-sm border border-border/60" : "text-muted-foreground hover:bg-muted/50 border border-transparent"
                    )}
                >
                    Live Data
                </button>
                <button
                    onClick={() => {
                        setViewMode("TEST");
                        setCurrentPage(1);
                    }}
                    className={cn(
                        "h-8 rounded-md px-5 text-xs font-semibold transition-all",
                        viewMode === "TEST" ? "bg-background text-foreground shadow-sm border border-border/60" : "text-muted-foreground hover:bg-muted/50 border border-transparent"
                    )}
                >
                    Test Data
                </button>
            </div>

            {/* KPI Strip */}
            <div className="bg-background border border-border/60 rounded-xl shadow-sm grid grid-cols-2 lg:grid-cols-4 divide-x divide-border/60 divide-y lg:divide-y-0">
                <KpiCell
                    label="Total Responses"
                    hint="Responses included in this quality view."
                    value={String(summary.totalResponses)}
                    sub={viewMode === "LIVE" ? "live data" : "test data"}
                />
                <KpiCell
                    label="Needs Review"
                    hint="Responses with one quality finding that need a reviewer to clear or confirm them."
                    value={String(needsReviewCount)}
                    sub={formatPercent(needsReviewCount, summary.totalResponses)}
                    valueClassName={needsReviewCount > 0 ? "text-rose-600" : undefined}
                />
                <KpiCell
                    label="High Risk"
                    hint="Duplicate respondents, critical findings, or findings from multiple independent checks."
                    value={String(summary.stateCounts.HIGH_RISK || 0)}
                    sub={formatPercent(summary.stateCounts.HIGH_RISK || 0, summary.totalResponses)}
                    valueClassName={(summary.stateCounts.HIGH_RISK || 0) > 0 ? "text-red-600" : undefined}
                />
                <KpiCell
                    label="Clean"
                    hint="Responses that passed every quality check with no issues."
                    value={String(summary.stateCounts.CLEAN || 0)}
                    sub={formatPercent(summary.stateCounts.CLEAN || 0, summary.totalResponses)}
                />
            </div>

            {/* Responses Table */}
            <div className="bg-background border border-border/60 rounded-xl overflow-hidden shadow-sm">
                <div className="px-6 py-5 border-b border-border/60 flex items-center justify-between gap-4">
                    <div>
                        <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                            <IconGauge size={18} className="text-muted-foreground" />
                            Responses by Quality
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Latest updates first. Click a row to see why it was flagged and record a decision.
                        </p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {meta.total} responses
                    </span>
                </div>

                {listLoading ? (
                    <div className="p-12 text-center text-muted-foreground bg-muted/10">
                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                        Loading responses...
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left table-auto border-separate border-spacing-0">
                            <thead>
                                <tr className="bg-muted/30 text-muted-foreground text-xs font-medium">
                                    <th className="px-6 py-3 border-b border-border/60 min-w-[220px]">Respondent</th>
                                    <th className="px-6 py-3 border-b border-border/60 min-w-[160px]">
                                        <div className="flex items-center gap-2">
                                            <span>Status</span>
                                            <FilterPopover
                                                value={qualityState === "ALL" ? "" : qualityState}
                                                onChange={(v) => {
                                                    setQualityState(v || "ALL");
                                                    setCurrentPage(1);
                                                }}
                                                options={[
                                                    { label: "All states", value: "" },
                                                    { label: "Clean", value: "CLEAN" },
                                                    { label: "Needs Review", value: "NEEDS_REVIEW" },
                                                    { label: "High Risk", value: "HIGH_RISK" },
                                                ]}
                                            />
                                        </div>
                                    </th>
                                    <th className="px-6 py-3 border-b border-border/60">Flags</th>
                                    <th className="px-6 py-3 border-b border-border/60 min-w-[150px]">
                                        <div className="flex items-center gap-2">
                                            <span>Review</span>
                                            <FilterPopover
                                                value={reviewStatusFilter === "ALL" ? "" : reviewStatusFilter}
                                                onChange={(v) => {
                                                    setReviewStatusFilter(v || "ALL");
                                                    setCurrentPage(1);
                                                }}
                                                options={[
                                                    { label: "All statuses", value: "" },
                                                    ...Object.entries(REVIEW_META).map(([value, m]) => ({ label: m.label, value })),
                                                ]}
                                            />
                                        </div>
                                    </th>
                                    <th className="px-6 py-3 border-b border-border/60 whitespace-nowrap">Updated</th>
                                </tr>
                            </thead>
                            <tbody>
                                {responses.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground text-sm">
                                            {qualityState !== "ALL" || reviewStatusFilter !== "ALL"
                                                ? "No responses match these filters. Try clearing them."
                                                : "No responses yet — quality findings will appear here as responses come in."}
                                        </td>
                                    </tr>
                                ) : (
                                    responses.map((response) => (
                                        <tr
                                            key={response.id}
                                            onClick={() => openResponse(response.id)}
                                            className={cn(
                                                "cursor-pointer hover:bg-primary/5 transition-colors group",
                                                selectedResponseId === response.id && "bg-primary/5"
                                            )}
                                        >
                                            <td className={cn(
                                                "px-6 py-3 border-b border-border/60 border-l-2 transition-colors",
                                                selectedResponseId === response.id ? "border-l-primary" : "border-l-transparent group-hover:border-l-primary"
                                            )}>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{response.respondentId || "Anonymous"}</span>
                                                    <span className="text-xs text-muted-foreground opacity-80 font-mono">ID-{safeIdShort(response.id)}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-3 border-b border-border/60">
                                                <div
                                                    className="flex items-center gap-2"
                                                    title={`${stateMeta(response.qualityState).label} — ${stateMeta(response.qualityState).description}`}
                                                >
                                                    <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", stateMeta(response.qualityState).dot)} />
                                                    <span className="text-sm font-semibold text-foreground">{stateMeta(response.qualityState).label}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-3 border-b border-border/60 text-sm text-foreground whitespace-nowrap">
                                                {response.activeFlagCount > 0
                                                    ? `${response.activeFlagCount} flag${response.activeFlagCount === 1 ? "" : "s"}`
                                                    : <span className="text-muted-foreground opacity-50">—</span>}
                                            </td>
                                            <td className="px-6 py-3 border-b border-border/60">
                                                <QualityBadge meta={reviewMeta(response.qualityReviewStatus)} />
                                            </td>
                                            <td className="px-6 py-3 border-b border-border/60 text-xs text-muted-foreground whitespace-nowrap">
                                                {safeDateTime(response.updatedAt || response.qualityReviewedAt || response.completedAt || response.startedAt)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination Controls */}
                {meta.totalPages > 1 && (
                    <div className="px-6 py-4 bg-muted/20 border-t border-border flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                            Showing <span className="font-bold text-foreground">{meta.total > 0 ? ((meta.page - 1) * meta.limit) + 1 : 0}</span> to <span className="font-bold text-foreground">{Math.min(meta.page * meta.limit, meta.total)}</span> of <span className="font-bold text-foreground">{meta.total}</span> responses
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                title="Previous page"
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                disabled={meta.page <= 1}
                                className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <IconChevronLeft size={16} />
                            </button>
                            <div className="flex items-center gap-1">
                                {[...Array(meta.totalPages)].map((_, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setCurrentPage(i + 1)}
                                        className={cn(
                                            "w-8 h-8 rounded-lg text-xs font-bold transition-all",
                                            meta.page === i + 1
                                                ? "bg-primary text-primary-foreground shadow-md"
                                                : "hover:bg-muted text-muted-foreground"
                                        )}
                                    >
                                        {i + 1}
                                    </button>
                                )).slice(Math.max(0, meta.page - 3), Math.min(meta.totalPages, meta.page + 2))}
                            </div>
                            <button
                                title="Next page"
                                onClick={() => setCurrentPage((p) => Math.min(meta.totalPages, p + 1))}
                                disabled={meta.page >= meta.totalPages}
                                className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <IconChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Detector Breakdown */}
            <div className="bg-background border border-border/60 rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-border/60">
                    <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                        <IconFlag size={18} className="text-muted-foreground" />
                        What the checks found
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                        How often each automated check fired in {viewMode === "LIVE" ? "live" : "test"} data. Hover a name for what it checks.
                    </p>
                </div>
                {detectorRows.length === 0 ? (
                    <div className="px-6 py-8 text-center text-sm text-muted-foreground">
                        No quality findings yet — every evaluated response passed all checks.
                    </div>
                ) : (
                    <div className="divide-y divide-border/60">
                        {detectorRows.map((row) => (
                            <div key={row.detectorCode} className="px-6 py-3 flex items-center gap-4">
                                <span
                                    className="w-44 shrink-0 text-sm font-medium text-foreground cursor-help"
                                    title={detectorMeta(row.detectorCode).description}
                                >
                                    {detectorMeta(row.detectorCode).label}
                                </span>
                                <div className="flex-1 h-2 rounded-full bg-muted/60 overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-rose-400"
                                        style={{ width: `${maxDetectorCount > 0 ? Math.max(4, (row.count / maxDetectorCount) * 100) : 0}%` }}
                                    />
                                </div>
                                <span className="w-10 shrink-0 text-right text-sm font-bold text-foreground">{row.count}</span>
                                <span className="w-44 shrink-0 text-right text-xs text-muted-foreground whitespace-nowrap">
                                    <span className="font-semibold text-blue-600">{row.metrics.reviewedValidCount}</span> cleared
                                    <span className="mx-1.5 text-border">|</span>
                                    <span className="font-semibold text-violet-600">{row.metrics.reviewedConfirmedCount}</span> confirmed
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Response Detail Drawer */}
            {isDrawerOpen && (
                <ModalPortal>
                    <div className="fixed inset-0 z-[120] h-dvh w-screen">
                        <button
                            className="absolute inset-0 bg-black/30 backdrop-blur-[2px] cursor-default animate-in fade-in duration-200"
                            onClick={closeDrawer}
                            aria-label="Close response detail"
                        />
                        <div className="absolute right-0 top-0 h-full w-full max-w-[480px] bg-background border-l border-border/70 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                            {/* Drawer header */}
                            <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between gap-3 shrink-0">
                                <div className="min-w-0">
                                    <h3 className="text-sm font-semibold text-foreground truncate">
                                        {selectedDetail?.respondentId || "Response detail"}
                                    </h3>
                                    <p className="text-xs text-muted-foreground font-mono">
                                        {selectedDetail ? `ID-${safeIdShort(selectedDetail.id)} · ${selectedDetail.mode === "LIVE" ? "Live Data" : "Test Data"}` : "Loading..."}
                                    </p>
                                </div>
                                <button
                                    title="Close (Esc)"
                                    onClick={closeDrawer}
                                    className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                                >
                                    <IconX size={18} />
                                </button>
                            </div>

                            {/* Drawer body */}
                            <div className="flex-1 overflow-y-auto">
                                {detailLoading || !selectedDetail ? (
                                    <div className="p-12 text-center text-muted-foreground">
                                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                                        Loading detail...
                                    </div>
                                ) : (
                                    <div className="divide-y divide-border/60">
                                        {/* Decision summary */}
                                        <div className="px-6 py-5 space-y-4">
                                            <div className="flex items-center gap-4">
                                                <span className={cn("h-3 w-3 rounded-full shrink-0", stateMeta(selectedDetail.qualityState).dot)} />
                                                <div className="min-w-0 space-y-1.5">
                                                    <p className="text-lg font-semibold text-foreground">{stateMeta(selectedDetail.qualityState).label}</p>
                                                    <p className="text-xs text-muted-foreground">{stateMeta(selectedDetail.qualityState).description}</p>
                                                    <div className="flex flex-wrap items-center gap-2 pt-1">
                                                        <QualityBadge meta={stateMeta(selectedDetail.qualityState)} />
                                                        <QualityBadge meta={drawerProcessingMeta} />
                                                        <QualityBadge meta={reviewMeta(selectedDetail.qualityReviewStatus)} />
                                                    </div>
                                                </div>
                                            </div>
                                            <div className={cn("rounded-xl border px-4 py-3", drawerDecisionSummary.className)}>
                                                <p className="text-sm font-semibold">{drawerDecisionSummary.title}</p>
                                                <p className="mt-1 text-sm opacity-90">{drawerDecisionSummary.description}</p>
                                            </div>
                                        </div>

                                        {/* Automated checks */}
                                        <div className="px-6 py-5 space-y-3">
                                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Automated checks</h4>
                                            <div className="space-y-2">
                                                <div className="rounded-lg border border-border/60 bg-background p-4">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-semibold text-foreground">Overall processing</p>
                                                            <p className="mt-1 text-sm text-muted-foreground">{drawerProcessingMeta.description}</p>
                                                        </div>
                                                        <QualityBadge meta={drawerProcessingMeta} />
                                                    </div>
                                                </div>
                                                <div className="rounded-lg border border-border/60 bg-background p-4">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-semibold text-foreground">Open-ended text</p>
                                                            <p className="mt-1 text-sm text-muted-foreground">{openEndCheckMeta.description}</p>
                                                        </div>
                                                        <QualityBadge meta={openEndCheckMeta} />
                                                    </div>
                                                    
                                                    {openEndCheckMeta.detail && (
                                                        <p
                                                            className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
                                                            title={openEndCheckMeta.detail}
                                                        >
                                                            {truncateText(openEndCheckMeta.detail)}
                                                        </p>
                                                    )}
                                                    {(openEndCheckMeta.updatedAt || openEndCheckMeta.attemptCount !== undefined) && (
                                                        <p className="mt-2 text-[11px] text-muted-foreground">
                                                            {openEndCheckMeta.updatedAt ? `Updated ${safeDateTime(openEndCheckMeta.updatedAt)}` : ""}
                                                            {openEndCheckMeta.updatedAt && openEndCheckMeta.attemptCount !== undefined ? " · " : ""}
                                                            {openEndCheckMeta.attemptCount !== undefined ? `Attempts ${openEndCheckMeta.attemptCount}` : ""}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Flags */}
                                        <div className="px-6 py-5 space-y-3">
                                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                {getFlagGroupHeading(flagGroups, activeFlags)}
                                            </h4>
                                            {activeFlags.length === 0 ? (
                                                <p className="text-sm text-muted-foreground">
                                                    {getNoActiveFlagsMessage(selectedDetail, openEndCheckMeta)}
                                                </p>
                                            ) : (
                                                flagGroups.map((group) => {
                                                    const hasQuestionAnswer = group.isOpenEnd && (group.questionLabels.length > 0 || group.answerPreview);

                                                    return (
                                                        <div key={group.key} className="rounded-xl border border-border/70 bg-background p-4 shadow-sm">
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="min-w-0">
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <span className="text-sm font-semibold text-foreground">{group.primaryCopy.label}</span>
                                                                        <span className={cn(
                                                                            "px-2 py-0.5 rounded-md text-[10px] uppercase font-semibold border w-fit",
                                                                            SEVERITY_TONE[group.severity] || SEVERITY_TONE.LOW
                                                                        )}>
                                                                            {group.severity}
                                                                        </span>
                                                                        {group.flags.length > 1 && (
                                                                            <span className="rounded-md border border-border/70 bg-muted/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                                                                {group.flags.length} signals
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{group.primaryCopy.why}</p>
                                                                </div>
                                                            </div>

                                                            {group.issueCopies.length > 1 && (
                                                                <div className="mt-3 flex flex-wrap gap-1.5">
                                                                    {group.issueCopies.map((copy, index) => (
                                                                        <span key={`${group.key}-${index}-${copy.label}`} className="rounded-full border border-border/70 bg-muted/30 px-2.5 py-1 text-xs font-medium text-foreground">
                                                                            {copy.label}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {hasQuestionAnswer && (
                                                                <div className="mt-4 rounded-lg border border-border/60 bg-muted/20 p-3 space-y-3">
                                                                    {group.questionLabels.length > 0 && (
                                                                        <div>
                                                                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Question</p>
                                                                            <div className="mt-1 space-y-1">
                                                                                {group.questionLabels.map((label) => (
                                                                                    <p key={label} className="text-sm text-foreground">{truncateText(label, 220)}</p>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    {group.answerPreview && (
                                                                        <div>
                                                                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Answer</p>
                                                                            <p className="mt-1 text-sm text-foreground">{truncateText(group.answerPreview, 220)}</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}

                                                            <div className="mt-3 rounded-lg border border-sky-100 bg-sky-50/70 px-3 py-2">
                                                                <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-700">Suggested decision</p>
                                                                <p className="mt-1 text-sm text-sky-900">{getGroupSuggestedAction(group)}</p>
                                                            </div>

                                                            <details className="mt-3 rounded-lg border border-border/60 bg-muted/10 px-3 py-2 group">
                                                                <summary className="cursor-pointer select-none text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground">
                                                                    Technical details: {group.flags.length} detector signal{group.flags.length === 1 ? "" : "s"}
                                                                </summary>
                                                                <div className="mt-3 space-y-3">
                                                                    {group.flags.map((flag) => {
                                                                        const openEndEvidence = getOpenEndEvidence(flag);
                                                                        const metadata = openEndEvidence?.metadata;
                                                                        const thresholdConfidence = asNumber(metadata?.thresholdConfidence);
                                                                        const detectedLanguage = asString(metadata?.detectedLanguage);
                                                                        const observedText = formatWordCharacterCount(
                                                                            asNumber(metadata?.observedWordCount),
                                                                            asNumber(metadata?.observedCharacterCount)
                                                                        );
                                                                        const thresholdText = formatWordCharacterCount(
                                                                            asNumber(metadata?.thresholdWordCount),
                                                                            asNumber(metadata?.thresholdCharacterCount)
                                                                        );
                                                                        const detectorText = openEndEvidence?.detectorFamily === "AI_JUDGE"
                                                                            ? `AI judge${openEndEvidence.detectorModel ? `: ${openEndEvidence.detectorModel}` : ""}`
                                                                            : `Deterministic rule: ${flag.detectorCode}`;
                                                                        const decisionCopy = openEndEvidence
                                                                            ? getOpenEndFlagDecisionCopy(flag, openEndEvidence)
                                                                            : getPlainFlagDecisionCopy(flag);

                                                                        return (
                                                                            <div key={flag.id} className="rounded-lg border border-border/60 bg-background p-3">
                                                                                <div className="flex items-start justify-between gap-3">
                                                                                    <div>
                                                                                        <p className="text-sm font-semibold text-foreground">{decisionCopy.label}</p>
                                                                                        <p className="mt-0.5 text-xs text-muted-foreground">{detectorText}</p>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                                                                    {openEndEvidence?.answerIntent && (
                                                                                        <div>
                                                                                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Expected</p>
                                                                                            <p className="mt-1 text-sm text-foreground">{formatOpenEndExpectation(openEndEvidence)}</p>
                                                                                        </div>
                                                                                    )}
                                                                                    {openEndEvidence?.expectedAnswerShape && !openEndEvidence.answerIntent && (
                                                                                        <div>
                                                                                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Expected shape</p>
                                                                                            <p className="mt-1 text-sm text-foreground">{titleCase(openEndEvidence.expectedAnswerShape)}</p>
                                                                                        </div>
                                                                                    )}
                                                                                    {openEndEvidence?.verdict && (
                                                                                        <div>
                                                                                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Model verdict</p>
                                                                                            <p className="mt-1 text-sm text-foreground">{openEndEvidence.verdict}</p>
                                                                                        </div>
                                                                                    )}
                                                                                    {openEndEvidence?.reasonCodes && openEndEvidence.reasonCodes.length > 0 && (
                                                                                        <div>
                                                                                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Reason codes</p>
                                                                                            <p className="mt-1 text-sm text-foreground">{openEndEvidence.reasonCodes.join(", ")}</p>
                                                                                        </div>
                                                                                    )}
                                                                                    {detectedLanguage && (
                                                                                        <div>
                                                                                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Detected language</p>
                                                                                            <p className="mt-1 text-sm text-foreground">{detectedLanguage}</p>
                                                                                        </div>
                                                                                    )}
                                                                                    {openEndEvidence?.confidence !== null && openEndEvidence?.confidence !== undefined && (
                                                                                        <div>
                                                                                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Confidence</p>
                                                                                            <p className="mt-1 text-sm text-foreground">{openEndEvidence.confidence}%{thresholdConfidence !== null ? ` threshold ${thresholdConfidence}%` : ""}</p>
                                                                                        </div>
                                                                                    )}
                                                                                    {observedText && (
                                                                                        <div>
                                                                                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Observed</p>
                                                                                            <p className="mt-1 text-sm text-foreground">{observedText}</p>
                                                                                        </div>
                                                                                    )}
                                                                                    {thresholdText && (
                                                                                        <div>
                                                                                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Threshold</p>
                                                                                            <p className="mt-1 text-sm text-foreground">{thresholdText}</p>
                                                                                        </div>
                                                                                    )}
                                                                                    {!openEndEvidence && flag.confidence !== null && flag.confidence !== undefined && (
                                                                                        <div>
                                                                                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Confidence</p>
                                                                                            <p className="mt-1 text-sm text-foreground">{flag.confidence}%</p>
                                                                                        </div>
                                                                                    )}
                                                                                    <div>
                                                                                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Detected</p>
                                                                                        <p className="mt-1 text-sm text-foreground">{safeDateTime(flag.detectedAt)}</p>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </details>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>

                                        {/* Review */}
                                        {activeFlags.length > 0 && (
                                            <div className="px-6 py-5">
                                                <div className="rounded-lg border border-border/60 overflow-hidden">
                                                    <button
                                                        onClick={() => setIsReviewOpen((open) => !open)}
                                                        disabled={!canReviewQuality}
                                                        className={cn(
                                                            "w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors",
                                                            canReviewQuality ? "hover:bg-muted/40" : "cursor-not-allowed opacity-70"
                                                        )}
                                                    >
                                                        <div>
                                                            <span className="text-sm font-semibold text-foreground">Review this response</span>
                                                            <p className="mt-0.5 text-xs text-muted-foreground">
                                                                {canReviewQuality
                                                                    ? (selectedDetail.qualityReviewStatus && selectedDetail.qualityReviewStatus !== "UNREVIEWED"
                                                                        ? `${reviewMeta(selectedDetail.qualityReviewStatus).label}${selectedDetail.qualityReviewedAt ? ` on ${safeDateTime(selectedDetail.qualityReviewedAt)}` : ""} — you can change this decision.`
                                                                        : "Decide whether these flags are real problems or false alarms.")
                                                                    : "Your role can view quality data but not record review decisions."}
                                                            </p>
                                                        </div>
                                                        <IconChevronDown size={18} className={cn("shrink-0 text-muted-foreground transition-transform", isReviewOpen && "rotate-180")} />
                                                    </button>

                                                    {isReviewOpen && canReviewQuality && (
                                                        <div className="border-t border-border/60 bg-muted/10 p-4 space-y-4">
                                                            <div className="space-y-2">
                                                                {REVIEW_CHOICES.map((choice) => (
                                                                    <label
                                                                        key={choice.value}
                                                                        className={cn(
                                                                            "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                                                                            reviewStatus === choice.value
                                                                                ? "border-primary/50 bg-primary/5"
                                                                                : "border-border/60 bg-background hover:bg-muted/30"
                                                                        )}
                                                                    >
                                                                        <input
                                                                            type="radio"
                                                                            name="review-decision"
                                                                            value={choice.value}
                                                                            checked={reviewStatus === choice.value}
                                                                            onChange={() => setReviewStatus(choice.value)}
                                                                            className="mt-0.5 h-4 w-4 accent-primary"
                                                                        />
                                                                        <span>
                                                                            <span className="block text-sm font-semibold text-foreground">{choice.label}</span>
                                                                            <span className="block text-xs text-muted-foreground">{choice.description}</span>
                                                                        </span>
                                                                    </label>
                                                                ))}
                                                            </div>

                                                            {reviewStatus !== "UNREVIEWED" && flagGroups.length > 1 && (
                                                                <div className="space-y-2">
                                                                    <p className="text-xs font-semibold text-muted-foreground">Which review items does this decision apply to?</p>
                                                                    <div className="space-y-2 rounded-lg border border-border/60 bg-background p-3">
                                                                        {flagGroups.map((group) => {
                                                                            const flagIds = group.flags.map((flag) => flag.id);
                                                                            const allSelected = flagIds.every((flagId) => reviewedFlagIds.includes(flagId));
                                                                            const label = group.questionLabels[0] || group.primaryCopy.label;
                                                                            return (
                                                                                <label key={group.key} className="flex items-start gap-3 text-sm text-foreground cursor-pointer">
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={allSelected}
                                                                                        onChange={() => toggleReviewedFlagGroup(flagIds)}
                                                                                        className="mt-0.5 h-4 w-4 accent-primary"
                                                                                    />
                                                                                    <span>
                                                                                        <span className="font-medium">{group.primaryCopy.label}</span>
                                                                                        {group.flags.length > 1 && (
                                                                                            <span className="text-muted-foreground"> ({group.flags.length} signals)</span>
                                                                                        )}
                                                                                        <span className="block text-xs text-muted-foreground">{truncateText(label, 140)}</span>
                                                                                    </span>
                                                                                </label>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {reviewStatus !== "UNREVIEWED" && (
                                                                <>
                                                                    <label className="block">
                                                                        <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Reason (optional)</span>
                                                                        <select
                                                                            value={reviewReasonCode}
                                                                            onChange={(event) => setReviewReasonCode(event.target.value)}
                                                                            className="w-full h-10 rounded-lg border border-border/70 bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                                                                        >
                                                                            <option value="">Select a reason...</option>
                                                                            {Object.entries(REASON_META).map(([value, label]) => (
                                                                                <option key={value} value={value}>{label}</option>
                                                                            ))}
                                                                        </select>
                                                                    </label>

                                                                    <label className="block">
                                                                        <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Internal note (optional)</span>
                                                                        <textarea
                                                                            value={reviewNote}
                                                                            onChange={(event) => setReviewNote(event.target.value)}
                                                                            rows={3}
                                                                            placeholder="Visible to your team only. Avoid personal data."
                                                                            className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                                                                        />
                                                                    </label>
                                                                </>
                                                            )}

                                                            <button
                                                                onClick={() => void submitReview()}
                                                                disabled={savingReview}
                                                                className={cn(
                                                                    "w-full h-10 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2",
                                                                    savingReview
                                                                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                                                                        : "bg-primary text-primary-foreground hover:opacity-90 shadow-sm"
                                                                )}
                                                            >
                                                                {savingReview ? <IconRefresh size={16} className="animate-spin" /> : <IconCheck size={16} />}
                                                                {savingReview ? "Saving..." : "Save Decision"}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                 
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </ModalPortal>
            )}

            <QualitySettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                surveyId={id}
                onSave={() => {
                    void refreshAll();
                }}
            />
        </div>
    );
}

function KpiCell({ label, hint, value, suffix, sub, valueClassName }: {
    label: string;
    hint: string;
    value: string;
    suffix?: string;
    sub: string;
    valueClassName?: string;
}) {
    return (
        <div className="px-6 py-4">
            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                {label}
                <span title={hint} className="cursor-help text-muted-foreground/60">
                    <IconInfoCircle size={13} strokeWidth={2} />
                </span>
            </p>
            <div className="mt-2 flex items-baseline gap-1.5">
                <span className={cn("text-2xl font-bold leading-none text-foreground", valueClassName)}>{value}</span>
                {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
                <span className="ml-1 text-xs text-muted-foreground">{sub}</span>
            </div>
        </div>
    );
}

function HowDecisionsWorkPopover() {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="relative inline-block">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium transition-colors",
                    isOpen ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
            >
                <IconInfoCircle size={14} strokeWidth={2} />
                How decisions work
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute top-full left-0 mt-2 w-80 bg-card border border-border shadow-xl rounded-xl p-4 z-50 animate-in fade-in zoom-in-95 duration-200">
                        <p className="text-sm text-foreground">
                            Quality checks create findings with supporting evidence. One finding means <span className="font-semibold">Needs Review</span>; critical, duplicate-respondent, or multiple independent findings mean <span className="font-semibold">High Risk</span>.
                        </p>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Review flagged responses to either <span className="font-medium text-foreground">clear</span> them (false alarm) or <span className="font-medium text-foreground">confirm</span> them as bad data.
                        </p>
                    </div>
                </>
            )}
        </div>
    );
}

function QualityBadge({ meta }: { meta: { label: string; description: string; badge: string } }) {
    return (
        <span
            title={meta.description}
            className={cn(
                "px-2 py-0.5 rounded-md text-[10px] uppercase font-semibold border shadow-sm w-fit whitespace-nowrap cursor-help",
                meta.badge
            )}
        >
            {meta.label}
        </span>
    );
}

function FilterPopover({ value, onChange, options }: {
    value: string;
    onChange: (val: string) => void;
    options: { label: string; value: string }[];
}) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="relative inline-block ml-1">
            <button
                title="Filter"
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "p-1.5 rounded-lg hover:bg-muted transition-colors",
                    value ? "text-primary bg-primary/10 ring-1 ring-primary/20" : "text-muted-foreground"
                )}
            >
                <IconFilter size={14} strokeWidth={2.5} />
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute top-full right-0 left-0 mt-2 min-w-[200px] w-max bg-card border border-border shadow-xl rounded-xl p-3 z-50 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex flex-col gap-1">
                            {options.map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => { onChange(opt.value); setIsOpen(false); }}
                                    className={cn(
                                        "text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors hover:bg-muted",
                                        value === opt.value ? "bg-primary/10 text-primary" : "text-foreground"
                                    )}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
