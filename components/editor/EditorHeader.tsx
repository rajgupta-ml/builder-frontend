"use client"
import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    IconCheck,
    IconAlertCircle,
    IconLoader2,
    IconPlayerPlay,
    IconShare,
    IconFilter,
    IconSettings,
    IconHistory,
    IconPlayerPause,
    IconBan,
    IconDotsVertical,
    IconRoute,
    IconSparkles
} from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import { useSurveyStore } from '@/src/store/useSurveyStore';
import { toast } from 'sonner';
import { getStoredUserScopes, hasPermission, PERMISSIONS } from '@/lib/permissions';
import { PermissionRequired } from '@/components/auth/PermissionRequired';
import { featureFlags } from '@/lib/feature-flags';
import type { WorkflowValidationIssue } from '@/api/surveyWorkflow';

interface EditorHeaderProps {
    surveyId: string;
    setIsQuotaOpen: (open: boolean) => void;
    setIsSettingsOpen: (open: boolean) => void;
    setIsShareOpen: (open: boolean) => void;
    setIsAiImportOpen: (open: boolean) => void;
    aiImportStatus?: "IDLE" | "QUEUED" | "PROCESSING" | "SUCCEEDED" | "FAILED";
    confirmNavigation?: () => boolean;
    onRunTest?: () => void;
    validationIssues?: WorkflowValidationIssue[];
    validationPending?: boolean;
    analysisOpen?: boolean;
    onAnalysisOpenChange?: (open: boolean) => void;
}

