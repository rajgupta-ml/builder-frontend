export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-screen w-full">
            <div className="flex-1 relative">
                {children}
            </div>
        </div>
    );
}
