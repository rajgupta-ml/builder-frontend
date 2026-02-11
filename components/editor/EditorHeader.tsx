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
    IconBan
} from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import { useSurveyStore } from '@/src/store/useSurveyStore';
import { validateWorkflow } from '@/lib/validate-workflow';
import { toast } from 'sonner';

interface EditorHeaderProps {
    surveyId: string;
    setIsQuotaOpen: (open: boolean) => void;
    setIsSettingsOpen: (open: boolean) => void;
    setIsShareOpen: (open: boolean) => void;
}

export function EditorHeader({ surveyId, setIsQuotaOpen, setIsSettingsOpen, setIsShareOpen }: EditorHeaderProps) {
    const router = useRouter();
    const versionDropdownRef = useRef<HTMLDivElement>(null);
    const [isVersionDropdownOpen, setIsVersionDropdownOpen] = useState(false);

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
        publish,
        pause,
        close,
        resume,
        selectVersion
    } = useSurveyStore();

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (versionDropdownRef.current && !versionDropdownRef.current.contains(event.target as Node)) {
                setIsVersionDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const isLive = survey?.status === 'LIVE' || survey?.status === 'PAUSED';

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
                            <span className="text-foreground">Saved</span>
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

            {/* Actions Group */}
            <div className="flex items-center gap-1 bg-background/90 backdrop-blur-md border border-border/60 p-1 rounded-lg shadow-sm">
                <button
                    onClick={() => router.push(`/dashboard/surveys/${surveyId}/metrics`)}
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-all"
                    title="Metrics"
                >
                    <IconChartBar size={18} />
                </button>
                <button
                    onClick={() => setIsQuotaOpen(true)}
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-all"
                    title="Traffic Control (Quotas)"
                >
                    <IconFilter size={18} />
                </button>
                <button
                    onClick={() => setIsSettingsOpen(true)}
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-all"
                    title="Settings"
                >
                    <IconSettings size={18} />
                </button>

                <div className="w-px h-4 bg-border mx-1" />

                <button
                    onClick={() => setIsShareOpen(true)}
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-all"
                    title="Share Survey"
                >
                    <IconShare size={18} />
                </button>

                <div className="w-px h-4 bg-border mx-1" />

                <button
                    onClick={handleQuickTest}
                    disabled={isSyncingTest}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted rounded-md transition-all disabled:opacity-50"
                >
                    {isSyncingTest ? (
                        <IconLoader2 className="animate-spin text-blue-500" size={16} />
                    ) : (
                        <IconPlayerPlay size={16} className="text-blue-500" />
                    )}
                    Test
                </button>
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

            <div className="w-px h-6 bg-border mx-2" />

            {/* Lifecycle Actions */}
            {survey?.status !== 'DRAFT' && (
                <div className="flex items-center gap-1 mr-2">
                    {survey?.status === 'PAUSED' ? (
                        <button
                            onClick={() => resume(surveyId)}
                            className="p-2 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 rounded-full border border-amber-500/20 transition-all"
                            title="Resume Survey"
                        >
                            <IconPlayerPlay size={18} />
                        </button>
                    ) : survey?.status !== 'CLOSED' ? (
                        <button
                            onClick={() => pause(surveyId)}
                            className="p-2 text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10 rounded-full transition-all"
                            title="Pause Survey"
                        >
                            <IconPlayerPause size={18} />
                        </button>
                    ) : null}

                    {survey?.status !== 'CLOSED' && (
                        <button
                            onClick={() => {
                                if (confirm("Are you sure you want to CLOSE this survey?")) {
                                    close(surveyId);
                                }
                            }}
                            className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-all"
                            title="Close Survey"
                        >
                            <IconBan size={18} />
                        </button>
                    )}
                </div>
            )}

            {/* Publish Button */}
            <div className="flex items-center gap-2">
                <button
                    onClick={handlePublishLive}
                    disabled={isPublishing || (isLive && !hasChanges)}
                    className={cn(
                        "px-4 py-2 text-xs font-bold uppercase tracking-wide rounded-full shadow-lg transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed",
                        !isLive
                            ? "bg-primary text-primary-foreground hover:bg-primary/90"
                            : hasChanges
                                ? "bg-amber-600 text-white hover:bg-amber-700"
                                : "bg-emerald-600 text-white"
                    )}
                    title={hasChanges ? "Configuration has changed since last publish" : undefined}
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
        </div>
    );
}
