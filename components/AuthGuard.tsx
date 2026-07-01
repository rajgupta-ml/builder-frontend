"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/api/auth";
import { reportApiError } from "@/lib/error-reporter";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const router = useRouter();

    useEffect(() => {
        let isMounted = true;

        const verifyToken = async () => {
            const token = localStorage.getItem("idToken");
            if (!token) {
                if (isMounted) {
                    setIsAuthenticated(false);
                }
                router.replace("/");
                return;
            }

            try {
                const me = await authApi.me();
                if (me?.user) {
                    localStorage.setItem("user", JSON.stringify(me.user));
                }
                if (isMounted) {
                    setIsAuthenticated(true);
                }
            } catch (error) {
                reportApiError(error, { location: "AuthGuard.verifyToken" });
                localStorage.removeItem("idToken");
                localStorage.removeItem("user");
                if (isMounted) {
                    setIsAuthenticated(false);
                }
                router.replace("/");
            }
        };

        verifyToken();
        return () => {
            isMounted = false;
        };
    }, [router]);

    // Prevent flash of content
    if (isAuthenticated === null) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-muted border-t-primary"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    return <>{children}</>;
}
