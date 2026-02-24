"use client";
import React, { useEffect } from 'react';
import {
    IconSearch,
    IconPlus
} from '@tabler/icons-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import NewSurveyModal from "@/components/SurveyModal";
import { getStoredUserRole, hasPermission, PERMISSIONS } from '@/lib/permissions';

export const DashboardHeader = () => {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const searchParamsString = searchParams.toString();
    const currentSearch = searchParams.get("search") ?? "";
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [canCreateSurvey, setCanCreateSurvey] = React.useState(false);
    const [searchValue, setSearchValue] = React.useState("");

    useEffect(() => {
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
            try {
                JSON.parse(storedUser);
            } catch (e) {
                console.error("Failed to parse user");
            }
        }
        const role = getStoredUserRole();
        setCanCreateSurvey(hasPermission(role, PERMISSIONS.SURVEY_CREATE));
    }, []);

    useEffect(() => {
        setSearchValue(currentSearch);
    }, [currentSearch]);

    useEffect(() => {
        const timeout = setTimeout(() => {
            if (searchValue === currentSearch) return;

            const nextParams = new URLSearchParams(searchParamsString);
            if (searchValue.trim()) {
                nextParams.set("search", searchValue.trim());
            } else {
                nextParams.delete("search");
            }

            const queryString = nextParams.toString();
            router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
        }, 300);

        return () => clearTimeout(timeout);
    }, [currentSearch, pathname, router, searchParamsString, searchValue]);

    return (
        <>
            <NewSurveyModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={() => { }} // Modal handles redirect
            />

            <header className="h-16 border-b border-border/60 flex items-center justify-between px-8 bg-background relative z-10 shrink-0">
                <div className="flex items-center text-sm w-96">
                    <IconSearch className="text-muted-foreground mr-3" size={16} />
                    <input
                        type="text"
                        placeholder="Search records..."
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        className="bg-transparent outline-none placeholder:text-muted-foreground/60 w-full"
                    />
                </div>

                <div className="flex gap-6 items-center">
                    {canCreateSurvey && (
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="flex items-center gap-2 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 transition-colors px-4 py-1.5 rounded-full"
                        >
                            <IconPlus size={14} /> New Survey
                        </button>
                    )}

                    <div className="h-6 w-px bg-border/60" />
                </div>
            </header>
        </>
    );
};
