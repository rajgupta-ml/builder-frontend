"use client"
import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    IconCheck,
    IconAlertCircle,
    IconLoader2,
    IconPlayerPlay,
    IconShare,
    IconChartBar,
    IconFilter,
    IconSettings,
    IconHistory,
    IconPlayerPause,
    IconBan,
    IconDotsVertical
} from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import { useSurveyStore } from '@/src/store/useSurveyStore';
import { validateWorkflow } from '@/lib/validate-workflow';
import { toast } from 'sonner';
import { getStoredUserRole, hasPermission, PERMISSIONS } from '@/lib/permissions';
import type { UserRole } from '@/types/auth';

interface EditorHeaderProps {
    surveyId: string;
    setIsQuotaOpen: (open: boolean) => void;
    setIsSettingsOpen: (open: boolean) => void;
    setIsShareOpen: (open: boolean) => void;
    confirmNavigation?: () => boolean;
    onRunTest?: () => void;
}

export function EditorHeader({
    surveyId,
    setIsQuotaOpen,
    setIsSettingsOpen,
    setIsShareOpen,
    confirmNavigation = () => true,
    onRunTest
}: EditorHeaderProps) {
    const router = useRouter();
    const versionDropdownRef = useRef<HTMLDivElement>(null);
    const actionsDropdownRef = useRef<HTMLDivElement>(null);
    const [isVersionDropdownOpen, setIsVersionDropdownOpen] = useState(false);
    const [isActionsDropdownOpen, setIsActionsDropdownOpen] = useState(false);
    const [userRole, setUserRole] = useState<UserRole | undefined>(undefined);

    const {
        survey,
        versions,
        nodes,
        edges,
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
        setUserRole(getStoredUserRole());
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
    const canRunTest = hasPermission(userRole, PERMISSIONS.TEST_RUN);
    const canPublishLive = hasPermission(userRole, PERMISSIONS.SURVEY_PUBLISH_LIVE);

    const handlePublishLive = async () => {
        if (!workflowId) {
            toast.error("Please wait for draft to save first.");
            return;
        }

        const { isValid, errors } = validateWorkflow(nodes, edges);
        if (!isValid) {
            toast.error("Cannot Publish", {
                description: (
                    <ul className="list-disc pl-4 mt-2 text-xs">
                        {errors.slice(0, 5).map((e, i) => (
                            <li key={i}>{e.message}</li>
                        ))}
                        {errors.length > 5 && <li>...and {errors.length - 5} more</li>}
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

            {/* Primary Action */}
            {canRunTest && (
                <button
                    onClick={handleQuickTest}
                    disabled={isSyncingTest || isReadOnly}
                    className="flex items-center gap-2 px-3 py-2 bg-background/90 backdrop-blur-md border border-border/60 rounded-lg shadow-sm text-sm font-medium text-foreground hover:bg-muted transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    title={isReadOnly ? "Unavailable in read-only version view" : "Run test survey in a new tab"}
                >
                    {isSyncingTest ? (
                        <IconLoader2 className="animate-spin text-blue-500" size={16} />
                    ) : (
                        <IconPlayerPlay size={16} className="text-blue-500" />
                    )}
                    Run Test Survey
                </button>
            )}

            {/* More Menu */}
            <div className="relative" ref={actionsDropdownRef}>
                <button
                    onClick={() => setIsActionsDropdownOpen((prev) => !prev)}
                    className={cn(
                        "flex items-center gap-2 px-3 py-2 bg-background/90 backdrop-blur-md border border-border/60 rounded-lg shadow-sm text-xs font-medium hover:bg-muted transition-all",
                        isActionsDropdownOpen && "bg-muted shadow-inner"
                    )}
                    title="More actions"
                >
                    <IconDotsVertical size={16} className="text-muted-foreground" />
                    <span>More</span>
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
                                    if (confirmNavigation()) {
                                        router.push(`/dashboard/surveys/${surveyId}/metrics`);
                                    }
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium hover:bg-muted text-foreground transition-all"
                            >
                                <IconChartBar size={15} />
                                Metrics
                            </button>
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

            <div className="w-px h-6 bg-border mx-2" />

            {/* Version History */}
            <div className="relative" ref={versionDropdownRef}>
                <button
                    onClick={() => setIsVersionDropdownOpen(!isVersionDropdownOpen)}
                    className={cn(
                        "flex items-center gap-2 px-3 py-2 bg-background/90 backdrop-blur-md border border-border/60 rounded-lg shadow-sm text-xs font-medium hover:bg-muted transition-all",
                        isVersionDropdownOpen && "bg-muted shadow-inner"
                    )}
                >
                    <IconHistory size={16} className="text-muted-foreground" />
                    <span className="max-w-[100px] truncate">
                        {selectedVersionId ? `Version ${versions.find(v => v.id === selectedVersionId)?.version || '?'}` : 'Current Draft'}
                    </span>
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

            {/* Publish Button */}
            {canPublishLive && (
                <div className="flex items-center gap-2">
                    <button
                        onClick={handlePublishLive}
                        disabled={isPublishing || (isLive && !hasChanges) || isReadOnly}
                        className={cn(
                            "px-4 py-2 text-xs font-bold uppercase tracking-wide rounded-full shadow-lg transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed",
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
            )}
        </div>
    );
}
