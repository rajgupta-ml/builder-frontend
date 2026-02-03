import AuthGuard from "@/components/AuthGuard";

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <AuthGuard>
            <div className="flex h-screen w-full">
                <div className="flex-1 relative">
                    {children}
                </div>
            </div>
        </AuthGuard>
    );
}