import { useState } from 'react';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';
import { IconLoader2, IconRocket, IconAlertTriangle, IconCheck } from '@tabler/icons-react';

interface SurveyPublishModalProps {
    isOpen: boolean;
    onClose: () => void;
    surveyId: string;
    onPublishSuccess: () => void;
}

export function SurveyPublishModal({ isOpen, onClose, surveyId, onPublishSuccess }: SurveyPublishModalProps) {
    const [mode, setMode] = useState<'TEST' | 'LIVE'>('TEST');
    const [isLoading, setIsLoading] = useState(false);

    if (!isOpen) return null;

    const handlePublish = async () => {
        setIsLoading(true);
        try {
            await apiClient.post(`/surveys/${surveyId}/publish`, { mode });

            toast.success(`Successfully published to ${mode} mode!`);
            onPublishSuccess();
            onClose();
        } catch (error: any) {
            console.error("Publish failed", error);
            const msg = error?.response?.data?.error || "Failed to publish survey";
            toast.error(msg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div
                className="bg-background border border-border shadow-2xl rounded-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-muted/30">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                        <IconRocket className="text-primary" size={20} />
                        Publish Survey
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                        disabled={isLoading}
                    >
                        ✕
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="space-y-4">
                        <label className="text-sm font-medium">Select Environment</label>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => setMode('TEST')}
                                className={`relative p-4 rounded-xl border-2 transition-all text-left ${mode === 'TEST'
                                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20'
                                        : 'border-border hover:border-blue-200'
                                    }`}
                            >
                                <div className="font-bold text-blue-600 mb-1">Test Mode</div>
                                <div className="text-xs text-muted-foreground">Safe for previewing. Updates the <code className="bg-muted px-1 rounded">/test-slug</code> link immediately.</div>
                                {mode === 'TEST' && <div className="absolute top-3 right-3 text-blue-500"><IconCheck size={16} /></div>}
                            </button>

                            <button
                                onClick={() => setMode('LIVE')}
                                className={`relative p-4 rounded-xl border-2 transition-all text-left ${mode === 'LIVE'
                                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/20'
                                        : 'border-border hover:border-emerald-200'
                                    }`}
                            >
                                <div className="font-bold text-emerald-600 mb-1">Live Mode</div>
                                <div className="text-xs text-muted-foreground">Publicly accessible. Updates the main <code className="bg-muted px-1 rounded">/slug</code> link.</div>
                                {mode === 'LIVE' && <div className="absolute top-3 right-3 text-emerald-500"><IconCheck size={16} /></div>}
                            </button>
                        </div>
                    </div>

                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-start gap-3">
                        <IconAlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={16} />
                        <div className="text-xs text-amber-800 dark:text-amber-200">
                            Publishing will push your latest <strong>Design</strong>, <strong>Quotas</strong>, and <strong>Settings</strong> to the customized high-performance edge runner.
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-muted/30 border-t border-border flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-4 py-2 bg-background border border-border text-sm font-medium rounded-md shadow-sm hover:bg-muted transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handlePublish}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-md shadow-md hover:bg-primary/90 transition-all disabled:opacity-70"
                    >
                        {isLoading ? <IconLoader2 className="animate-spin" size={16} /> : <IconRocket size={16} />}
                        Publish to {mode}
                    </button>
                </div>
            </div>
        </div>
    );
}
