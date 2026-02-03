"use client"
import AuthGuard from "@/components/AuthGuard";
import { DashboardSidebar } from "@/components/dashboard/Sidebar";
import { DashboardHeader } from "@/components/dashboard/Header";
import { usePathname } from "next/navigation";

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
            <div className="flex h-screen w-full bg-[#f9fafb] text-foreground transition-all">
                <DashboardSidebar />
                <div className="flex-1 flex flex-col overflow-hidden">
                    <DashboardHeader />
                    <main className="flex-1 overflow-y-auto w-full relative">
                        {children}
                    </main>
                </div>
            </div>
        </AuthGuard>
    );
}
