"use client";
import React from 'react';
import { useRouter } from 'next/navigation';
import {
    IconBell,
    IconSearch,
    IconLogout,
    IconUserCircle,
    IconPlus
} from '@tabler/icons-react';
import { motion } from 'motion/react';
import NewSurveyModal from "@/components/SurveyModal";

export const DashboardHeader = () => {
    const router = useRouter();
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [user, setUser] = React.useState<any>(null);

    React.useEffect(() => {
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
            try {
                setUser(JSON.parse(storedUser));
            } catch (e) {
                console.error("Failed to parse user");
            }
        }
    }, []);

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        router.replace("/");
    };

    return (
        <>
            <NewSurveyModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={() => window.location.reload()} // Quick way to refresh list
            />

            <header className="h-20 bg-background/50 backdrop-blur-md border-b border-border px-8 flex items-center justify-between sticky top-0 z-30">
                <div className="flex-1 max-w-md">
                    <div className="relative group">
                        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Search surveys or respondents..."
                            className="w-full bg-muted/50 border border-transparent focus:border-primary/20 focus:bg-background h-10 pl-10 pr-4 rounded-xl text-sm outline-none transition-all"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-bold text-xs uppercase tracking-wider rounded-lg hover:opacity-90 transition-all hover:scale-[1.02] active:scale-95 shadow-md shadow-primary/20"
                    >
                        <IconPlus size={16} />
                        New Survey
                    </button>

                    <div className="h-6 w-px bg-border" />

                    <div className="flex items-center gap-3 group cursor-pointer">
                        <div className="text-right">
                            <p className="text-xs font-bold tracking-tight">{user?.name || "User Name"}</p>
                            <p className="text-[10px] text-muted-foreground">Premium Plan</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-muted border border-border flex items-center justify-center text-muted-foreground group-hover:border-primary/50 transition-colors bg-linear-to-br from-violet-500/10 to-indigo-500/10">
                            <IconUserCircle size={24} />
                        </div>
                    </div>

                    <button
                        onClick={handleLogout}
                        className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all"
                        title="Logout"
                    >
                        <IconLogout size={20} />
                    </button>
                </div>
            </header>
        </>
    );
};
