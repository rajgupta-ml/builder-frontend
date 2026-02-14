import React, { useEffect, useState } from 'react';
import apiClient from '@/lib/api-client';
import { IconPhoto, IconLoader2 } from '@tabler/icons-react';
import { cn } from '@/lib/utils';

interface MediaPreviewProps {
    storageKey?: string;
    type: 'image' | 'video' | 'audio';
    className?: string;
    alt?: string;
    controls?: boolean;
}

export function MediaPreview({ storageKey, type, className, alt = 'Media preview', controls = true }: MediaPreviewProps) {
    const [url, setUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!storageKey) {
            setUrl(null);
            return;
        }

        const fetchSignedUrl = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await apiClient.get('/storage/view-url', {
                    params: { key: storageKey }
                });
                setUrl(res.data.signedUrl);
            } catch (err) {
                console.error("Failed to fetch signed URL:", err);
                setError("Failed to load media");
            } finally {
                setLoading(false);
            }
        };

        fetchSignedUrl();
    }, [storageKey]);

    if (loading) {
        return (
            <div className={cn("flex items-center justify-center bg-muted rounded-md", className)}>
                <IconLoader2 size={24} className="animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error || (!loading && !url)) {
        return (
            <div className={cn("flex flex-col items-center justify-center bg-muted rounded-md gap-1", className)}>
                <IconPhoto size={24} className="opacity-50 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">{error || "No media"}</span>
            </div>
        );
    }

    if (type === 'image') {
        return <img src={url!} alt={alt} className={cn("object-cover", className)} />;
    }

    if (type === 'video') {
        return <video src={url!} className={cn("object-cover", className)} controls={controls} muted />;
    }

    if (type === 'audio') {
        return (
            <div className={cn("flex flex-col items-center gap-1 p-2 bg-background border rounded-md", className)}>
                <IconPhoto size={32} className="text-primary opacity-80" />
                <audio src={url!} controls={controls} className="w-full h-8" />
            </div>
        );
    }

    return null;
}
