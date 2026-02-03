"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
    IconSearch,
    IconChevronDown,
    IconChevronRight,
    IconLayoutSidebarLeftCollapse,
    IconLayoutSidebarRightCollapse,
    IconArrowLeft
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

import { NODE_DEFINITIONS, CATEGORY_CONFIG, NodeCategory } from "@/components/nodes/definitions";

// Dynamically group nodes by category
const nodeCategories = Object.keys(CATEGORY_CONFIG).map((catKey) => {
    const category = catKey as NodeCategory;
    return {
        id: category,
        label: CATEGORY_CONFIG[category].label,
        icon: CATEGORY_CONFIG[category].icon,
        items: NODE_DEFINITIONS.filter(node => node.category === category)
    };
}).filter(cat => cat.items.length > 0);

export default function SurveyNodeSidebar() {
    const router = useRouter();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [hoveredItem, setHoveredItem] = useState<{ label: string, description: string, x: number, y: number } | null>(null);
    const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
        "input": true,
        "choice": true,
        "logic": true,
        "media": true
    });

    const toggleCategory = (id: string) => {
        setOpenCategories(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const onDragStart = (event: React.DragEvent, nodeType: string, label: string) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.setData('application/reactflow/label', label);
        event.dataTransfer.effectAllowed = 'move';
    };

    // Filter items based on search
    const filteredCategories = nodeCategories.map(cat => ({
        ...cat,
        items: cat.items.filter(item =>
            item.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.description.toLowerCase().includes(searchTerm.toLowerCase())
        )
    })).filter(cat => cat.items.length > 0);

    return (
        <aside
            className={cn(
                "h-full bg-white dark:bg-zinc-900 border-r border-border flex flex-col shadow-sm z-10 transition-all duration-300 relative",
                isCollapsed ? "w-20" : "w-64"
            )}
        >
            {/* Header: Back, Logo, Toggle */}
            <div className={cn(
                "h-16 flex items-center border-b border-border shrink-0 transition-all duration-300",
                isCollapsed ? "justify-center gap-2 flex-col-reverse py-2 h-auto" : "justify-between px-3"
            )}>
                {/* Left Group: Back + Logo */}
                <div className={cn("flex items-center gap-3", isCollapsed && "flex-col")}>
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="Back to Dashboard"
                    >
                        <IconArrowLeft size={20} />
                    </button>

                    {/* Logo area - hidden when collapsed */}
                    <div className={cn(
                        "flex items-center gap-3 overflow-hidden transition-all duration-300",
                        isCollapsed ? "w-0 h-0 opacity-0 hidden" : "w-auto opacity-100"
                    )}>
                        <div className="h-9 w-9 rounded-lg overflow-hidden shrink-0 shadow-sm border border-border/10">
                            <img src="/logo.jpg" alt="AIM" className="h-full w-full object-contain" />
                        </div>
                        <span className="font-bold text-lg tracking-tight whitespace-nowrap">Builder</span>
                    </div>
                </div>

                {/* Toggle Button */}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors focus:outline-hidden"
                    title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                >
                    {isCollapsed ? <IconLayoutSidebarRightCollapse size={20} /> : <IconLayoutSidebarLeftCollapse size={18} />}
                </button>
            </div>

            {/* Search Bar - Hidden when collapsed */}
            <div className={cn(
                "p-4 border-b border-border space-y-3 transition-all duration-300 overflow-hidden",
                isCollapsed ? "h-0 p-0 border-none opacity-0" : "h-auto opacity-100"
            )}>
                <h2 className="font-semibold text-sm text-foreground">Survey Elements</h2>
                <div className="relative">
                    <IconSearch size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search elements..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 text-sm bg-muted/50 rounded-md border border-input focus:outline-hidden focus:ring-1 focus:ring-primary transition-all"
                    />
                </div>
            </div>

            {/* Scrollable List */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-4 scrollbar-thin scrollbar-thumb-border">
                {filteredCategories.length === 0 ? (
                    <div className="text-center text-xs text-muted-foreground py-8">
                        {!isCollapsed && "No elements found"}
                    </div>
                ) : (
                    filteredCategories.map((category) => (
                        <div key={category.id} className={cn("space-y-2", isCollapsed && "text-center")}>
                            {/* Category Header */}
                            {isCollapsed ? (
                                <div className="flex justify-center py-2 border-b border-dashed border-border/50 mb-2 group relative cursor-help">
                                    <category.icon size={16} className="text-muted-foreground" />
                                    {/* Tooltip for Category name on hover in collapsed mode */}
                                    <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-[10px] rounded border shadow-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                                        {category.label}
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => toggleCategory(category.id)}
                                    className="flex items-center gap-2 w-full text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider mb-2"
                                >
                                    {openCategories[category.id] ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                                    {category.label}
                                </button>
                            )}

                            {/* Items Grid */}
                            {(openCategories[category.id] || isCollapsed) && (
                                <div className={cn(
                                    "grid gap-2 transition-all duration-300",
                                    isCollapsed ? "grid-cols-1" : "grid-cols-2 animate-in slide-in-from-top-2"
                                )}>
                                    {category.items.map((item) => (
                                        <SidebarItem
                                            key={item.type}
                                            item={item}
                                            onDragStart={onDragStart}
                                            setHoveredItem={setHoveredItem}
                                            isCollapsed={isCollapsed}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>



            {/* Render Tooltip via Portal/Fixed Overlay */}
            {hoveredItem && (
                <div
                    className="fixed z-9999 w-48 p-2 bg-popover text-popover-foreground text-xs rounded-md shadow-lg border border-border pointer-events-none animate-in fade-in zoom-in-95 duration-150"
                    style={{
                        top: hoveredItem.y,
                        left: hoveredItem.x
                    }}
                >
                    <div className="font-semibold mb-0.5">{hoveredItem.label}</div>
                    <div className="text-[10px] text-muted-foreground">{hoveredItem.description}</div>
                    {/* Arrow (Visual only, simplified) */}
                    <div className="absolute top-1/2 -left-1.5 -translate-y-1/2 border-[6px] border-transparent border-r-popover"></div>
                </div>
            )}
        </aside>
    );
}

function SidebarItem({ item, onDragStart, setHoveredItem, isCollapsed }: {
    item: any,
    onDragStart: (e: React.DragEvent, type: string, label: string) => void,
    setHoveredItem: (item: any) => void,
    isCollapsed: boolean
}) {
    const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setHoveredItem({
            ...item,
            x: rect.right + 12, // Offset to right
            y: rect.top + (rect.height / 2) - 20 // Center vertically approx
        });
    };

    return (
        <div
            draggable
            onDragStart={(e) => onDragStart(e, item.type, item.label)}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={() => setHoveredItem(null)}
            className={cn(
                "group relative flex flex-col items-center justify-center p-2 gap-2 rounded-lg border border-border bg-card cursor-grab hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5 transition-all text-center",
                isCollapsed ? "py-3 bg-muted/20 border-transparent hover:bg-card" : ""
            )}
        >
            <div className={cn(
                "rounded-md bg-muted group-hover:bg-primary/10 group-hover:text-primary transition-colors flex items-center justify-center",
                isCollapsed ? "p-1.5" : "p-2"
            )}>
                <item.icon size={isCollapsed ? 22 : 20} stroke={1.5} />
            </div>
            {!isCollapsed && <span className="text-[10px] font-medium leading-tight line-clamp-2">{item.label}</span>}
        </div>
    );
}
