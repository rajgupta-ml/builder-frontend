"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/api/auth";
import { toUserMessage } from "@/lib/api-error";
import { toast } from "sonner";
import { IconLock, IconLogout, IconUser } from "@tabler/icons-react";
import type { User } from "@/types/auth";

const passwordPolicyMessage =
    "Use at least 8 characters with uppercase, lowercase, number, and special character.";

export default function SettingsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [savingProfile, setSavingProfile] = useState(false);
    const [changingPassword, setChangingPassword] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);

    const [user, setUser] = useState<User | null>(null);
    const [name, setName] = useState("");
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    useEffect(() => {
        const fetchMe = async () => {
            setLoading(true);
            try {
                const result = await authApi.me();
                setUser(result.user);
                setName(result.user.name || "");
            } catch (error) {
                toast.error(toUserMessage(error, "Failed to load profile"));
            } finally {
                setLoading(false);
            }
        };
        void fetchMe();
    }, []);

    const handleSaveProfile = async () => {
        if (!name.trim()) {
            toast.error("Name is required");
            return;
        }

        setSavingProfile(true);
        try {
            const result = await authApi.updateMe({ name: name.trim() });
            setUser(result.user);
            localStorage.setItem("user", JSON.stringify(result.user));
            toast.success(result.message || "Profile updated");
        } catch (error) {
            toast.error(toUserMessage(error, "Failed to update profile"));
        } finally {
            setSavingProfile(false);
        }
    };

    const handleChangePassword = async () => {
        if (!currentPassword || !newPassword || !confirmPassword) {
            toast.error("Please fill all password fields");
            return;
        }
        if (newPassword !== confirmPassword) {
            toast.error("New password and confirmation do not match");
            return;
        }

        setChangingPassword(true);
        try {
            const result = await authApi.changePassword({ currentPassword, newPassword });
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            toast.success(result.message || "Password changed. Please log in again.");
            router.replace("/");
        } catch (error) {
            toast.error(toUserMessage(error, "Failed to change password"));
        } finally {
            setChangingPassword(false);
        }
    };

    const handleLogout = async () => {
        setLoggingOut(true);
        try {
            await authApi.logout();
        } catch {
            // no-op: local logout still applies
        } finally {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            router.replace("/");
            setLoggingOut(false);
        }
    };

    if (loading) {
        return (
            <div className="p-8 md:p-12">
                <div className="max-w-3xl mx-auto text-sm text-muted-foreground">Loading settings...</div>
            </div>
        );
    }

    return (
        <div className="p-8 md:p-12">
            <div className="max-w-3xl mx-auto space-y-6">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
                    <p className="text-sm text-muted-foreground mt-1">Manage profile, password, and session.</p>
                </div>

                <div className="bg-background border border-border/60 rounded-xl p-6 space-y-4">
                    <h2 className="text-sm font-semibold flex items-center gap-2">
                        <IconUser size={16} />
                        Profile
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs text-muted-foreground">Name</label>
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full h-10 rounded-md border border-border px-3 text-sm bg-background"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs text-muted-foreground">Email (read-only)</label>
                            <input
                                title="email"
                                value={user?.email || ""}
                                readOnly
                                className="w-full h-10 rounded-md border border-border px-3 text-sm bg-muted/30 text-muted-foreground"
                            />
                        </div>
                    </div>
                    <div>
                        <button
                            onClick={handleSaveProfile}
                            disabled={savingProfile}
                            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
                        >
                            {savingProfile ? "Saving..." : "Save Profile"}
                        </button>
                    </div>
                </div>

                <div className="bg-background border border-border/60 rounded-xl p-6 space-y-4">
                    <h2 className="text-sm font-semibold flex items-center gap-2">
                        <IconLock size={16} />
                        Change Password
                    </h2>
                    <p className="text-xs text-muted-foreground">{passwordPolicyMessage}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2 md:col-span-2">
                            <label className="text-xs text-muted-foreground">Current Password</label>
                            <input
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="w-full h-10 rounded-md border border-border px-3 text-sm bg-background"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs text-muted-foreground">New Password</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full h-10 rounded-md border border-border px-3 text-sm bg-background"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs text-muted-foreground">Confirm New Password</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full h-10 rounded-md border border-border px-3 text-sm bg-background"
                            />
                        </div>
                    </div>
                    <div>
                        <button
                            onClick={handleChangePassword}
                            disabled={changingPassword}
                            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
                        >
                            {changingPassword ? "Updating..." : "Update Password"}
                        </button>
                    </div>
                </div>

                <div className="bg-background border border-border/60 rounded-xl p-6 flex items-center justify-between">
                    <div>
                        <h2 className="text-sm font-semibold">Session</h2>
                        <p className="text-xs text-muted-foreground mt-1">Sign out from this account.</p>
                    </div>
                    <button
                        onClick={handleLogout}
                        disabled={loggingOut}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border text-sm font-medium hover:bg-muted disabled:opacity-60"
                    >
                        <IconLogout size={16} />
                        {loggingOut ? "Logging out..." : "Logout"}
                    </button>
                </div>
            </div>
        </div>
    );
}

