"use client";
import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import logo from "@/public/logo.jpg"
import { cn } from "@/lib/utils";
import {
    IconChartBar,
    IconSettings,
    IconClipboardList,
    IconChevronLeft,
    IconChevronRight
} from '@tabler/icons-react';
import { jetBrainsMono } from '@/app/dashboard/layout';

interface SidebarItemProps {
    href: string;
    icon: any;
    label: string;
    active?: boolean;
    collapsed?: boolean;
}

const SidebarItem = ({ href, icon: Icon, label, active, collapsed }: SidebarItemProps) => {
    return (
        <Link
            href={href}
            className={cn(
                "flex items-center gap-3 px-3 py-2 text-sm transition-colors group relative border-l-2",
                active
                    ? "bg-primary/5 font-medium text-primary border-primary"
                    : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
        >
            <Icon size={16} strokeWidth={2} className={cn("shrink-0", active ? "text-primary" : "")} />
            {!collapsed && (
                <span>{label}</span>
            )}
            {collapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-foreground text-background text-[10px] uppercase tracking-widest shadow-none opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap border border-border">
                    {label}
                </div>
            )}
        </Link>
    );
};

export const DashboardSidebar = () => {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = React.useState(false);

    const menuItems = [
        { href: '/dashboard', icon: IconClipboardList, label: 'My Surveys' },
        { href: '/dashboard/metrics', icon: IconChartBar, label: 'Global Analytics' },
    ];

    const bottomItems = [
        { href: '/dashboard/settings', icon: IconSettings, label: 'Settings' },
    ];

    return (
        <aside
            className={cn(
                "h-screen bg-background border-r border-border/60 flex flex-col transition-all duration-300 relative z-40 shrink-0",
                collapsed ? "w-[80px]" : "w-64"
            )}
        >
            {/* Logo Area */}
            <div className="h-16 flex items-center px-[22px] overflow-hidden">
                <div className="w-9 h-9 flex items-center justify-center bg-muted/20 rounded-sm overflow-hidden relative shrink-0">
                    <Image
                        src={logo}
                        alt="Survey Studios Logo"
                        width={28}
                        height={28}
                        priority
                        className="object-contain"
                    />
                </div>
                {!collapsed && (
                    <span className="font-bold truncate">Survey Studios</span>
                )}
            </div>

            {/* Collapse Toggle */}
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="absolute -right-3 top-20 w-6 h-6 bg-background border border-border/60 rounded-full flex items-center justify-center shadow-sm hover:bg-muted transition-colors z-50"
            >
                {collapsed ? <IconChevronRight size={14} /> : <IconChevronLeft size={14} />}
            </button>

            <nav className="py-6 flex-1 px-4 space-y-8">
                <div>
                    <div className={cn(`px-2 text-[10px] text-muted-foreground uppercase tracking-widest mb-3 ${jetBrainsMono.className}`, collapsed && "text-center")}>
                        {collapsed ? 'DIR' : 'Directory'}
                    </div>
                    <div className="space-y-1">
                        {menuItems.map((item) => (
                            <SidebarItem
                                key={item.href}
                                {...item}
                                active={pathname === item.href}
                                collapsed={collapsed}
                            />
                        ))}
                    </div>
                </div>
            </nav>

            <div className="p-4 border-t border-border/60">
                <div className="space-y-1">
                    {bottomItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2 text-sm transition-colors group relative border-l-2",
                                pathname === item.href
                                    ? "bg-primary/5 font-medium text-primary border-primary"
                                    : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                            )}
                        >
                            <item.icon size={16} strokeWidth={2} />
                            {!collapsed && <span>{item.label}</span>}
                            {collapsed && (
                                <div className="absolute left-full ml-2 px-2 py-1 bg-foreground text-background text-[10px] uppercase tracking-widest shadow-none opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap border border-border">
                                    {item.label}
                                </div>
                            )}
                        </Link>
                    ))}
                </div>
            </div>
        </aside>
    );
};
