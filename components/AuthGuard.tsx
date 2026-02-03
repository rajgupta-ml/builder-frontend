"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/api/auth";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const router = useRouter();

    useEffect(() => {
        const verifyToken = async () => {
            const token = localStorage.getItem("token");
            if (!token) {
                router.replace("/");
                return;
            }

            try {
                await authApi.me();
                setIsAuthenticated(true);
            } catch (error) {
                console.error("Auth verification failed", error);
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                router.replace("/");
            }
        };

        verifyToken();
    }, [router]);

    // Prevent flash of content
    if (isAuthenticated === null) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-muted border-t-primary"></div>
            </div>
        );
    }

    return <>{children}</>;
}
