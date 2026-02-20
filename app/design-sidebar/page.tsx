"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
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
    UserCircle
} from "lucide-react";

import { Space_Grotesk, Playfair_Display, JetBrains_Mono, Outfit } from "next/font/google";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["400", "700"] });
const playfair = Playfair_Display({ subsets: ["latin"], weight: ["400", "600", "700"], style: ["italic", "normal"] });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "700"] });
const outfit = Outfit({ subsets: ["latin"], weight: ["300", "500", "800"] });

export default function DashboardShowcase() {
    const [activeTab, setActiveTab] = useState("Surveys");

    const menuItems = [
        { name: "My Surveys", icon: ClipboardList },
        { name: "Analytics", icon: BarChart2 },
        { name: "Respondents", icon: Users },
    ];

    const bottomItems = [
        { name: "Settings", icon: Settings },
        { name: "Help", icon: HelpCircle },
    ];

    return (
        <div className="min-h-screen bg-background text-foreground py-16 px-4 md:px-12 space-y-32">
            <div className="max-w-4xl mx-auto space-y-6 text-center">
                <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight">Dashboard & Sidebar Showcase</h1>
                <p className="text-xl text-muted-foreground mx-auto max-w-2xl leading-relaxed">
                    5 full dashboard layouts. Pick the aesthetic you want to apply to your entire application.
                </p>
            </div>

            <div className="max-w-7xl mx-auto space-y-32">

                {/* Variation 1: Neo-Brutalism */}
                <div className="space-y-6">
                    <div className="space-y-2 max-w-2xl">
                        <h2 className={`text-3xl font-bold ${spaceGrotesk.className}`}>1. Neo-Brutalism</h2>
                        <p className="text-muted-foreground">Raw, structural, high-contrast. Uses deep black borders, solid blocks of color, and harsh structural lines.</p>
                    </div>

                    <div className={`w-full h-[700px] border-[4px] border-foreground bg-muted flex overflow-hidden shadow-[16px_16px_0px_0px_var(--color-foreground)] ${spaceGrotesk.className}`}>
                        {/* Sidebar */}
                        <div className="w-64 bg-card border-r-[4px] border-foreground flex flex-col z-10 shrink-0">
                            <div className="h-20 border-b-[4px] border-foreground flex items-center px-6 bg-primary/20">
                                <div className="w-10 h-10 bg-primary border-[3px] border-foreground flex items-center justify-center shadow-[2px_2px_0px_0px_var(--color-foreground)]">
                                    <LayoutDashboard className="text-primary-foreground" size={20} strokeWidth={3} />
                                </div>
                                <span className="ml-3 font-black text-xl uppercase tracking-tighter">Studio</span>
                            </div>

                            <div className="p-6 flex-1 flex flex-col gap-4">
                                <span className="text-xs font-black uppercase tracking-widest px-2 relative inline-block w-fit">
                                    Menu
                                    <div className="absolute bottom-0 left-0 w-full h-2 bg-secondary/30 -z-10" />
                                </span>

                                <div className="space-y-3">
                                    {menuItems.map((item, i) => (
                                        <button key={item.name} className={`w-full flex items-center gap-3 px-4 py-3 font-bold border-[3px] border-foreground transition-transform hover:-translate-y-1 ${i === 0 ? "bg-primary text-primary-foreground shadow-[4px_4px_0px_0px_var(--color-foreground)]" : "bg-card hover:bg-muted shadow-[2px_2px_0px_0px_var(--color-foreground)]"}`}>
                                            <item.icon size={20} strokeWidth={2.5} />
                                            <span className="uppercase text-sm tracking-wide">{item.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="p-6 border-t-[4px] border-foreground bg-muted/50 space-y-3">
                                {bottomItems.map((item) => (
                                    <button key={item.name} className="w-full flex items-center gap-3 px-4 py-3 font-bold border-[3px] border-foreground bg-card hover:bg-muted shadow-[2px_2px_0px_0px_var(--color-foreground)] transition-transform hover:-translate-y-1">
                                        <item.icon size={20} strokeWidth={2.5} />
                                        <span className="uppercase text-sm tracking-wide">{item.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Main */}
                        <div className="flex-1 flex flex-col bg-background/50 relative">
                            <div className="absolute inset-0 bg-[radial-gradient(circle,var(--color-foreground)_1px,transparent_1px)] bg-[size:24px_24px] opacity-5 pointer-events-none" />

                            <div className="h-20 border-b-[4px] border-foreground flex items-center justify-between px-8 bg-card relative z-10">
                                <div className="relative w-96">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2" size={18} strokeWidth={3} />
                                    <input placeholder="Search..." className="w-full border-[3px] border-foreground bg-muted py-2 pl-12 pr-4 font-bold outline-none focus:bg-background focus:shadow-[4px_4px_0px_0px_var(--color-foreground)] transition-shadow" />
                                </div>
                                <div className="flex gap-4">
                                    <button className="w-12 h-12 bg-secondary border-[3px] border-foreground flex items-center justify-center hover:-translate-y-1 shadow-[4px_4px_0px_0px_var(--color-foreground)] transition-transform">
                                        <Bell className="text-primary-foreground" size={20} strokeWidth={2.5} />
                                    </button>
                                    <button className="h-12 px-6 bg-primary text-primary-foreground border-[3px] border-foreground flex items-center gap-2 font-black uppercase tracking-widest hover:-translate-y-1 shadow-[4px_4px_0px_0px_var(--color-foreground)] transition-transform">
                                        <Plus size={20} strokeWidth={3} />
                                        New Survey
                                    </button>
                                </div>
                            </div>
                            <div className="p-12 relative z-10">
                                <h1 className="text-5xl font-black uppercase tracking-tighter mb-8 inline-block relative">
                                    My Surveys
                                    <div className="absolute -bottom-2 -right-4 w-full h-6 bg-secondary -z-10 skew-x-12 opacity-40" />
                                </h1>

                                <div className="grid grid-cols-3 gap-8">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="bg-card border-[3px] border-foreground p-6 shadow-[8px_8px_0px_0px_var(--color-foreground)] hover:-translate-y-2 hover:shadow-[12px_12px_0px_0px_var(--color-foreground)] transition-all">
                                            <div className="h-32 bg-primary/20 border-[3px] border-foreground mb-4 flex items-center justify-center">
                                                <ClipboardList size={40} className="text-primary opacity-50" strokeWidth={1.5} />
                                            </div>
                                            <h3 className="text-xl font-black uppercase mb-2">Campaign {i}</h3>
                                            <button className="w-full py-2 bg-foreground text-card font-bold uppercase mt-4 text-xs tracking-widest hover:bg-primary transition-colors">Manage</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Variation 2: Luxury Editorial */}
                <div className="space-y-6">
                    <div className="space-y-2 max-w-2xl">
                        <h2 className={`text-3xl font-bold ${playfair.className}`}>2. Luxury Editorial</h2>
                        <p className="text-muted-foreground">Minimal, refined layouts. Features generous asymmetrical whitespace, classic serif typography paired with clean sans-serifs, and delicate dividers.</p>
                    </div>

                    <div className={`w-full h-[700px] border border-border bg-background flex shadow-2xl overflow-hidden relative ${playfair.className}`}>

                        {/* Sidebar */}
                        <div className="w-72 border-r border-border/50 flex flex-col z-10 shrink-0 bg-background/80 backdrop-blur-3xl relative">
                            <div className="absolute top-0 right-0 w-[1px] h-full bg-gradient-to-b from-transparent via-border to-transparent" />

                            <div className="h-28 flex flex-col justify-center px-10">
                                <span className="font-medium text-2xl tracking-tight">Studio.</span>
                                <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-sans mt-1">Research & Data</span>
                            </div>

                            <div className="px-6 flex-1 pt-8">
                                <div className="space-y-1">
                                    {menuItems.map((item, i) => (
                                        <button key={item.name} className={`w-full flex items-center gap-4 px-4 py-4 group transition-all font-sans text-xs uppercase tracking-widest ${i === 0 ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                                            {i === 0 && <motion.div layoutId="lux-indicator" className="absolute left-0 w-1 h-8 bg-primary rounded-r-md" />}
                                            <span className={`transition-transform duration-500 ${i === 0 ? "translate-x-2" : "group-hover:translate-x-2"}`}>{item.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="p-10 border-t border-border/50 space-y-4">
                                {bottomItems.map((item) => (
                                    <button key={item.name} className="flex items-center gap-3 text-muted-foreground hover:text-foreground font-sans text-[10px] uppercase tracking-[0.2em] transition-colors">
                                        <item.icon size={14} strokeWidth={1.5} />
                                        {item.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Main */}
                        <div className="flex-1 flex flex-col relative bg-[#fafafa] dark:bg-black/20">
                            <div className="h-28 flex items-center justify-between px-16 relative z-10">
                                <div className="flex gap-8 text-sm font-sans">
                                    <button className="text-muted-foreground hover:text-foreground transition-colors"><Search size={18} strokeWidth={1.5} /></button>
                                </div>
                                <div className="flex items-center gap-6">
                                    <button className="text-muted-foreground hover:text-foreground"><Bell size={18} strokeWidth={1.5} /></button>
                                    <button className="flex items-center gap-2 font-sans text-xs uppercase tracking-[0.2em] bg-foreground text-background px-6 py-3 hover:opacity-80 transition-opacity">
                                        Create App
                                    </button>
                                </div>
                            </div>

                            <div className="px-16 pt-8 relative z-10 flex-1 overflow-y-auto">
                                <header className="mb-16 max-w-2xl">
                                    <h1 className="text-5xl font-normal leading-tight">
                                        Welcome back,<br /><span className="italic text-muted-foreground">Director</span>
                                    </h1>
                                </header>

                                <div className="grid grid-cols-2 gap-10">
                                    {[1, 2, 3, 4].map((i) => (
                                        <div key={i} className="group cursor-pointer">
                                            <div className="aspect-[16/9] bg-muted relative overflow-hidden mb-4">
                                                <div className="absolute inset-0 bg-primary/5 group-hover:bg-primary/10 transition-colors duration-700" />
                                                <div className="absolute bottom-0 left-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity duration-700 font-sans">
                                                    <span className="text-xs tracking-widest bg-background/80 backdrop-blur px-3 py-1">VIEW</span>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-start font-sans">
                                                <div>
                                                    <h3 className="text-sm font-bold uppercase tracking-widest mb-1">Q{i} Global Index</h3>
                                                    <p className="text-xs text-muted-foreground">Drafted • 2 days ago</p>
                                                </div>
                                                <span className="text-[10px] text-muted-foreground tracking-[0.2em]">0{i}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Variation 3: Industrial / Utilitarian */}
                <div className="space-y-6">
                    <div className="space-y-2 max-w-2xl">
                        <h2 className={`text-3xl font-bold ${mono.className}`}>3. Industrial Utilitarian</h2>
                        <p className="text-muted-foreground">Dense, terminal-inspired professional layouts. Features monospaced type, strict gridlines, muted backgrounds with sharp accent colors, and data-centric organization.</p>
                    </div>

                    <div className={`w-full h-[700px] border border-border bg-background flex overflow-hidden shadow-lg ${mono.className}`}>

                        {/* Sidebar */}
                        <div className="w-64 border-r border-border flex flex-col z-10 shrink-0 bg-muted/10">
                            <div className="h-16 border-b border-border flex items-center px-4 bg-muted/30 text-xs font-bold text-muted-foreground tracking-widest gap-2">
                                <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                                SYS.STUDIO.v2
                            </div>

                            <div className="py-4 flex-1">
                                <div className="px-4 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest mb-2">Modules</div>
                                <div className="space-y-0.5">
                                    {menuItems.map((item, i) => (
                                        <button key={item.name} className={`w-full flex items-center gap-3 px-6 py-2.5 text-xs font-bold uppercase tracking-widest border-l-[3px] transition-colors ${i === 0 ? "border-primary bg-primary/5 text-primary" : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"}`}>
                                            <item.icon size={16} strokeWidth={2} />
                                            {item.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="py-4 border-t border-border bg-muted/5 space-y-0.5">
                                {bottomItems.map((item) => (
                                    <button key={item.name} className="w-full flex items-center gap-3 px-6 py-2.5 text-xs font-bold text-muted-foreground uppercase tracking-widest border-l-[3px] border-transparent hover:bg-muted/50 hover:text-foreground transition-colors">
                                        <item.icon size={16} strokeWidth={2} />
                                        {item.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Main */}
                        <div className="flex-1 flex flex-col bg-background relative">
                            <div className="h-16 border-b border-border flex items-center justify-between px-6 bg-muted/5">
                                <div className="flex items-center gap-4 w-96">
                                    <span className="text-muted-foreground font-bold">~/</span>
                                    <input placeholder="SEARCH_DATABASE..." className="w-full bg-transparent text-xs font-bold outline-none placeholder:text-muted-foreground/50 border-b border-dashed border-border/50 focus:border-primary pb-1 transition-colors" />
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="text-[10px] text-muted-foreground border border-border px-2 py-1 flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full" /> NET.OK
                                    </div>
                                    <button className="h-8 px-4 bg-primary text-primary-foreground text-[10px] font-bold tracking-widest flex items-center gap-2 hover:bg-primary/90 transition-colors">
                                        <Plus size={14} /> NEW_NODE
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-hidden flex flex-col">
                                <div className="border-b border-border h-12 flex items-center px-6 gap-6 bg-muted/10 text-xs font-bold text-muted-foreground">
                                    <button className="h-full text-foreground border-b-2 border-primary flex items-center">ACTIVE_SURVEYS</button>
                                    <button className="h-full hover:text-foreground transition-colors">ARCHIVED</button>
                                    <button className="h-full hover:text-foreground transition-colors">TEMPLATES</button>
                                </div>

                                <div className="p-6 flex-1 overflow-y-auto bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px]">
                                    <div className="grid grid-cols-1 gap-4">
                                        {[1, 2, 3].map((i) => (
                                            <div key={i} className="flex items-center border border-border bg-card hover:border-primary/50 transition-colors">
                                                <div className="w-12 h-16 border-r border-border flex items-center justify-center text-muted-foreground bg-muted/20">
                                                    {i}
                                                </div>
                                                <div className="flex-1 px-4 py-3 flex justify-between items-center group">
                                                    <div>
                                                        <div className="text-xs font-bold text-primary mb-1">SRV_8492_{i}</div>
                                                        <div className="text-sm font-bold">Customer Satisfaction Index</div>
                                                    </div>

                                                    <div className="flex items-center gap-12 text-xs">
                                                        <div className="flex flex-col gap-1 text-right">
                                                            <span className="text-muted-foreground uppercase text-[10px]">Total Traffic</span>
                                                            <span className="font-bold">2,48{i}</span>
                                                        </div>
                                                        <div className="flex flex-col gap-1 text-right w-24">
                                                            <span className="text-muted-foreground uppercase text-[10px]">Status</span>
                                                            <span className="bg-emerald-500/10 text-emerald-600 px-2 py-0.5 border border-emerald-500/20 text-center">LIVE</span>
                                                        </div>
                                                        <button className="opacity-0 group-hover:opacity-100 transition-opacity text-primary font-bold ml-4 border border-primary px-3 py-1 hover:bg-primary/10">OPEN</button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Variation 4: Cyberpunk Neon */}
                <div className="space-y-6">
                    <div className="space-y-2 max-w-2xl">
                        <h2 className="text-3xl font-bold">4. Cyberpunk Neon</h2>
                        <p className="text-muted-foreground">Dark, high-energy UI. Features glowing borders, deep blacks, high-contrast neon accents, and sci-fi aesthetic elements.</p>
                    </div>

                    <div className="dark aspect-[16/9] max-h-[700px] w-full bg-[#050505] text-white flex overflow-hidden relative shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/5">
                        {/* Grid bg */}
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

                        {/* Sidebar */}
                        <div className="w-64 border-r border-white/10 flex flex-col z-10 shrink-0 bg-black/60 backdrop-blur-md">
                            <div className="h-20 flex items-center px-6 relative">
                                <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-primary to-transparent" />
                                <span className="font-mono text-xl font-bold tracking-widest bg-clip-text text-transparent bg-gradient-to-r from-primary to-green-300 shadow-primary drop-shadow-[0_0_8px_rgba(34,197,94,0.6)]">STUDIO//</span>
                            </div>

                            <div className="p-4 flex-1 space-y-2 mt-4">
                                {menuItems.map((item, i) => (
                                    <button key={item.name} className={`w-full flex items-center gap-3 px-4 py-3 font-mono text-xs uppercase tracking-widest relative group transition-all ${i === 0 ? "text-primary" : "text-white/50 hover:text-white"}`}>
                                        {i === 0 && <div className="absolute inset-0 bg-primary/10 border border-primary/30 shadow-[0_0_15px_rgba(34,197,94,0.15)]" />}
                                        <item.icon size={16} className={`relative z-10 ${i === 0 ? "drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]" : ""}`} />
                                        <span className="relative z-10">{item.name}</span>
                                        <div className="absolute right-4 opacity-0 group-hover:opacity-100 transition-opacity text-primary text-[10px] font-bold">_</div>
                                    </button>
                                ))}
                            </div>

                            <div className="p-4 border-t border-white/10 space-y-2">
                                {bottomItems.map((item) => (
                                    <button key={item.name} className="w-full flex items-center gap-3 px-4 py-3 font-mono text-xs uppercase tracking-widest text-white/40 hover:text-white/80 transition-all border border-transparent hover:border-white/10">
                                        <item.icon size={16} />
                                        {item.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Main */}
                        <div className="flex-1 flex flex-col relative z-0">
                            <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
                            <div className="absolute bottom-[-20%] left-[20%] w-[400px] h-[400px] bg-secondary/10 rounded-full blur-[120px] pointer-events-none" />

                            <div className="h-20 border-b border-white/10 flex items-center justify-between px-8 relative z-10 bg-black/40 backdrop-blur-md">
                                <div className="relative w-80">
                                    <div className="absolute left-0 bottom-0 w-2 h-2 border-l border-b border-white/40" />
                                    <div className="absolute right-0 top-0 w-2 h-2 border-r border-t border-white/40" />
                                    <input placeholder="ACCESS LOGS..." className="w-full bg-transparent text-sm font-mono text-white/80 outline-none px-4 py-2 border border-white/10 focus:border-primary/50 focus:bg-primary/5 transition-all shadow-[inset_0_0_15px_transparent] focus:shadow-[inset_0_0_20px_rgba(34,197,94,0.1)]" />
                                </div>

                                <button className="h-10 px-6 bg-primary/20 text-primary border border-primary/50 font-mono text-xs font-bold tracking-widest hover:bg-primary hover:text-black transition-all hover:shadow-[0_0_25px_rgba(34,197,94,0.4)] flex items-center gap-2 uppercase">
                                    <Plus size={16} /> Init Survey
                                </button>
                            </div>

                            <div className="flex-1 p-8 overflow-y-auto relative z-10">
                                <div className="flex justify-between items-end mb-10 border-b border-white/10 pb-4">
                                    <h1 className="text-4xl font-black tracking-tight text-white mb-0 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
                                        Active Relays
                                    </h1>
                                    <span className="font-mono text-xs text-primary font-bold">12:04:45 // ONLINE</span>
                                </div>

                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                                    {[1, 2, 3].map((i) => (
                                        <div key={i} className="group relative bg-black/40 border border-white/10 p-6 flex flex-col font-mono hover:border-primary/50 transition-colors">
                                            <div className="absolute top-0 right-0 w-10 h-10 border-r-2 border-t-2 border-primary/50 opacity-0 group-hover:opacity-100 transition-opacity translate-x-1 -translate-y-1" />
                                            <div className="absolute bottom-0 left-0 w-10 h-10 border-l-2 border-b-2 border-primary/50 opacity-0 group-hover:opacity-100 transition-opacity -translate-x-1 translate-y-1" />

                                            <div className="flex justify-between items-start mb-6">
                                                <div className="p-2 bg-primary/10 border border-primary/20 text-primary">
                                                    <BarChart2 size={24} />
                                                </div>
                                                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-1 tracking-widest uppercase border border-emerald-500/30 font-bold shadow-[0_0_10px_rgba(16,185,129,0.2)]">Live</span>
                                            </div>

                                            <h3 className="text-lg font-bold text-white mb-2 font-sans tracking-tight">Project Delta {i}</h3>
                                            <p className="text-xs text-white/50 mb-6 flex-1">Relaying participant data via secure channels.</p>

                                            <button className="w-full py-2 bg-white/5 hover:bg-primary text-white hover:text-black border border-white/10 hover:border-primary transition-all text-xs font-bold tracking-widest flex items-center justify-center gap-2 hover:shadow-[0_0_15px_rgba(34,197,94,0.3)]">
                                                Enter Node <ChevronRight size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Variation 5: Organic Soft Max */}
                <div className="space-y-6">
                    <div className="space-y-2 max-w-2xl">
                        <h2 className={`text-3xl font-bold ${outfit.className}`}>5. Organic Soft Max</h2>
                        <p className="text-muted-foreground">Playful, floating interface. Features large border radii, disconnected floating sidebar, soft colorful drop shadows, frosted glass blur, and friendly typography.</p>
                    </div>

                    <div className={`w-full h-[700px] bg-muted/30 rounded-[3rem] p-4 flex gap-4 overflow-hidden relative shadow-inner ${outfit.className}`}>
                        <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-gradient-to-br from-primary/10 to-secondary/10 rounded-full blur-[80px] pointer-events-none -translate-y-1/2" />
                        <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-gradient-to-tr from-accent/10 to-primary/10 rounded-full blur-[60px] pointer-events-none translate-y-1/3" />

                        {/* Sidebar */}
                        <div className="w-[280px] bg-background/60 backdrop-blur-xl border border-white/40 (dark:border-white/10) shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] rounded-[2.5rem] flex flex-col z-10 overflow-hidden relative">
                            <div className="p-8 flex items-center gap-4">
                                <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary-foreground/80 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/30">
                                    <LayoutDashboard size={20} strokeWidth={2.5} />
                                </div>
                                <span className="font-extrabold text-2xl tracking-tight">Studio</span>
                            </div>

                            <div className="px-4 flex-1 mt-4">
                                <div className="space-y-2">
                                    {menuItems.map((item, i) => (
                                        <button key={item.name} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl font-bold transition-all ${i === 0 ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-100" : "text-muted-foreground hover:bg-white/50 hover:text-foreground hover:scale-[1.02]"}`}>
                                            <item.icon size={20} strokeWidth={i === 0 ? 2.5 : 2} />
                                            <span className="text-base">{item.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="p-6 bg-white/20 dark:bg-black/10 mt-auto">
                                <div className="p-4 bg-background/50 rounded-2xl flex items-center gap-3 border border-white/20">
                                    <div className="w-10 h-10 bg-secondary/10 text-secondary rounded-xl flex items-center justify-center">
                                        <UserCircle size={22} />
                                    </div>
                                    <div className="text-left flex-1">
                                        <div className="font-bold text-sm">Alex Director</div>
                                        <div className="text-xs text-muted-foreground font-medium">Pro Plan</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Main */}
                        <div className="flex-1 flex flex-col z-10">
                            <div className="h-24 flex items-center justify-between px-6">
                                <div className="relative w-96">
                                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                                        <Search className="text-muted-foreground" size={18} />
                                    </div>
                                    <input placeholder="Find anything..." className="w-full bg-background/60 backdrop-blur-md border border-white/40 shadow-sm px-12 py-3 rounded-full outline-none focus:ring-4 ring-primary/10 transition-all font-medium" />
                                </div>
                                <div className="flex gap-4">
                                    <button className="w-12 h-12 bg-background/60 backdrop-blur-md border border-white/40 rounded-full flex items-center justify-center hover:scale-105 transition-transform text-muted-foreground hover:text-foreground shadow-sm">
                                        <Bell size={20} />
                                    </button>
                                    <button className="px-6 h-12 bg-foreground text-background font-bold rounded-full flex items-center gap-2 hover:scale-105 transition-transform shadow-lg shadow-foreground/20">
                                        <Plus size={18} strokeWidth={3} /> Create New
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 p-6 relative">
                                <div className="bg-background/60 backdrop-blur-xl border border-white/40 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] rounded-[2.5rem] w-full h-full p-10 flex flex-col">

                                    <h1 className="text-4xl font-extrabold mb-8">Hey there! 👋</h1>

                                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                                        {[1, 2, 3].map((i) => (
                                            <motion.div whileHover={{ y: -8 }} key={i} className="bg-gradient-to-br from-white/60 to-white/30 dark:from-white/10 dark:to-white/5 border border-white/40 dark:border-white/10 p-6 rounded-[2rem] shadow-sm">
                                                <div className="w-14 h-14 bg-primary/10 text-primary rounded-[1.2rem] flex items-center justify-center mb-6">
                                                    <ClipboardList size={26} strokeWidth={2.5} />
                                                </div>
                                                <h3 className="text-xl font-bold mb-1">Feedback Survey</h3>
                                                <p className="text-sm text-muted-foreground font-medium mb-6">Generated 2 days ago</p>
                                                <div className="flex items-center justify-between pt-4 border-t border-white/20 dark:border-white/10">
                                                    <span className="text-xs font-bold text-foreground bg-muted/50 px-3 py-1.5 rounded-xl">Draft</span>
                                                    <button className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center hover:scale-110 transition-transform">
                                                        <ChevronRight size={16} />
                                                    </button>
                                                </div>
                                            </motion.div>
                                        ))}
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