export function EditorHeader({
    surveyId,
    setIsQuotaOpen,
    setIsSettingsOpen,
    setIsShareOpen,
    setIsAiImportOpen,
    aiImportStatus = "IDLE",
    confirmNavigation = () => true,
    onRunTest,
    validationIssues = [],
    validationPending = false,
    analysisOpen = false,
    onAnalysisOpenChange,
}: EditorHeaderProps) {
    const router = useRouter();
    const versionDropdownRef = useRef<HTMLDivElement>(null);
    const actionsDropdownRef = useRef<HTMLDivElement>(null);
    const [isVersionDropdownOpen, setIsVersionDropdownOpen] = useState(false);
    const [isActionsDropdownOpen, setIsActionsDropdownOpen] = useState(false);
    const [userScopes, setUserScopes] = useState<string[]>([]);

    const {
        survey,
        versions,
        workflowId,
        saveStatus,
        isPublishing,
        isSyncingTest,
        hasChanges,
        selectedVersionId,
        lastSavedAt,
        publish,
        pause,
        close,
        resume,
        selectVersion,
        isReadOnly
    } = useSurveyStore();

    useEffect(() => {
        setUserScopes(getStoredUserScopes());
        const handleClickOutside = (event: MouseEvent) => {
            if (versionDropdownRef.current && !versionDropdownRef.current.contains(event.target as Node)) {
                setIsVersionDropdownOpen(false);
            }
            if (actionsDropdownRef.current && !actionsDropdownRef.current.contains(event.target as Node)) {
                setIsActionsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const isLive = survey?.status === 'LIVE' || survey?.status === 'PAUSED';
    const canRunTest = hasPermission(userScopes, PERMISSIONS.TEST_RUN);
    const canPublishLive = hasPermission(userScopes, PERMISSIONS.SURVEY_PUBLISH_LIVE);

    const handlePublishLive = async () => {
        if (!workflowId) {
            toast.error("Please wait for draft to save first.");
            return;
        }

        const blockingIssues = validationIssues.filter((issue) => issue.type === 'error');
        if (validationPending) {
            toast.error("Validation in progress. Please wait a moment.");
            return;
        }
        if (blockingIssues.length > 0) {
            toast.error("Cannot Publish", {
                description: (
                    <ul className="list-disc pl-4 mt-2 text-xs">
                        {blockingIssues.slice(0, 5).map((e, i) => (
                            <li key={i}>{e.message}</li>
                        ))}
                        {blockingIssues.length > 5 && <li>...and {blockingIssues.length - 5} more</li>}
                    </ul>
                ),
                duration: 5000
            });
            return;
        }

        await publish(surveyId, 'LIVE');
    };

    const handleQuickTest = async () => {
        await publish(surveyId, 'TEST');
        const testLink = survey?.testSlug
            ? `${process.env.NEXT_PUBLIC_SURVEY_URL || 'http://localhost:5173'}/s/${survey.testSlug}`
            : `${process.env.NEXT_PUBLIC_SURVEY_URL || 'http://localhost:5173'}/s/${surveyId}?mode=test`;
        window.open(testLink, '_blank');
        onRunTest?.();
        toast.success("Opened test survey in a new tab.");
    };

    return (
        <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
            {/* Status Badges */}
            {isLive && hasChanges ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 backdrop-blur-sm rounded-full shadow-sm mr-2" title="Changes detected - republish needed">
                    <IconAlertCircle className="text-amber-500" size={14} />
                    <span className="text-amber-600 font-bold text-[10px] tracking-wider uppercase whitespace-nowrap">
                        Out of Sync
                    </span>
                    <span className="text-[10px] text-amber-700/80 hidden md:inline">
                        Republish to sync live traffic
                    </span>
                </div>
            ) : isLive ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-sm rounded-full shadow-sm mr-2">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-emerald-600 font-bold text-[10px] tracking-wider uppercase">Live</span>
                </div>
            ) : (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 backdrop-blur-sm rounded-full shadow-sm mr-2">
                    <span className="text-blue-600 font-bold text-[10px] tracking-wider uppercase">Draft</span>
                </div>
            )}

            {/* Save Status */}
            {(saveStatus === 'saving' || saveStatus === 'saved' || saveStatus === 'error') && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-background/80 backdrop-blur-sm border border-border rounded-full shadow-sm text-xs font-medium transition-all mr-2">
                    {saveStatus === 'saving' && (
                        <>
                            <IconLoader2 className="animate-spin text-primary" size={14} />
                            <span className="text-muted-foreground">Saving...</span>
                        </>
                    )}
                    {saveStatus === 'saved' && (
                        <>
                            <IconCheck className="text-emerald-500" size={14} />
                            <span className="text-foreground">
                                Saved{lastSavedAt ? ` • ${new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ""}
                            </span>
                        </>
                    )}
                    {saveStatus === 'error' && (
                        <>
                            <IconAlertCircle className="text-destructive" size={14} />
                            <span className="text-destructive">Save Failed</span>
                        </>
                    )}
                </div>
            )}

            {(aiImportStatus === "QUEUED" || aiImportStatus === "PROCESSING") && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 backdrop-blur-sm rounded-full shadow-sm text-xs font-medium transition-all mr-2">
                    <IconLoader2 className="animate-spin text-blue-600" size={14} />
                    <span className="text-blue-700">AI Import Running</span>
                </div>
            )}

            {/* Primary Action */}
            {canRunTest ? (
                <button
                    onClick={handleQuickTest}
                    disabled={isSyncingTest || isReadOnly}
                    className="flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold text-foreground hover:bg-muted transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    title={isReadOnly ? "Unavailable in read-only version view" : "Run test survey in a new tab"}
                >
                    {isSyncingTest ? (
                        <IconLoader2 className="animate-spin text-blue-500" size={15} />
                    ) : (
                        <IconPlayerPlay size={15} className="text-blue-500" />
                    )}
                    Test
                </button>
            ) : (
                <PermissionRequired scope="survey_studio:test.run" />
            )}

            {/* Version History */}
            <div className="relative" ref={versionDropdownRef}>
                <button
                    onClick={() => setIsVersionDropdownOpen(!isVersionDropdownOpen)}
                    className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-all",
                        isVersionDropdownOpen && "bg-muted text-foreground"
                    )}
                    title={selectedVersionId ? `Viewing Version ${versions.find(v => v.id === selectedVersionId)?.version || '?'}` : 'Version history'}
                >
                    <IconHistory size={16} strokeWidth={1.8} />
                </button>

                {isVersionDropdownOpen && (
                    <div className="absolute top-full right-0 mt-2 w-64 bg-background border border-border rounded-xl shadow-xl overflow-hidden z-60 animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-2 border-b border-border bg-muted/30">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-center">Version History</p>
                        </div>
                        <div className="max-h-64 overflow-y-auto p-1">
                            <button
                                onClick={() => {
                                    selectVersion(surveyId, null);
                                    setIsVersionDropdownOpen(false);
                                }}
                                className={cn(
                                    "w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-between",
                                    !selectedVersionId ? "bg-primary/10 text-primary" : "hover:bg-muted text-foreground"
                                )}
                            >
                                <span>Current Draft</span>
                                {!selectedVersionId && <IconCheck size={14} />}
                            </button>

                            {versions.map((v) => (
                                <button
                                    key={v.id}
                                    onClick={() => {
                                        selectVersion(surveyId, v.id);
                                        setIsVersionDropdownOpen(false);
                                    }}
                                    className={cn(
                                        "w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-between group/item",
                                        selectedVersionId === v.id ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <div className="flex flex-col">
                                        <span className="flex items-center gap-1 font-semibold">
                                            Version {v.version}
                                            {v.status === 'PUBLISHED' && <span className="text-[9px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 rounded-full border border-emerald-500/20 font-normal">Live</span>}
                                        </span>
                                        <span className="text-[10px] opacity-60">{new Date(v.createdAt).toLocaleString()}</span>
                                    </div>
                                    {selectedVersionId === v.id && <IconCheck size={14} />}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* More Menu */}
            <div className="relative" ref={actionsDropdownRef}>
                <button
                    onClick={() => setIsActionsDropdownOpen((prev) => !prev)}
                    className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-all",
                        isActionsDropdownOpen && "bg-muted text-foreground"
                    )}
                    title="More actions"
                >
                    <IconDotsVertical size={16} strokeWidth={1.8} />
                </button>

                {isActionsDropdownOpen && (
                    <div className="absolute top-full right-0 mt-2 w-64 bg-background border border-border rounded-xl shadow-xl overflow-hidden z-60 animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-2 border-b border-border bg-muted/30">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-center">Actions</p>
                        </div>
                        <div className="p-1 space-y-1">
                            <button
                                onClick={() => {
                                    setIsActionsDropdownOpen(false);
                                    setIsQuotaOpen(true);
                                }}
                                disabled={isReadOnly}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium hover:bg-muted text-foreground transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <IconFilter size={15} />
                                Quotas
                            </button>
                            <button
                                onClick={() => {
                                    setIsActionsDropdownOpen(false);
                                    setIsSettingsOpen(true);
                                }}
                                disabled={isReadOnly}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium hover:bg-muted text-foreground transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <IconSettings size={15} />
                                Settings
                            </button>
                            <button
                                onClick={() => {
                                    setIsActionsDropdownOpen(false);
                                    setIsShareOpen(true);
                                }}
                                disabled={isReadOnly}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium hover:bg-muted text-foreground transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <IconShare size={15} />
                                Share
                            </button>
                            <div className="border-t border-border pt-1">
                                <button
                                    onClick={() => {
                                        setIsActionsDropdownOpen(false);
                                        onAnalysisOpenChange?.(!analysisOpen);
                                    }}
                                    className={cn(
                                        'group flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-all',
                                        analysisOpen
                                            ? 'border-primary/30 bg-primary/10 text-foreground'
                                            : 'border-primary/15 bg-primary/5 text-foreground hover:border-primary/30 hover:bg-primary/10',
                                    )}
                                >
                                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                                        <IconRoute size={15} strokeWidth={2} />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-xs font-semibold">{analysisOpen ? 'Close flow explorer' : 'Explore flow'}</span>
                                        <span className="mt-0.5 block text-[9px] font-normal text-muted-foreground">
                                            {analysisOpen ? 'Return to editing' : 'Test answers and inspect routes'}
                                        </span>
                                    </span>
                                </button>
                            </div>
                            {!featureFlags.hideAiQuestionImporter && (
                                <button
                                    onClick={() => {
                                        setIsActionsDropdownOpen(false);
                                        setIsAiImportOpen(true);
                                    }}
                                    disabled={isReadOnly}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium hover:bg-muted text-foreground transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <IconSparkles size={15} className="text-primary" />
                                    Import Questionnaire (AI)
                                </button>
                            )}
                            {canPublishLive && <div className="border-t border-border my-1" />}
                            {canPublishLive && survey?.status === 'PAUSED' ? (
                                <button
                                    onClick={() => {
                                        setIsActionsDropdownOpen(false);
                                        resume(surveyId);
                                    }}
                                    disabled={isReadOnly}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium hover:bg-amber-500/10 text-foreground transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <IconPlayerPlay size={15} className="text-amber-600" />
                                    Resume Survey
                                </button>
                            ) : canPublishLive && survey?.status !== 'DRAFT' && survey?.status !== 'CLOSED' ? (
                                <button
                                    onClick={() => {
                                        setIsActionsDropdownOpen(false);
                                        pause(surveyId);
                                    }}
                                    disabled={isReadOnly}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium hover:bg-amber-500/10 text-foreground transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <IconPlayerPause size={15} className="text-amber-600" />
                                    Pause Survey
                                </button>
                            ) : null}
                            {canPublishLive && survey?.status !== 'DRAFT' && survey?.status !== 'CLOSED' && (
                                <button
                                    onClick={() => {
                                        setIsActionsDropdownOpen(false);
                                        if (confirm("Are you sure you want to CLOSE this survey?")) {
                                            close(surveyId);
                                        }
                                    }}
                                    disabled={isReadOnly}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium hover:bg-destructive/10 text-foreground transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <IconBan size={15} className="text-destructive" />
                                    Close Survey
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Publish Button */}
            {canPublishLive ? (
                <div className="flex items-center gap-2">
                    <button
                        onClick={handlePublishLive}
                        disabled={isPublishing || (isLive && !hasChanges) || isReadOnly}
                        className={cn(
                            "px-4 py-2 text-xs font-bold uppercase tracking-wide rounded-lg shadow-lg transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed",
                            !isLive
                                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                : hasChanges
                                    ? "bg-amber-600 text-white hover:bg-amber-700"
                                    : "bg-emerald-600 text-white"
                        )}
                        title={
                            isReadOnly
                                ? "Cannot publish in Read Only mode"
                                : hasChanges
                                    ? "Configuration has changed since last publish"
                                    : undefined
                        }
                    >
                        {isPublishing ? <IconLoader2 className="animate-spin" size={14} /> : null}
                        {!isLive
                            ? "Publish to Live"
                            : hasChanges
                                ? "Update Live"
                                : "Live ✓"
                        }
                    </button>
                </div>
            ) : (
                <PermissionRequired scope="survey_studio:survey.publish" />
            )}
        </div>
    );
}
