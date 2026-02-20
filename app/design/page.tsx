"use client";

import React from "react";
import { motion } from "framer-motion";
import { Folder, Pencil, BarChart2, Trash2, CircleDashed, Fingerprint, Activity } from "lucide-react";

import { Space_Grotesk, Playfair_Display, JetBrains_Mono, Outfit } from "next/font/google";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["400", "700"] });
const playfair = Playfair_Display({ subsets: ["latin"], weight: ["400", "600", "700"], style: ["italic", "normal"] });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "700"] });
const outfit = Outfit({ subsets: ["latin"], weight: ["300", "500", "800"] });

export default function DesignShowcase() {
    return (
        <div className="min-h-screen bg-background text-foreground p-8 md:p-16 space-y-32">
            <div className="max-w-4xl mx-auto space-y-6 text-center">
                <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight">Survey Card Design Showcase</h1>
                <p className="text-xl text-muted-foreground mx-auto max-w-2xl leading-relaxed">
                    Exploring 5 radically different aesthetic directions based on the frontend skill guidelines. No generic layouts—just bold, unforgettable design choices.
                </p>
            </div>

            <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-16 justify-items-center items-center">

                {/* Variation 1: Neo-Brutalism */}
                <div className="w-full space-y-6">
                    <div className="space-y-2">
                        <h2 className={`text-2xl font-bold ${spaceGrotesk.className}`}>1. Neo-Brutalism</h2>
                        <p className="text-sm text-muted-foreground">Raw, high-contrast, structural. Heavy black borders, harsh shadows, and playful accent colors.</p>
                    </div>
                    <motion.div
                        whileHover={{ x: -6, y: -6, boxShadow: "14px 14px 0px 0px var(--color-foreground)" }}
                        className={`${spaceGrotesk.className} w-full bg-card border-[3px] border-foreground p-6 relative transition-all duration-200 shadow-[8px_8px_0px_0px_var(--color-foreground)]`}
                    >
                        <div className="absolute -top-4 -right-4 bg-primary text-primary-foreground text-sm font-bold px-4 py-2 border-[3px] border-foreground uppercase tracking-widest transform rotate-3 z-10">
                            Draft
                        </div>

                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-14 h-14 bg-secondary flex items-center justify-center border-[3px] border-foreground rounded-full shadow-[4px_4px_0px_0px_var(--color-foreground)]">
                                <Folder className="text-primary-foreground" size={26} strokeWidth={2.5} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black leading-none mb-1 text-foreground uppercase">Test Survey</h3>
                                <p className="text-xs font-bold text-foreground opacity-80 uppercase tracking-widest">2/20/2026 • Acme Corp</p>
                            </div>
                        </div>

                        <p className="text-lg font-bold mb-8 leading-snug text-foreground opacity-90 border-l-[3px] border-accent pl-3">
                            This is a test survey to collect initial feedback.
                        </p>

                        <div className="flex gap-4 border-t-[3px] border-foreground pt-5">
                            <button className="flex-1 flex justify-center items-center gap-2 font-bold py-2 bg-primary/20 hover:bg-primary hover:text-primary-foreground border-[3px] border-foreground transition-colors shadow-[2px_2px_0px_0px_var(--color-foreground)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]">
                                <Pencil size={18} strokeWidth={2.5} /> Edit
                            </button>
                            <button className="flex-1 flex justify-center items-center gap-2 font-bold py-2 bg-secondary/20 hover:bg-secondary hover:text-primary-foreground border-[3px] border-foreground transition-colors shadow-[2px_2px_0px_0px_var(--color-foreground)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]">
                                <BarChart2 size={18} strokeWidth={2.5} /> Metrics
                            </button>
                            <button className="px-4 flex justify-center items-center gap-2 font-bold py-2 bg-destructive/20 hover:bg-destructive hover:text-destructive-foreground border-[3px] border-foreground transition-colors shadow-[2px_2px_0px_0px_var(--color-foreground)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]">
                                <Trash2 size={18} strokeWidth={2.5} />
                            </button>
                        </div>
                    </motion.div>
                </div>

                {/* Variation 2: Luxury Editorial */}
                <div className="w-full space-y-6">
                    <div className="space-y-2">
                        <h2 className={`text-2xl font-bold ${playfair.className}`}>2. Luxury Editorial</h2>
                        <p className="text-sm text-muted-foreground">Minimal, refined, elegant. Large serif typography, generous white space, and subtle gradients.</p>
                    </div>
                    <div className={`${playfair.className} w-full bg-background border border-border p-8 hover:shadow-2xl transition-all duration-500 group relative overflow-hidden h-full`}>
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-40 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                        <div className="absolute bottom-0 left-0 w-40 h-40 bg-secondary/10 rounded-full blur-50 opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none delay-100" />

                        <div className="flex justify-between items-start mb-12 relative z-10">
                            <span className="text-[10px] sm:text-xs tracking-[0.2em] text-muted-foreground uppercase font-sans">20 Feb 26 / Acme</span>
                            <span className="text-[10px] sm:text-xs tracking-[0.2em] text-primary italic">Draft</span>
                        </div>

                        <div className="mb-10 relative z-10">
                            <h3 className="text-4xl font-medium mb-4 text-foreground leading-tight tracking-tight group-hover:text-primary transition-colors duration-500">
                                Test <br /><span className="italic text-muted-foreground group-hover:text-secondary transition-colors duration-700">Survey</span>
                            </h3>
                            <p className="text-muted-foreground font-sans text-sm leading-relaxed max-w-[85%]">
                                This is a test survey to collect initial feedback, evaluated through an editorial lens.
                            </p>
                        </div>

                        <div className="flex items-center gap-6 font-sans text-[10px] sm:text-xs tracking-widest uppercase relative z-10">
                            <button className="hover:text-primary transition-colors flex items-center gap-2 border-b border-transparent hover:border-primary pb-1">
                                Edit View
                            </button>
                            <button className="hover:text-secondary transition-colors flex items-center gap-2 border-b border-transparent hover:border-secondary pb-1">
                                Metrics
                            </button>
                            <button className="ml-auto text-destructive hover:opacity-70 transition-opacity flex items-center gap-2">
                                <Trash2 size={16} strokeWidth={1} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Variation 3: Industrial / Utilitarian */}
                <div className="w-full space-y-6">
                    <div className="space-y-2">
                        <h2 className={`text-2xl font-bold ${mono.className}`}>3. Industrial Utilitarian</h2>
                        <p className="text-sm text-muted-foreground">Dense, structured, dashboard-pro. Monospaced type, strict grids, and data-centric visual language.</p>
                    </div>
                    <div className={`${mono.className} w-full bg-card border border-border flex flex-col hover:border-primary transition-colors duration-300 shadow-sm overflow-hidden h-full`}>
                        <div className="flex justify-between items-center border-b border-border px-4 py-3 bg-muted/40">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <CircleDashed size={14} className="text-primary animate-[spin_4s_linear_infinite]" />
                                <span className="tracking-wider">SYS.SRV.402</span>
                            </div>
                            <div className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 border border-primary/20 tracking-widest font-bold">
                                STATUS: DRAFT
                            </div>
                        </div>

                        <div className="p-5 flex-1 pt-6">
                            <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-3">
                                <Folder size={18} className="text-secondary" />
                                Test_Survey.data
                            </h3>
                            <div className="grid grid-cols-2 gap-y-3 text-xs mb-6 border-l-2 border-border pl-3">
                                <div className="text-muted-foreground">CLIENT_ID</div>
                                <div className="text-foreground font-medium">Acme Corp</div>
                                <div className="text-muted-foreground">CREATED_AT</div>
                                <div className="text-foreground font-medium">2026-02-20</div>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed"> This is a test survey. Initializing feedback matrix and compiling participant data streams.
                            </p>
                        </div>

                        <div className="grid grid-cols-3 border-t border-border mt-auto bg-muted/20">
                            <button className="py-4 flex flex-col items-center gap-2 text-[10px] tracking-widest hover:bg-primary/5 hover:text-primary text-muted-foreground border-r border-border transition-colors font-bold">
                                <Pencil size={16} /> EDIT
                            </button>
                            <button className="py-4 flex flex-col items-center gap-2 text-[10px] tracking-widest hover:bg-secondary/5 hover:text-secondary text-muted-foreground border-r border-border transition-colors font-bold">
                                <Activity size={16} /> DATA
                            </button>
                            <button className="py-4 flex flex-col items-center gap-2 text-[10px] tracking-widest hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors font-bold">
                                <Trash2 size={16} /> DEL
                            </button>
                        </div>
                    </div>
                </div>

                {/* Variation 4: Dark Cyberpunk */}
                <div className="w-full space-y-6">
                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold">4. Cyberpunk Neon</h2>
                        <p className="text-sm text-muted-foreground">Dark, glowing context. Neon box shadows, transparent borders, and sci-fi aesthetic elements.</p>
                    </div>
                    {/* Forced dark mode wrapper for this specific variation */}
                    <div className="dark bg-[#0a0a0a] border border-white/10 p-1 w-full relative sm:h-[400px]">
                        <div className="p-6 md:p-8 w-full h-full relative group overflow-hidden">
                            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-size:20px_20px pointer-events-none" />
                            <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/20 rounded-full blur-[60px] group-hover:bg-primary/40 transition-colors duration-700 pointer-events-none" />
                            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-secondary/20 rounded-full blur-[60px] group-hover:bg-secondary/40 transition-colors duration-700 pointer-events-none" />

                            <div className="relative z-10 flex flex-col h-full">
                                <div className="flex justify-between items-start mb-8 text-white/50">
                                    <div className="flex items-center gap-2">
                                        <Fingerprint className="text-secondary opacity-70" size={20} />
                                        <span className="text-xs font-mono tracking-widest">TS-001</span>
                                    </div>
                                    <span className="text-[10px] font-mono border border-primary text-primary px-2 py-1 shadow-[0_0_10px_var(--color-primary)] bg-primary/10 tracking-widest">
                                        DRAFT
                                    </span>
                                </div>

                                <h3 className="text-3xl font-bold bg-gradient-to-r from-white to-white/50 bg-clip-text text-transparent mb-2 tracking-tight">
                                    Test Survey
                                </h3>
                                <p className="text-xs font-mono text-secondary mb-6 tracking-widest opacity-80">
                  // ACME CORP / 26.02.20
                                </p>

                                <p className="text-white/70 text-sm mb-10 font-sans leading-relaxed">
                                    Initializing feedback matrix. Collecting participant streams and compiling into primary databanks.
                                </p>

                                <div className="mt-auto flex gap-3">
                                    <button className="flex-1 py-3 px-4 bg-white/5 hover:bg-primary/20 text-white font-mono text-xs border border-white/10 hover:border-primary/50 transition-all hover:shadow-[0_0_15px_var(--color-primary)] flex justify-center items-center gap-2 backdrop-blur-sm">
                                        <Pencil size={14} /> EDIT
                                    </button>
                                    <button className="flex-1 py-3 px-4 bg-white/5 hover:bg-secondary/20 text-white font-mono text-xs border border-white/10 hover:border-secondary/50 transition-all hover:shadow-[0_0_15px_var(--color-secondary)] flex justify-center items-center gap-2 backdrop-blur-sm">
                                        <BarChart2 size={14} /> METRICS
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Variation 5: Organic Playful */}
                <div className="w-full space-y-6 md:col-span-2 lg:col-span-1">
                    <div className="space-y-2">
                        <h2 className={`text-2xl font-bold ${outfit.className}`}>5. Organic Soft Max</h2>
                        <p className="text-sm text-muted-foreground">Friendly, floaty, squircle forms. Deep soft shadows, fluid layouts, vibrant gradients, and large border radii.</p>
                    </div>
                    <motion.div
                        whileHover={{ y: -8, scale: 1.02 }}
                        className={`${outfit.className} w-full bg-background rounded-[2rem] p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.15)] border border-border/50 transition-all duration-400 relative overflow-hidden sm:h-[400px] flex flex-col`}
                    >
                        <div className="absolute top-0 right-0 w-56 h-56 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-full blur-[40px] -translate-y-1/2 translate-x-1/4 pointer-events-none" />
                        <div className="absolute bottom-0 left-0 w-40 h-40 bg-accent/20 rounded-full blur-[40px] translate-y-1/2 -translate-x-1/4 pointer-events-none" />

                        <div className="relative z-10 flex flex-col h-full flex-1">
                            <div className="flex justify-between items-center mb-8">
                                <div className="w-16 h-16 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-2xl flex items-center justify-center text-primary shadow-inner border border-white/20 backdrop-blur-sm">
                                    <Folder size={32} strokeWidth={2} />
                                </div>
                                <span className="bg-primary/10 text-primary px-4 py-1.5 rounded-full text-xs font-bold tracking-wide">
                                    Draft Idea
                                </span>
                            </div>

                            <h3 className="text-3xl font-extrabold text-foreground mb-1 tracking-tight">Test Survey</h3>
                            <p className="text-sm font-medium text-muted-foreground mb-6 opacity-80">Acme Corp • 2/20/2026</p>

                            <p className="text-foreground/80 mb-8 leading-relaxed font-medium text-[15px]">
                                This is a test survey to collect initial feedback in a friendly and highly approachable manner.
                            </p>

                            <div className="flex gap-3 mt-auto">
                                <button className="flex-1 bg-muted/40 hover:bg-primary text-foreground hover:text-primary-foreground py-4 rounded-2xl flex justify-center items-center gap-2 font-bold transition-all duration-300 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-1">
                                    <Pencil size={18} /> Edit
                                </button>
                                <button className="flex-1 bg-muted/40 hover:bg-secondary text-foreground hover:text-primary-foreground py-4 rounded-2xl flex justify-center items-center gap-2 font-bold transition-all duration-300 hover:shadow-xl hover:shadow-secondary/30 hover:-translate-y-1">
                                    <BarChart2 size={18} /> Metrics
                                </button>
                                <button className="w-14 bg-muted/40 hover:bg-destructive text-foreground hover:text-destructive-foreground py-4 rounded-2xl flex justify-center items-center transition-all duration-300 hover:shadow-xl hover:shadow-destructive/30 shrink-0 hover:-translate-y-1">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>

            </div>
        </div>
    );
}
