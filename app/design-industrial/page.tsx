"use client";

import React from "react";
import {
    BarChart2,
    ClipboardList,
    Settings,
    Users,
    LayoutDashboard,
    HelpCircle,
    Bell,
    Search,
    Plus,
    ChevronRight,
    UserCircle,
    FolderOpen
} from "lucide-react";

import { Inter, Space_Grotesk, Space_Mono, JetBrains_Mono, IBM_Plex_Mono } from "next/font/google";

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["400", "600"] });
const spaceMono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"] });
const jetBrainsMono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"] });
const ibmPlexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["300", "400", "500", "600"] });

export default function IndustrialMinimalShowcase() {
    const menuItems = [
        { name: "Surveys", icon: ClipboardList },
        { name: "Analytics", icon: BarChart2 },
        { name: "Respondents", icon: Users },
    ];

    const bottomItems = [
        { name: "Settings", icon: Settings },
        { name: "Help", icon: HelpCircle },
    ];

    return (
        <div className={`min-h-screen bg-background text-foreground py-16 px-4 md:px-12 space-y-32 ${inter.className}`}>
            <div className="max-w-4xl mx-auto space-y-6 text-center">
                <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">Industrial Minimal</h1>
                <p className="text-lg text-muted-foreground mx-auto max-w-2xl">
                    Exploring technical, utilitarian aesthetics through the lens of minimalism and diverse typography.
                </p>
            </div>

            <div className="max-w-7xl mx-auto space-y-32">

                {/* Variation 1: Swiss Industrial / Technical */}
                <div className="space-y-6">
                    <div className="space-y-2 max-w-2xl">
                        <h2 className={`text-2xl font-semibold`}>1. Swiss Technical</h2>
                        <p className="text-muted-foreground text-sm">Clean, hyper-legible, pure utility. Uses <span className="font-semibold">Inter</span> for structure and <span className={jetBrainsMono.className}>JetBrains Mono</span> for data. Minimal 1px borders, generous padding, absence of heavy backgrounds.</p>
                    </div>

                    <div className={`w-full h-[700px] border border-border/60 bg-background flex shadow-sm rounded-lg overflow-hidden`}>
                        {/* Sidebar */}
                        <div className="w-64 border-r border-border/60 flex flex-col shrink-0 bg-background">
                            <div className="h-16 flex items-center px-6 gap-3">
                                <div className="w-2 h-2 rounded-full bg-primary" />
                                <span className={`font-medium tracking-tight`}>Survey_Studio</span>
                            </div>

                            <div className="py-6 flex-1 px-4 space-y-8">
                                <div>
                                    <div className={`px-2 text-[10px] text-muted-foreground uppercase tracking-widest mb-3 ${jetBrainsMono.className}`}>Directory</div>
                                    <div className="space-y-1">
                                        {menuItems.map((item, i) => (
                                            <button key={item.name} className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${i === 0 ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"}`}>
                                                <div className="flex items-center gap-3">
                                                    <item.icon size={16} strokeWidth={2} />
                                                    {item.name}
                                                </div>
                                                {i === 0 && <span className={`${jetBrainsMono.className} text-[10px] bg-background border border-border rounded px-1`}>12</span>}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 border-t border-border/60">
                                <div className="space-y-1">
                                    {bottomItems.map((item) => (
                                        <button key={item.name} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 rounded-md transition-colors">
                                            <item.icon size={16} strokeWidth={2} />
                                            {item.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Main */}
                        <div className="flex-1 flex flex-col bg-background relative">
                            <div className="h-16 border-b border-border/60 flex items-center justify-between px-8 bg-background">
                                <div className="flex items-center text-sm">
                                    <Search className="text-muted-foreground mr-3" size={16} />
                                    <input placeholder="Search records..." className="bg-transparent outline-none placeholder:text-muted-foreground/60 w-64" />
                                </div>
                                <div className="flex gap-4">
                                    <button className="flex items-center gap-2 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 transition-colors px-4 py-1.5 rounded-full">
                                        <Plus size={14} /> New Survey
                                    </button>
                                </div>
                            </div>

                            <div className="p-10 flex-1 overflow-auto">
                                <header className="mb-10 flex items-baseline justify-between">
                                    <div>
                                        <h1 className="text-2xl font-semibold mb-2">Active Surveys</h1>
                                        <p className={`text-xs text-muted-foreground ${jetBrainsMono.className}`}>Overview of running data collection tasks.</p>
                                    </div>
                                </header>

                                <div className="border border-border/60 rounded-xl overflow-hidden bg-background">
                                    <table className="w-full text-left table-fixed">
                                        <thead>
                                            <tr className={`border-b border-border/60 bg-muted/30 text-[10px] uppercase text-muted-foreground tracking-wider ${jetBrainsMono.className}`}>
                                                <th className="px-6 py-4 font-normal w-1/3">Survey ID / Name</th>
                                                <th className="px-6 py-4 font-normal">Status</th>
                                                <th className="px-6 py-4 font-normal text-right">Responses</th>
                                                <th className="px-6 py-4 font-normal text-right">Modified</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/60">
                                            {[1, 2, 3, 4].map(i => (
                                                <tr key={i} className="hover:bg-muted/20 transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <div className={`text-xs text-muted-foreground mb-1 ${jetBrainsMono.className}`}>SRV-2026-00{i}</div>
                                                        <div className="text-sm font-medium">Customer Feedback Q{i}</div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`${jetBrainsMono.className} text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-0.5 rounded-md`}>LIVE</span>
                                                    </td>
                                                    <td className={`px-6 py-4 text-right text-sm ${jetBrainsMono.className}`}>
                                                        1,20{i}
                                                    </td>
                                                    <td className={`px-6 py-4 text-right text-xs text-muted-foreground ${jetBrainsMono.className} group-hover:text-foreground transition-colors`}>
                                                        12.04.26
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Variation 2: Schematic Space */}
                <div className="space-y-6">
                    <div className="space-y-2 max-w-2xl">
                        <h2 className={`text-2xl font-bold ${spaceGrotesk.className}`}>2. Schematic Minimal</h2>
                        <p className="text-muted-foreground text-sm">Geometric and sparse. <span className={spaceGrotesk.className}>Space Grotesk</span> for bold, rigid headers, <span className={spaceMono.className}>Space Mono</span> for raw input data. No solid backgrounds, only thin structural dividers.</p>
                    </div>

                    <div className={`w-full h-[700px] border border-border bg-background flex ${spaceGrotesk.className}`}>
                        {/* Sidebar */}
                        <div className="w-72 border-r border-border flex flex-col z-10 shrink-0">
                            <div className="h-20 border-b border-border flex items-center px-8 relative">
                                <span className={`font-bold tracking-tight text-xl uppercase`}>Workspace</span>
                            </div>

                            <div className="flex-1 py-8 flex flex-col gap-6">
                                <div className="space-y-1 px-4">
                                    {menuItems.map((item, i) => (
                                        <button key={item.name} className={`w-full flex items-center gap-4 px-4 py-3 text-sm transition-all border border-transparent ${i === 0 ? "border-foreground text-foreground" : "text-muted-foreground hover:border-border hover:text-foreground"}`}>
                                            <item.icon size={18} strokeWidth={1.5} />
                                            <span className={`${i === 0 ? 'font-bold' : 'font-normal'} tracking-wide`}>{item.name.toUpperCase()}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="p-8 border-t border-border space-y-4">
                                {bottomItems.map((item) => (
                                    <button key={item.name} className="flex items-center gap-3 text-muted-foreground hover:text-foreground text-xs font-bold uppercase tracking-wider transition-colors">
                                        <item.icon size={16} strokeWidth={1.5} />
                                        {item.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Main */}
                        <div className="flex-1 flex flex-col relative overflow-hidden">
                            <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-size-[64px_64px] pointer-events-none -z-10" />

                            <div className="h-20 border-b border-border flex items-center justify-between px-10 relative">
                                <div className={`flex items-center gap-4 ${spaceMono.className} text-xs text-muted-foreground`}>
                                    <span>[ /ROOT /SURVEYS ]</span>
                                </div>

                                <button className="h-10 px-6 border border-foreground text-foreground font-bold text-xs tracking-widest hover:bg-foreground hover:text-background transition-colors flex items-center gap-2 uppercase">
                                    <Plus size={16} /> Init Record
                                </button>
                            </div>

                            <div className="flex-1 p-10 overflow-y-auto">
                                <div className="flex justify-between items-end mb-12 border-b border-border pb-6">
                                    <h1 className="text-4xl font-bold tracking-tighter uppercase">
                                        Data Collection
                                    </h1>
                                </div>

                                <div className="grid grid-cols-2 xl:grid-cols-4 gap-6">
                                    {[1, 2, 3, 4].map((i) => (
                                        <div key={i} className="group border border-border bg-background p-6 flex flex-col hover:border-foreground transition-colors h-56 relative">
                                            <div className="absolute top-0 left-0 w-2 h-2 border-r border-b border-border group-hover:border-foreground transition-colors" />

                                            <div className="flex justify-between items-start mb-6">
                                                <FolderOpen size={24} strokeWidth={1} className="text-muted-foreground group-hover:text-foreground transition-colors" />
                                                <span className={`text-[10px] border border-border px-2 py-1 uppercase ${spaceMono.className}`}>Index 0{i}</span>
                                            </div>

                                            <h3 className="text-lg font-bold uppercase mb-2">Project {i} Data</h3>
                                            <div className="mt-auto pt-4 border-t border-border flex justify-between items-center">
                                                <span className={`text-xs text-muted-foreground ${spaceMono.className}`}>ENTRIES: 49{i}</span>
                                                <ChevronRight size={16} className="text-muted-foreground group-hover:text-foreground" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Variation 3: IBM Print */}
                <div className="space-y-6">
                    <div className="space-y-2 max-w-2xl">
                        <h2 className={`text-2xl font-medium ${ibmPlexMono.className}`}>3. IBM Print Minimal</h2>
                        <p className="text-muted-foreground text-sm">Ultra-light, document-style aesthetic. Uses <span className={ibmPlexMono.className}>IBM Plex Mono</span> exclusively. Characterized by very thin lines, uppercase tagging, and extreme negative space. Feels like a printed technical manual.</p>
                    </div>

                    <div className={`w-full h-[700px] border bg-[#f9f9f9] dark:bg-[#090909] flex text-foreground overflow-hidden ${ibmPlexMono.className}`}>

                        {/* Sidebar */}
                        <div className="w-56 border-r border-border/40 flex flex-col shrink-0">
                            <div className="h-14 border-b border-border/40 flex items-center px-6">
                                <span className="text-xs uppercase tracking-widest opacity-60">ID:// SYS.CTRL</span>
                            </div>

                            <div className="p-6 flex-1 space-y-6">
                                <div>
                                    <div className="text-[10px] uppercase opacity-40 mb-3 tracking-widest">Views</div>
                                    <div className="space-y-2">
                                        {menuItems.map((item, i) => (
                                            <button key={item.name} className={`w-full flex justify-between items-center text-xs tracking-wide group ${i === 0 ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}>
                                                <span className="uppercase">{item.name}</span>
                                                {i === 0 && <span className="opacity-100">-</span>}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 border-t border-border/40">
                                <div className="space-y-2">
                                    {bottomItems.map((item) => (
                                        <button key={item.name} className="w-full flex justify-between text-xs tracking-wide text-muted-foreground hover:text-foreground">
                                            <span className="uppercase">{item.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Main */}
                        <div className="flex-1 flex flex-col">
                            <div className="h-14 border-b border-border/40 flex items-center justify-between px-8">
                                <div className="flex items-center gap-8 text-xs text-muted-foreground">
                                    <button className="uppercase hover:text-foreground">Search</button>
                                    <button className="uppercase hover:text-foreground">Filter</button>
                                </div>
                                <button className="text-[10px] uppercase tracking-widest border border-foreground/20 px-4 py-1.5 hover:bg-foreground hover:text-background transition-colors">
                                    + Create
                                </button>
                            </div>

                            <div className="p-12 flex-1 overflow-auto">
                                <div className="max-w-4xl mx-auto">
                                    <header className="mb-16">
                                        <div className="text-[10px] uppercase tracking-widest opacity-50 mb-2">Ref: SRC_DATA_LIST</div>
                                        <h1 className="text-3xl font-light uppercase tracking-wide">
                                            Active Collection
                                        </h1>
                                    </header>

                                    <div className="flex flex-col gap-1">
                                        <div className="flex px-4 py-2 border-b border-border/40 text-[10px] uppercase opacity-50 tracking-widest mb-2">
                                            <div className="flex-2">Identifier Name</div>
                                            <div className="flex-1">Status</div>
                                            <div className="flex-1 text-right">Data Points</div>
                                            <div className="flex-1 text-right">Timestamp</div>
                                        </div>

                                        {[1, 2, 3, 4, 5].map(i => (
                                            <div key={i} className="flex px-4 py-4 text-xs tracking-wide border-b border-transparent hover:border-border/40 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer group">
                                                <div className="flex-2 flex flex-col gap-1">
                                                    <span className="uppercase font-medium">Customer Sat. Metric 0{i}</span>
                                                    <span className="text-[10px] opacity-50">UID: 984{i}-AB</span>
                                                </div>
                                                <div className="flex-1 pt-1 opacity-70 group-hover:opacity-100">
                                                    RUNNING
                                                </div>
                                                <div className="flex-1 text-right pt-1 opacity-70">
                                                    4,09{i}
                                                </div>
                                                <div className="flex-1 text-right pt-1 opacity-50">
                                                    2026.02.{10 + i}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Variation 4: Swiss Primary Highlight */}
                <div className="space-y-6">
                    <div className="space-y-2 max-w-2xl">
                        <h2 className={`text-2xl font-semibold`}>4. Swiss Primary Focus</h2>
                        <p className="text-muted-foreground text-sm">Building on the Swiss Technical layout, but heavily utilizing the <span className="font-semibold text-primary">Primary Color</span> from globals.css for bold, high-contrast structural elements. Still maintains rigid <span className={jetBrainsMono.className}>JetBrains Mono</span> data styling.</p>
                    </div>

                    <div className={`w-full h-[700px] border border-primary/20 bg-background flex shadow-[0_0_40px_-15px_var(--color-primary)] rounded-lg overflow-hidden`}>
                        {/* Sidebar */}
                        <div className="w-64 border-r border-primary/20 flex flex-col shrink-0 bg-primary/5">
                            <div className="h-16 flex items-center px-6 gap-3 bg-primary text-primary-foreground shadow-sm">
                                <div className="w-3 h-3 rounded-sm bg-primary-foreground opacity-90" />
                                <span className={`font-semibold tracking-tight uppercase`}>Survey_Studio</span>
                            </div>

                            <div className="py-6 flex-1 px-4 space-y-8">
                                <div>
                                    <div className={`px-2 text-[10px] text-primary/70 uppercase tracking-widest mb-3 font-semibold ${jetBrainsMono.className}`}>Directory</div>
                                    <div className="space-y-1">
                                        {menuItems.map((item, i) => (
                                            <button key={item.name} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-sm transition-all ${i === 0 ? "bg-primary text-primary-foreground font-semibold shadow-md shadow-primary/20" : "text-muted-foreground hover:bg-primary/10 hover:text-foreground"}`}>
                                                <div className="flex items-center gap-3">
                                                    <item.icon size={18} strokeWidth={i === 0 ? 2.5 : 2} className={i === 0 ? "text-primary-foreground" : "text-primary/70"} />
                                                    {item.name}
                                                </div>
                                                {i === 0 && <span className={`${jetBrainsMono.className} text-[10px] bg-primary-foreground/20 text-primary-foreground rounded px-1.5 py-0.5`}>12</span>}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 border-t border-primary/20 bg-primary/10">
                                <div className="space-y-1">
                                    {bottomItems.map((item) => (
                                        <button key={item.name} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-foreground/70 hover:bg-primary/20 hover:text-foreground rounded-md transition-colors">
                                            <item.icon size={16} strokeWidth={2} className="text-primary/80" />
                                            {item.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Main */}
                        <div className="flex-1 flex flex-col bg-background relative">
                            <div className="h-16 border-b border-primary/20 flex items-center justify-between px-8 bg-background relative z-10">
                                <div className="flex items-center text-sm w-96">
                                    <Search className="text-primary mr-3" size={18} />
                                    <input placeholder="Search records..." className="bg-transparent outline-none placeholder:text-muted-foreground/60 w-full font-medium" />
                                </div>
                                <div className="flex gap-4">
                                    <button className="flex items-center gap-2 text-xs font-bold text-primary-foreground bg-primary hover:opacity-90 transition-opacity px-5 py-2 rounded-lg shadow-md shadow-primary/20">
                                        <Plus size={16} /> New Survey
                                    </button>
                                </div>
                            </div>

                            <div className="p-10 flex-1 overflow-auto bg-[linear-gradient(var(--color-primary)_1px,transparent_1px),linear-gradient(90deg,var(--color-primary)_1px,transparent_1px)] bg-size-[40px_40px] opacity-[0.99]" style={{ backgroundImage: "radial-gradient(var(--color-primary) 1px, transparent 1px)", backgroundSize: "24px 24px" }}>
                                <div className="bg-background/95 backdrop-blur-sm border border-primary/20 rounded-2xl shadow-xl shadow-primary/5 p-8 h-full flex flex-col">
                                    <header className="mb-10 flex items-baseline justify-between border-b border-primary/20 pb-6">
                                        <div>
                                            <h1 className="text-3xl font-bold mb-2 text-foreground">Active Surveys</h1>
                                            <p className={`text-sm text-muted-foreground font-medium ${jetBrainsMono.className}`}>Overview of running data collection tasks.</p>
                                        </div>
                                    </header>

                                    <div className="border border-primary/20 rounded-xl overflow-hidden bg-card/80">
                                        <table className="w-full text-left table-fixed">
                                            <thead>
                                                <tr className={`border-b border-primary/20 bg-primary/5 text-[10px] uppercase text-primary font-bold tracking-wider ${jetBrainsMono.className}`}>
                                                    <th className="px-6 py-4 w-1/3">Survey ID / Name</th>
                                                    <th className="px-6 py-4">Status</th>
                                                    <th className="px-6 py-4 text-right">Responses</th>
                                                    <th className="px-6 py-4 text-right">Modified</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-primary/10">
                                                {[1, 2, 3, 4].map(i => (
                                                    <tr key={i} className="hover:bg-primary/5 transition-colors group">
                                                        <td className="px-6 py-4 border-l-2 border-transparent group-hover:border-primary transition-colors">
                                                            <div className={`text-xs text-primary/70 mb-1 font-bold ${jetBrainsMono.className}`}>SRV-2026-00{i}</div>
                                                            <div className="text-sm font-bold text-foreground">Customer Feedback Q{i}</div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className={`${jetBrainsMono.className} text-[10px] uppercase tracking-widest bg-primary text-primary-foreground px-2 py-1 rounded shadow-sm font-bold`}>LIVE</span>
                                                        </td>
                                                        <td className={`px-6 py-4 text-right text-sm font-medium text-foreground ${jetBrainsMono.className}`}>
                                                            1,20{i}
                                                        </td>
                                                        <td className={`px-6 py-4 text-right text-xs text-muted-foreground font-medium ${jetBrainsMono.className} group-hover:text-primary transition-colors`}>
                                                            12.04.26
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
