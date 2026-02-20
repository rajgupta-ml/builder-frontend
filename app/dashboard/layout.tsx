"use client"
import AuthGuard from "@/components/AuthGuard";
import { DashboardSidebar } from "@/components/dashboard/Sidebar";
import { DashboardHeader } from "@/components/dashboard/Header";
import { usePathname } from "next/navigation";
import { Inter, JetBrains_Mono } from "next/font/google";

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });
export const jetBrainsMono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "700"] });

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();

    // Hide sidebar and header for the builder page specifically
    // Pattern: /dashboard/surveys/[uuid] (but not /metrics)
    const isBuilder = /^\/dashboard\/surveys\/[^\/]+$/.test(pathname);

    if (isBuilder) {
        return (
            <AuthGuard>
                <div className="h-screen w-full overflow-hidden">
                    {children}
                </div>
            </AuthGuard>
        );
    }

    return (
        <AuthGuard>
            <div className={`flex h-screen w-full bg-background text-foreground transition-all ${inter.className}`}>
                <DashboardSidebar />
                <div className="flex-1 flex flex-col overflow-hidden bg-background relative">
                    <div className="relative z-10 flex flex-col h-full">
                        <DashboardHeader />
                        <main className="flex-1 overflow-y-auto w-full relative">
                            {children}
                        </main>
                    </div>
                </div>
            </div>
        </AuthGuard>
    );
}
