"use client";
import React, { SubmitEvent, useEffect, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { authApi } from "@/api/auth";
import { useRouter } from "next/navigation";
import Image from "next/image";
import logo from "@/public/logo.jpg"
import { toast } from "sonner";
import { toUserMessage } from "@/lib/api-error";

import { LoginSchema, LoginData } from "@/src/shared/common";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      router.replace("/dashboard");
    } else {
      setIsChecking(false);
    }
  }, [router]);

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate inputs using SSOT Schema
      const validation = LoginSchema.safeParse({ email, password });

      if (!validation.success) {
        // Display the first error message
        const errorMessage = validation.error.message;
        toast.error(errorMessage);
        setLoading(false);
        return;
      }

      const response = await authApi.login(validation.data as LoginData);
      toast.success("Login successful! Welcome back.");

      // Store token
      localStorage.setItem("token", response.token);
      localStorage.setItem("user", JSON.stringify(response.user));

      // Redirect to home or dashboard
      router.push("/dashboard");
    } catch (err: any) {
      console.error("Login failed:", err);
      toast.error(toUserMessage(err, "Something went wrong. Please try again."));
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

      <form className="my-8" onSubmit={handleSubmit}>
        <LabelInputContainer className="mb-4">
          <Label htmlFor="email" className="text-foreground">Email Address</Label>
          <Input
            id="email"
            placeholder="projectmayhem@fc.com"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="bg-background border-border text-foreground placeholder:text-muted-foreground"
          />
        </LabelInputContainer>
        <LabelInputContainer className="mb-4">
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
          className="group/btn cursor-pointer relative block h-10 w-full rounded-md bg-primary text-primary-foreground font-medium shadow-sm hover:opacity-90 transition-all disabled:opacity-50"
          type="submit"
          disabled={loading}
        >
          {loading ? "Logging in..." : "Login →"}
          <BottomGradient />
        </button>

        <div className="my-8 h-1 w-full bg-linear-gradient-to-r from-transparent via-border to-transparent" />
      </form>
    </div>
  );
}



const BottomGradient = () => {
  return (
    <>
      <span className="absolute inset-x-0 -bottom-px block h-px w-full bg-liner-to-r from-transparent via-cyan-500 to-transparent opacity-0 transition duration-500 group-hover/btn:opacity-100" />
      <span className="absolute inset-x-10 -bottom-px mx-auto block h-px w-1/2 bg-liner-to-r from-transparent via-indigo-500 to-transparent opacity-0 blur-sm transition duration-500 group-hover/btn:opacity-100" />
    </>
  );
};

const LabelInputContainer = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <div className={cn("flex w-full flex-col space-y-2", className)}>
      {children}
    </div>
  );
};
