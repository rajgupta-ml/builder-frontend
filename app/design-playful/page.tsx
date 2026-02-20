"use client";

import React from "react";
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
    UserCircle,
    FolderOpen,
    Sparkles,
    Zap,
    Star
} from "lucide-react";

import { Space_Grotesk, Nunito_Sans, Fredoka, Quicksand } from "next/font/google";

const fredoka = Fredoka({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const nunito = Nunito_Sans({ subsets: ["latin"], weight: ["400", "600", "700", "800", "900"] });
const quicksand = Quicksand({ subsets: ["latin"], weight: ["400", "600", "700"] });

export default function PlayfulShowcase() {
    const menuItems = [
        { name: "Surveys", icon: ClipboardList, color: "text-primary", bg: "bg-primary/20", border: "border-primary" },
        { name: "Analytics", icon: BarChart2, color: "text-secondary", bg: "bg-secondary/20", border: "border-secondary" },
        { name: "Respondents", icon: Users, color: "text-accent", bg: "bg-accent/20", border: "border-accent" },
    ];

    const bottomItems = [
        { name: "Settings", icon: Settings },
        { name: "Help", icon: HelpCircle },
    ];

    return (
        <div className={`min-h-screen bg-background text-foreground py-16 px-4 md:px-12 space-y-32 ${nunito.className}`}>
            <div className="max-w-4xl mx-auto space-y-6 text-center">
                <h1 className={`text-4xl md:text-5xl font-black tracking-tight ${fredoka.className}`}>Playful & Dynamic App</h1>
                <p className="text-lg text-muted-foreground mx-auto max-w-2xl font-medium">
                    Leveraging your actual `globals.css` color palette (primary green, secondary blue/purple, etc.) in a highly energetic, bouncy, and squishy aesthetic.
                </p>
            </div>

            <div className="max-w-7xl mx-auto space-y-32">

                {/* Variation 1: Bouncy Squircle */}
                <div className="space-y-6">
                    <div className="space-y-2 max-w-2xl">
                        <h2 className={`text-3xl font-bold ${fredoka.className}`}>1. Bouncy App (Fredoka)</h2>
                        <p className="text-muted-foreground text-sm font-medium">Heavy use of your `primary`, `secondary`, and `accent` colors. Features thick outlines (inspired by retro gaming but softly rounded), floating elements, and the <span className="font-bold">Fredoka</span> font for maximum friendliness.</p>
                    </div>

                    <div className={`w-full h-[700px] border-[3px] border-foreground/20 bg-muted/30 rounded-[3rem] p-4 flex gap-4 overflow-hidden relative shadow-inner ${fredoka.className}`}>

                        {/* Sidebar */}
                        <div className="w-[280px] bg-card border-[3px] border-border shadow-[4px_8px_0px_0px_var(--color-primary)] rounded-[2.5rem] flex flex-col z-10 overflow-hidden relative mr-2 transition-transform hover:-translate-y-1 hover:shadow-[4px_12px_0px_0px_var(--color-primary)]">
                            <div className="p-8 flex items-center gap-4">
                                <div className="w-14 h-14 bg-primary rounded-[1.5rem] flex items-center justify-center text-primary-foreground border-2 border-primary-foreground shadow-[inset_0_-4px_0_0_rgba(0,0,0,0.15)] transform -rotate-6">
                                    <Star size={24} strokeWidth={3} fill="currentColor" />
                                </div>
                                <span className="font-bold text-2xl tracking-tight text-foreground">Studio</span>
                            </div>

                            <div className="px-5 flex-1 mt-4">
                                <div className="space-y-4">
                                    {menuItems.map((item, i) => (
                                        <motion.button
                                            whileHover={{ scale: 1.05, rotate: i % 2 === 0 ? 1 : -1 }}
                                            whileTap={{ scale: 0.95 }}
                                            key={item.name}
                                            className={`w-full flex items-center gap-4 px-5 py-4 rounded-[1.5rem] font-bold transition-all border-2 ${i === 0 ? `bg-primary text-primary-foreground border-primary shadow-[0_4px_0_0_rgba(0,0,0,0.2)]` : `bg-background border-border text-foreground hover:${item.border} hover:shadow-[0_4px_0_0_var(--color-border)]`}`}
                                        >
                                            <div className={`${i === 0 ? "text-primary-foreground" : item.color}`}>
                                                <item.icon size={22} strokeWidth={2.5} />
                                            </div>
                                            <span className="text-lg">{item.name}</span>
                                        </motion.button>
                                    ))}
                                </div>
                            </div>

                            <div className="p-6 mt-auto">
                                <div className="p-4 bg-secondary/10 rounded-[1.5rem] flex items-center gap-3 border-2 border-secondary/20">
                                    <div className="w-12 h-12 bg-background border-2 border-secondary text-secondary rounded-[1rem] flex items-center justify-center -rotate-3">
                                        <UserCircle size={26} strokeWidth={2} />
                                    </div>
                                    <div className="text-left flex-1">
                                        <div className="font-bold text-foreground leading-tight">Alex Maker</div>
                                        <div className="text-xs text-secondary font-bold uppercase tracking-wider mt-0.5">Pro User 🚀</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Main */}
                        <div className="flex-1 flex flex-col z-10 w-full min-w-0">
                            <div className="h-24 flex items-center justify-between px-2 mb-2">
                                <div className="relative w-96 group">
                                    <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                                        <Search className="text-primary" size={20} strokeWidth={3} />
                                    </div>
                                    <input placeholder="Search for fun stuff..." className="w-full bg-card border-2 border-border/50 shadow-[0_4px_0_0_var(--color-border)] px-14 py-4 rounded-[2rem] outline-none group-focus-within:border-primary group-focus-within:ring-4 ring-primary/20 transition-all font-medium text-lg placeholder:text-muted-foreground/50 hover:-translate-y-0.5" />
                                </div>
                                <div className="flex gap-4">
                                    <motion.button
                                        whileHover={{ scale: 1.1, rotate: 10 }}
                                        whileTap={{ scale: 0.9 }}
                                        className="w-14 h-14 bg-accent/10 border-2 border-accent/20 text-accent rounded-full flex items-center justify-center shadow-[0_4px_0_0_rgba(0,0,0,0.05)]"
                                    >
                                        <Bell size={24} strokeWidth={2.5} />
                                    </motion.button>
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        className="px-8 h-14 bg-secondary text-secondary-foreground font-bold text-lg rounded-[2rem] flex items-center gap-3 shadow-[0_6px_0_0_rgba(0,0,0,0.2)] hover:shadow-[0_4px_0_0_rgba(0,0,0,0.2)] hover:translate-y-[2px] border-2 border-secondary/50"
                                    >
                                        <Sparkles size={20} strokeWidth={3} /> Create!
                                    </motion.button>
                                </div>
                            </div>

                            <div className="flex-1 relative">
                                <div className="bg-card shadow-[0_8px_30px_-15px_rgba(0,0,0,0.1)] rounded-[2.5rem] w-full h-full p-10 flex flex-col border-[3px] border-border/50 overflow-hidden relative">

                                    {/* Decorative background blobs using globals.css colors */}
                                    <div className="absolute -top-20 -right-20 w-64 h-64 bg-accent/20 rounded-full blur-3xl" />
                                    <div className="absolute top-40 -left-20 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />

                                    <div className="relative z-10 flex items-center gap-4 mb-8">
                                        <div className="bg-primary/20 text-primary p-3 rounded-2xl transform -rotate-12 border-2 border-primary/30">
                                            <Zap size={32} strokeWidth={2.5} fill="currentColor" />
                                        </div>
                                        <h1 className="text-4xl font-extrabold text-foreground">Active Surveys</h1>
                                    </div>

                                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 relative z-10 overflow-y-auto pr-2 pb-4">
                                        {[
                                            { title: "Product Love", desc: "How much do they like us?", stat: "1.2k responses", col: "primary" },
                                            { title: "Feature Request", desc: "What should we build?", stat: "84 ideas", col: "secondary" },
                                            { title: "Churn Survey", desc: "Why did they leave?", stat: "42 answers", col: "accent" },
                                            { title: "Onboarding Flow", desc: "Was it confusing?", stat: "512 responses", col: "primary" }
                                        ].map((item, i) => (
                                            <motion.div
                                                whileHover={{ y: -8, scale: 1.02 }}
                                                key={i}
                                                className={`bg-background border-2 border-${item.col}/20 hover:border-${item.col} p-6 rounded-[2rem] shadow-[0_6px_0_0_rgba(0,0,0,0.05)] hover:shadow-[0_12px_20px_-10px_rgba(0,0,0,0.1)] transition-all cursor-pointer group`}
                                            >
                                                <div className={`w-14 h-14 bg-${item.col}/10 text-${item.col} rounded-[1.2rem] flex items-center justify-center mb-5 group-hover:scale-110 transition-transform group-hover:rotate-6 border-2 border-${item.col}/20`}>
                                                    <ClipboardList size={26} strokeWidth={2.5} />
                                                </div>
                                                <h3 className="text-2xl font-bold mb-1">{item.title}</h3>
                                                <p className="text-base text-muted-foreground font-medium mb-6">{item.desc}</p>

                                                <div className={`flex items-center justify-between pt-4 border-t-2 border-dashed border-border group-hover:border-${item.col}/30`}>
                                                    <span className={`text-sm font-bold text-${item.col} bg-${item.col}/10 px-3 py-1.5 rounded-xl`}>{item.stat}</span>
                                                    <div className={`w-10 h-10 rounded-full bg-${item.col}/10 text-${item.col} flex items-center justify-center group-hover:bg-${item.col} group-hover:text-white transition-colors`}>
                                                        <ChevronRight size={20} strokeWidth={3} />
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>

                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Variation 2: Candy Cards */}
                <div className="space-y-6">
                    <div className="space-y-2 max-w-2xl">
                        <h2 className={`text-3xl font-bold ${quicksand.className}`}>2. Candy Cards (Quicksand)</h2>
                        <p className="text-muted-foreground text-sm font-medium">Lighter and softer. Uses deep colored shadows instead of borders, giving everything a gummy, tangible feel. Typography relies on the deeply rounded <span className="font-bold">Quicksand</span>.</p>
                    </div>

                    <div className={`w-full h-[700px] border border-border/50 bg-[#F9FAFB] dark:bg-[#111] overflow-hidden flex ${quicksand.className}`}>

                        {/* Sidebar */}
                        <div className="w-64 bg-card z-10 flex flex-col pt-10 px-6 shadow-[10px_0_30px_-15px_rgba(0,0,0,0.1)]">

                            <div className="flex flex-col items-center text-center mb-10">
                                <div className="w-20 h-20 bg-gradient-to-tr from-accent to-secondary rounded-full flex items-center justify-center text-white shadow-[0_10px_20px_-5px_var(--color-accent)] mb-4">
                                    <Sparkles size={36} strokeWidth={2} />
                                </div>
                                <h2 className="text-2xl font-bold tracking-tight">Studio Pro</h2>
                                <p className="text-sm text-muted-foreground font-semibold bg-accent/10 text-accent px-3 py-1 rounded-full mt-2 inline-block">Online ✨</p>
                            </div>

                            <div className="flex-1 space-y-3">
                                {menuItems.map((item, i) => (
                                    <button
                                        key={item.name}
                                        className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl font-bold transition-all ${i === 0 ? `bg-primary/10 text-primary shadow-[0_8px_16px_-6px_var(--color-primary)]` : `text-muted-foreground hover:bg-muted/50 hover:text-foreground`}`}
                                    >
                                        <div className={`${i === 0 ? "text-primary" : "text-muted-foreground opacity-70"}`}>
                                            <item.icon size={22} strokeWidth={2.5} />
                                        </div>
                                        <span className="text-base">{item.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Main */}
                        <div className="flex-1 flex flex-col">
                            <div className="h-24 flex items-center justify-between px-10">
                                <div className="text-sm font-bold text-muted-foreground/70 tracking-widest uppercase">
                                    Hello, Alexander
                                </div>
                                <div className="flex gap-3">
                                    <button className="h-12 w-12 bg-white dark:bg-card shadow-[0_8px_20px_-10px_rgba(0,0,0,0.1)] rounded-2xl flex items-center justify-center text-muted-foreground hover:text-primary hover:-translate-y-1 transition-all">
                                        <Search size={22} />
                                    </button>
                                    <button className="px-6 h-12 bg-primary text-primary-foreground font-bold text-lg rounded-2xl shadow-[0_10px_20px_-10px_var(--color-primary)] hover:-translate-y-1 hover:shadow-[0_15px_25px_-10px_var(--color-primary)] transition-all flex items-center gap-2">
                                        <Plus size={22} strokeWidth={2.5} /> New
                                    </button>
                                </div>
                            </div>

                            <div className="p-10 flex-1 overflow-auto">

                                <h1 className="text-4xl font-bold mb-8">What are we analyzing today?</h1>

                                <div className="grid grid-cols-2 gap-8">
                                    {[
                                        { title: "Net Promoter Score", bg: "bg-gradient-to-br from-primary to-emerald-400", shadow: "var(--color-primary)" },
                                        { title: "Brand Awareness", bg: "bg-gradient-to-br from-secondary to-indigo-400", shadow: "var(--color-secondary)" },
                                        { title: "Q3 Market Research", bg: "bg-gradient-to-br from-accent to-rose-400", shadow: "var(--color-accent)" },
                                        { title: "Employee Happiness", bg: "bg-gradient-to-br from-orange-400 to-amber-300", shadow: "#fb923c" }
                                    ].map((item, i) => (
                                        <div
                                            key={i}
                                            style={{ boxShadow: `0 20px 40px -15px ${item.shadow}` }}
                                            className={`h-48 rounded-[2rem] p-8 text-white flex flex-col justify-between cursor-pointer transition-transform hover:-translate-y-2 group ${item.bg}`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
                                                    <BarChart2 size={24} strokeWidth={2.5} />
                                                </div>
                                                <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-xl text-xs font-bold uppercase tracking-wider">Active</span>
                                            </div>

                                            <div>
                                                <h3 className="text-2xl font-bold mb-1 group-hover:scale-105 origin-left transition-transform">{item.title}</h3>
                                                <p className="text-white/80 font-medium text-sm">Last updated 2 hours ago</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
