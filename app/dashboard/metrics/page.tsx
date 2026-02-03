"use client";
import React from 'react';
import { IconChartBar } from '@tabler/icons-react';

export default function GlobalMetricsPage() {
    return (
        <div className="p-8 md:p-12 flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-primary/5">
                <IconChartBar size={32} strokeWidth={1.5} />
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-3">Global Analytics</h1>
            <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
                This dashboard will aggregate metrics from all your active surveys once statistical significance is reached.
            </p>
        </div>
    );
}
