"use client";
import React, { useState, useEffect } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { signIn, completeNewPassword as cognitoCompleteNewPassword, type CognitoUser } from "@/lib/cognito";
import { authApi } from "@/api/auth";
import { useRouter } from "next/navigation";
import Image from "next/image";
import logo from "@/public/logo.jpg";
import { toast } from "sonner";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isChecking, setIsChecking] = useState(true);
  const [pendingCognitoUser, setPendingCognitoUser] = useState<CognitoUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("idToken");
    if (token) {
      router.replace("/dashboard");
    } else {
      setIsChecking(false);
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await signIn(email, password);
      if ("newPasswordRequired" in result) {
        setPendingCognitoUser(result.cognitoUser);
        setLoading(false);
        return;
      }
      localStorage.setItem("idToken", result.idToken);
      const { user } = await authApi.me();
      localStorage.setItem("user", JSON.stringify(user));
      toast.success("Login successful! Welcome back.");
      router.push("/dashboard");
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      const result = await cognitoCompleteNewPassword(pendingCognitoUser!, newPassword);
      localStorage.setItem("idToken", result.idToken);
      const { user } = await authApi.me();
      localStorage.setItem("user", JSON.stringify(user));
      toast.success("Password set. Welcome!");
      router.push("/dashboard");
    } catch (err: any) {
      setError(err?.message || "Failed to set password");
    } finally {
      setLoading(false);
    }
  };

  if (isChecking) {
    return (
      <div className="flex h-[400px] w-full items-center justify-center rounded-2xl border border-border bg-card shadow-sm">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  if (pendingCognitoUser) {
    return (
      <div className="border border-border mx-auto w-full max-w-md rounded-none p-4 md:rounded-2xl md:p-8 bg-card text-card-foreground shadow-sm">
        <h2 className="text-2xl font-bold mb-2">Set Your Password</h2>
        <p className="text-sm text-muted-foreground mb-6">
          You've been invited — set your permanent password to continue.
        </p>
        <form className="space-y-4" onSubmit={handleNewPassword}>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <LabelInputContainer>
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
            />
          </LabelInputContainer>
          <LabelInputContainer>
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </LabelInputContainer>
          <button
            type="submit"
            className="w-full h-10 rounded-md bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? <Spinner className="mx-auto h-4 w-4" /> : "Set Password & Continue"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="border border-border mx-auto w-full max-w-md rounded-none p-4 md:rounded-2xl md:p-8 bg-card text-card-foreground shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 border border-border flex items-center justify-center bg-muted/20 rounded-sm overflow-hidden relative shrink-0">
          <Image
            src={logo}
            alt="Survey Studios Logo"
            width={32}
            height={32}
            priority
            className="object-contain"
          />
        </div>
        <h2 className="text-2xl font-bold">Survey Studios</h2>
      </div>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Access the Survey Studio to build and manage your research workflows.
      </p>

      <form className="my-8 space-y-4" onSubmit={handleLogin}>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <LabelInputContainer>
          <Label htmlFor="email" className="text-foreground">Email Address</Label>
          <Input
            id="email"
            placeholder="name@company.com"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="bg-background border-border text-foreground placeholder:text-muted-foreground"
          />
        </LabelInputContainer>
        <LabelInputContainer>
          <Label htmlFor="password" className="text-foreground">Password</Label>
          <Input
            id="password"
            placeholder="••••••••"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="bg-background border-border text-foreground placeholder:text-muted-foreground"
          />
        </LabelInputContainer>
        <button
          type="submit"
          className="group/btn cursor-pointer relative block h-10 w-full rounded-md bg-primary text-primary-foreground font-medium shadow-sm hover:opacity-90 transition-all disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Logging in..." : "Login →"}
          <BottomGradient />
        </button>
      </form>
    </div>
  );
}

const BottomGradient = () => (
  <>
    <span className="absolute inset-x-0 -bottom-px block h-px w-full bg-liner-to-r from-transparent via-cyan-500 to-transparent opacity-0 transition duration-500 group-hover/btn:opacity-100" />
    <span className="absolute inset-x-10 -bottom-px mx-auto block h-px w-1/2 bg-liner-to-r from-transparent via-indigo-500 to-transparent opacity-0 blur-sm transition duration-500 group-hover/btn:opacity-100" />
  </>
);

const LabelInputContainer = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={cn("flex w-full flex-col space-y-2", className)}>
    {children}
  </div>
);
