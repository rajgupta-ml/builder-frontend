"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { publicSharedExportApi, type SharedExportMeta } from "@/api/sharedLinks";
import { toUserMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";

type Step = "loading" | "email" | "otp" | "ready" | "done";

const getExportExtension = (format?: string) => format === "spss" ? "sps" : format || "csv";

export default function SharedExportAccessPage() {
  const { token: tokenParam } = useParams() as { token?: string };
  const token = String(tokenParam || "");
  const [step, setStep] = useState<Step>("loading");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [grantToken, setGrantToken] = useState("");
  const [meta, setMeta] = useState<SharedExportMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const missingToken = useMemo(() => token.trim().length === 0, [token]);

  const loadMeta = async () => {
    if (missingToken) return;
    try {
      setLoading(true);
      setError("");
      const nextMeta = await publicSharedExportApi.getMeta(token);
      setMeta(nextMeta);
      setStep("email");
    } catch (err) {
      setError(toUserMessage(err, "Invalid or expired export link"));
    } finally {
      setLoading(false);
    }
  };

  const requestOtp = async () => {
    if (!email.trim()) return;
    try {
      setLoading(true);
      setError("");
      const result = await publicSharedExportApi.requestOtp(token, email.trim());
      if (result.allowed !== true) {
        setError(result.message || "This email is not authorized for this link.");
        return;
      }
      setStep("otp");
    } catch (err) {
      setError(toUserMessage(err, "Failed to send verification code"));
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!email.trim() || otp.length !== 6) return;
    try {
      setLoading(true);
      setError("");
      const result = await publicSharedExportApi.verifyOtp(token, { email: email.trim(), otp });
      setGrantToken(result.grantToken);
      setStep("ready");
    } catch (err) {
      setError(toUserMessage(err, "Verification failed"));
    } finally {
      setLoading(false);
    }
  };

  const download = async () => {
    if (!grantToken) return;
    try {
      setLoading(true);
      setError("");
      const response = await publicSharedExportApi.download(token, { email: email.trim(), grantToken });
      const contentDisposition = response.headers["content-disposition"];
      let filename = `shared-export.${getExportExtension(meta?.format)}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match?.[1]) filename = match[1];
      }

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setStep("done");
    } catch (err) {
      setError(toUserMessage(err, "Download failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-muted/20 flex items-center justify-center px-4 py-10">
      <section className="w-full max-w-lg bg-background border border-border/70 rounded-xl shadow-sm p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Secure Export Access</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Use the exact recipient email this link was generated for, then verify by OTP before downloading.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {missingToken ? (
          <p className="text-sm text-muted-foreground">Missing access token.</p>
        ) : step === "loading" ? (
          <button className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold" disabled={loading} onClick={loadMeta}>
            {loading ? "Checking..." : "Continue"}
          </button>
        ) : (
          <div className="space-y-4">
            {meta && (
              <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                <div>Format: {meta.format.toUpperCase()}</div>
                <div>Mode: {meta.mode}</div>
                <div>Expires: {new Date(meta.expiresAt).toLocaleString()}</div>
              </div>
            )}

            {step === "email" && (
              <>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="authorized-recipient@work.com"
                  className="w-full h-10 rounded-md border border-border/70 bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
                <button className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60" disabled={loading || !email.trim()} onClick={requestOtp}>
                  {loading ? "Sending..." : "Send Verification Code"}
                </button>
              </>
            )}

            {step === "otp" && (
              <>
                <input
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="w-full h-12 rounded-md border border-border/70 bg-background px-3 text-center text-lg font-mono tracking-[0.4em] outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
                <button className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60" disabled={loading || otp.length !== 6} onClick={verifyOtp}>
                  {loading ? "Verifying..." : "Verify Code"}
                </button>
              </>
            )}

            {step === "ready" && (
              <button className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60" disabled={loading} onClick={download}>
                {loading ? "Preparing..." : "Download Export"}
              </button>
            )}

            {step === "done" && (
              <div className={cn("rounded-md border px-3 py-2 text-sm", "border-emerald-200 bg-emerald-50 text-emerald-700")}>
                Download complete. This single-use link may now be closed.
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
