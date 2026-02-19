"use client"
import { IconX, IconPlayerPlay, IconCopy, IconExternalLink, IconWorld, IconAlertCircle } from '@tabler/icons-react';
import { toast } from 'sonner';
import { safeOpenExternal } from '@/lib/safe-format';

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    testLink: string;
    liveLink: string;
    isLive: boolean;
}

export function ShareModal({ isOpen, onClose, testLink, liveLink, isLive }: ShareModalProps) {
    if (!isOpen) return null;

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Link copied!");
    };

    const openLink = (url: string) => {
        if (!safeOpenExternal(url)) {
            toast.error("Invalid link. Please check URL configuration.");
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div
                className="bg-background border border-border shadow-2xl rounded-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-muted/30">
                    <h3 className="font-semibold text-lg">Share Survey</h3>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded-full">
                        <IconX size={20} />
                    </button>
                </div>
                <div className="p-6 space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                            <IconPlayerPlay size={14} /> Test Link (Draft)
                        </label>
                        <div className="flex gap-2">
                            <input readOnly value={testLink} className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono" />
                            <button onClick={() => copyToClipboard(testLink)} className="p-2 bg-background border border-border hover:bg-muted rounded-lg">
                                <IconCopy size={18} />
                            </button>
                            <button onClick={() => openLink(testLink)} className="p-2 bg-background border border-border hover:bg-muted rounded-lg">
                                <IconExternalLink size={18} />
                            </button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-2">
                            <IconWorld size={14} /> Live Link (Public)
                        </label>
                        {isLive ? (
                            <div className="flex gap-2 animate-in slide-in-from-top-1">
                                <input readOnly value={liveLink} className="flex-1 bg-emerald-50/50 border border-emerald-200/50 rounded-lg px-3 py-2 text-sm text-foreground font-mono" />
                                <button onClick={() => copyToClipboard(liveLink)} className="p-2 bg-background border border-border hover:bg-muted rounded-lg">
                                    <IconCopy size={18} />
                                </button>
                                <button onClick={() => openLink(liveLink)} className="p-2 bg-background border border-border hover:bg-muted rounded-lg">
                                    <IconExternalLink size={18} />
                                </button>
                            </div>
                        ) : (
                            <div className="p-4 bg-muted/50 border border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 text-center">
                                <div className="p-2 bg-background rounded-full border border-border shadow-sm">
                                    <IconAlertCircle className="text-muted-foreground" size={20} />
                                </div>
                                <p className="text-sm font-medium">Production link is locked</p>
                                <p className="text-[10px] text-muted-foreground max-w-[200px]">Publish your survey to the Live environment to generate a public link.</p>
                            </div>
                        )}
                    </div>
                </div>
                <div className="p-4 bg-muted/30 border-t border-border flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 bg-white border border-border text-sm font-medium rounded-md">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
