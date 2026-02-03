"use client";
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    IconLayoutDashboard,
    IconClipboardList,
    IconChartBar,
    IconSettings,
    IconUsers,
    IconHelpCircle,
    IconChevronLeft,
    IconChevronRight
} from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';

interface SidebarItemProps {
    href: string;
    icon: React.ElementType;
    label: string;
    active?: boolean;
    collapsed?: boolean;
}

const SidebarItem = ({ href, icon: Icon, label, active, collapsed }: SidebarItemProps) => {
    return (
        <Link
            href={href}
            className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group relative",
                active
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
        >
            <Icon size={22} className={cn("shrink-0", active ? "text-white" : "group-hover:scale-110 transition-transform")} />
            {!collapsed && (
                <span className="font-semibold text-sm tracking-tight">{label}</span>
            )}
            {collapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap">
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
        { href: '/dashboard/users', icon: IconUsers, label: 'Respondents' },
    ];

    const bottomItems = [
        { href: '/dashboard/settings', icon: IconSettings, label: 'Settings' },
        { href: '/dashboard/help', icon: IconHelpCircle, label: 'Help & Support' },
    ];

    return (
        <aside
            className={cn(
                "h-screen bg-card border-r border-border flex flex-col transition-all duration-300 relative z-40",
                collapsed ? "w-[80px]" : "w-[260px]"
            )}
        >
            {/* Logo Area */}
            <div className="p-6 flex items-center gap-3 overflow-hidden">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
                    <IconLayoutDashboard className="text-white" size={18} />
                </div>
                {!collapsed && (
                    <span className="font-black text-xl tracking-tighter uppercase italic">SurveyChamp</span>
                )}
            </div>

            {/* Collapse Toggle */}
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="absolute -right-3 top-20 w-6 h-6 bg-background border border-border rounded-full flex items-center justify-center shadow-sm hover:bg-muted transition-colors z-50"
            >
                {collapsed ? <IconChevronRight size={14} /> : <IconChevronLeft size={14} />}
            </button>

            <nav className="flex-1 px-4 py-8 space-y-2">
                <div className={cn("text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-4 px-2", collapsed && "text-center")}>
                    {collapsed ? '...' : 'Menu'}
                </div>
                {menuItems.map((item) => (
                    <SidebarItem
                        key={item.href}
                        {...item}
                        active={pathname === item.href}
                        collapsed={collapsed}
                    />
                ))}
            </nav>

            <div className="px-4 py-6 space-y-2 border-t border-border">
                {bottomItems.map((item) => (
                    <SidebarItem
                        key={item.href}
                        {...item}
                        active={pathname === item.href}
                        collapsed={collapsed}
                    />
                ))}
            </div>
        </aside>
    );
};
