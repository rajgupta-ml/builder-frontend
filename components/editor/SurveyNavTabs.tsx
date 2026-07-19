"use client"
import { useRouter, usePathname } from 'next/navigation';
import { IconEdit, IconChartBar, IconShieldLock } from '@tabler/icons-react';
import { cn } from '@/lib/utils';

type SurveyTabKey = 'builder' | 'metrics' | 'quality';

interface SurveyNavTabsProps {
    surveyId: string;
    confirmNavigation?: () => boolean;
    className?: string;
    /** 'pill' floats on the builder canvas; 'underline' weaves into a page header's divider. */
    variant?: 'pill' | 'underline';
}

const TABS: { key: SurveyTabKey; label: string; icon: typeof IconEdit; path: (id: string) => string }[] = [
    { key: 'builder', label: 'Builder', icon: IconEdit, path: (id) => `/dashboard/surveys/${id}` },
    { key: 'metrics', label: 'Metrics', icon: IconChartBar, path: (id) => `/dashboard/surveys/${id}/metrics` },
    { key: 'quality', label: 'Quality', icon: IconShieldLock, path: (id) => `/dashboard/surveys/${id}/quality` },
];

function getActiveTab(pathname: string, surveyId: string): SurveyTabKey {
    if (pathname === `/dashboard/surveys/${surveyId}/quality`) return 'quality';
    if (pathname === `/dashboard/surveys/${surveyId}/metrics`) return 'metrics';
    return 'builder';
}

export function SurveyNavTabs({ surveyId, confirmNavigation = () => true, className, variant = 'pill' }: SurveyNavTabsProps) {
    const router = useRouter();
    const pathname = usePathname();
    const activeTab = getActiveTab(pathname || '', surveyId);

    const navigate = (key: SurveyTabKey, path: string) => {
        if (key === activeTab) return;
        if (confirmNavigation()) {
            router.push(path);
        }
    };

    if (variant === 'underline') {
        return (
            <nav
                aria-label="Survey sections"
                className={cn("flex items-center gap-6 border-b border-border/60", className)}
            >
                {TABS.map(({ key, label, icon: Icon, path }) => {
                    const isActive = key === activeTab;
                    return (
                        <button
                            key={key}
                            onClick={() => navigate(key, path(surveyId))}
                            onMouseEnter={() => router.prefetch(path(surveyId))}
                            className={cn(
                                "-mb-px flex items-center gap-1.5 border-b-2 px-1 pb-3 text-sm font-medium transition-colors",
                                isActive
                                    ? "border-primary text-foreground"
                                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                            )}
                            aria-current={isActive ? 'page' : undefined}
                        >
                            <Icon size={16} strokeWidth={isActive ? 2.1 : 1.7} />
                            {label}
                        </button>
                    );
                })}
            </nav>
        );
    }

    return (
        <nav
            aria-label="Survey sections"
            className={cn(
                "inline-flex h-10 items-center gap-1 rounded-lg border border-border/60 bg-background/90 p-1 shadow-sm backdrop-blur-md",
                className
            )}
        >
            {TABS.map(({ key, label, icon: Icon, path }) => {
                const isActive = key === activeTab;
                return (
                    <button
                        key={key}
                        onClick={() => navigate(key, path(surveyId))}
                        onMouseEnter={() => router.prefetch(path(surveyId))}
                        className={cn(
                            "relative flex h-8 items-center gap-1.5 rounded-md px-4 text-xs font-semibold tracking-wide transition-all duration-200",
                            isActive
                                ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                        aria-current={isActive ? 'page' : undefined}
                    >
                        <Icon size={15} strokeWidth={isActive ? 2.2 : 1.8} />
                        {label}
                    </button>
                );
            })}
        </nav>
    );
}
