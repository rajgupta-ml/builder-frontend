"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { publicSharedDashboardApi, type SharedDashboardMeta, type SharedDashboardPayload } from "@/api/sharedLinks";
import { toUserMessage } from "@/lib/api-error";

type Step = "email" | "otp" | "ready";

const sessionKey = (token: string) => `public_quota_dashboard_session:${token}`;

const formatMetric = (value: number) => Number(value || 0).toLocaleString();

export default function SharedQuotaDashboardAccessPage() {
  const { token: tokenParam } = useParams() as { token?: string };
  const token = String(tokenParam || "");
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [grantToken, setGrantToken] = useState("");
  const [meta, setMeta] = useState<SharedDashboardMeta | null>(null);
  const [dashboard, setDashboard] = useState<SharedDashboardPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const missingToken = useMemo(() => token.trim().length === 0, [token]);

  const saveGrant = (value: string) => {
    try {
      localStorage.setItem(sessionKey(token), value);
    } catch {
      // Storage can be unavailable in private or restricted sessions.
    }
  };

  const clearGrant = useCallback(() => {
    try {
      localStorage.removeItem(sessionKey(token));
    } catch {
      // no-op
    }
  }, [token]);

  const fetchDashboard = useCallback(async (grant = grantToken) => {
    if (!grant) return false;
    try {
      setLoading(true);
      setError("");
      const payload = await publicSharedDashboardApi.getData(token, { grantToken: grant });
      setDashboard(payload);
      return true;
    } catch (err) {
      clearGrant();
      setError(toUserMessage(err, "Failed to load dashboard"));
      return false;
    } finally {
      setLoading(false);
    }
  }, [clearGrant, grantToken, token]);

  useEffect(() => {
    if (missingToken) return;

    const restore = async () => {
      try {
        setLoading(true);
        setError("");
        const nextMeta = await publicSharedDashboardApi.getMeta(token);
        setMeta(nextMeta);
        const savedGrant = localStorage.getItem(sessionKey(token)) || "";
        if (!savedGrant) {
          setStep("email");
          return;
        }

        setGrantToken(savedGrant);
        const ok = await fetchDashboard(savedGrant);
        setStep(ok ? "ready" : "email");
      } catch (err) {
        clearGrant();
        setError(toUserMessage(err, "Invalid or inactive dashboard link"));
        setStep("email");
      } finally {
        setLoading(false);
      }
    };

    void restore();
  }, [clearGrant, fetchDashboard, missingToken, token]);

  const requestOtp = async () => {
    if (!email.trim()) return;
    try {
      setLoading(true);
      setError("");
      const result = await publicSharedDashboardApi.requestOtp(token, email.trim());
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
      const result = await publicSharedDashboardApi.verifyOtp(token, { email: email.trim(), otp });
      setGrantToken(result.grantToken);
      saveGrant(result.grantToken);
      setStep("ready");
      await fetchDashboard(result.grantToken);
    } catch (err) {
      setError(toUserMessage(err, "Verification failed"));
    } finally {
      setLoading(false);
    }
  };

  if (missingToken) {
    return (
      <main className="min-h-screen bg-muted/20 flex items-center justify-center px-4">
        <div className="max-w-md rounded-xl border border-border/70 bg-background p-6 text-sm text-muted-foreground">
          Missing access token.
        </div>
      </main>
    );
  }

  if (step !== "ready") {
    return (
      <main className="min-h-screen bg-muted/20 flex items-center justify-center px-4 py-10">
        <section className="w-full max-w-lg bg-background border border-border/70 rounded-xl shadow-sm p-6">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Secure Client Dashboard</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Use the exact recipient email this link was generated for, then verify by OTP before opening.
          </p>

          {error && (
            <div className="my-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {meta && (
            <div className="my-4 rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              <div>Status: {meta.status}</div>
              <div>Mode: {meta.mode}</div>
              <div>Policy: {meta.expiryPolicy === "SURVEY_ARCHIVED" ? "Active until survey archive" : meta.expiryPolicy}</div>
            </div>
          )}

          <div className="mt-5 space-y-4">
            {step === "email" ? (
              <>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="authorized-client@work.com"
                  className="w-full h-10 rounded-md border border-border/70 bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
                <button className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60" disabled={loading || !email.trim()} onClick={requestOtp}>
                  {loading ? "Sending..." : "Send Verification Code"}
                </button>
              </>
            ) : (
              <>
                <input
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="w-full h-12 rounded-md border border-border/70 bg-background px-3 text-center text-lg font-mono tracking-[0.4em] outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
                <button className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60" disabled={loading || otp.length !== 6} onClick={verifyOtp}>
                  {loading ? "Verifying..." : "Open Dashboard"}
                </button>
              </>
            )}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-muted/20 px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-border/70 pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Secure Client Dashboard</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
              {dashboard?.survey.name || "Loading dashboard"}
            </h1>
            {dashboard?.survey.client && (
              <p className="mt-1 text-sm text-muted-foreground">{dashboard.survey.client}</p>
            )}
          </div>
          <button
            className="h-10 rounded-md border border-border/70 bg-background px-4 text-sm font-semibold hover:bg-muted/40 disabled:opacity-60"
            disabled={loading}
            onClick={() => void fetchDashboard()}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </header>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {dashboard && (
          <>
            <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
              {[
                ["Views", dashboard.metrics.views],
                ["Starts", dashboard.metrics.starts],
                ["Completes", dashboard.metrics.completes],
                ["IR", `${dashboard.metrics.ir}%`],
                ["Over Quota", dashboard.metrics.overQuota],
                ["Disqualified", dashboard.metrics.disqualified],
                ["Dropped", dashboard.metrics.dropped],
                ["Security Term.", dashboard.metrics.securityTerminate],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-border/70 bg-background p-4 shadow-sm">
                  <p className="text-xs font-semibold text-muted-foreground">{label}</p>
                  <p className="mt-2 text-2xl font-bold text-foreground">
                    {typeof value === "number" ? formatMetric(value) : value}
                  </p>
                </div>
              ))}
            </section>

            <section className="rounded-xl border border-border/70 bg-background p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Quota Distribution</h2>
                <p className="text-xs text-muted-foreground">
                  Last refreshed {new Date(dashboard.lastRefreshedAt).toLocaleString()}
                </p>
              </div>

              {dashboard.quotas.length === 0 ? (
                <div className="rounded-md border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
                  No quotas configured.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {dashboard.quotas.map((quota) => {
                    const pct = quota.targetCount > 0 ? Math.min(100, Math.round((quota.currentCount / quota.targetCount) * 100)) : 0;
                    return (
                      <div key={quota.quotaId} className="rounded-lg border border-border/70 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{quota.quotaName}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {formatMetric(quota.currentCount)} / {formatMetric(quota.targetCount)}
                            </p>
                          </div>
                          <span className={quota.isFull ? "text-xs font-bold text-red-600" : "text-xs font-bold text-emerald-600"}>
                            {quota.isFull ? "FULL" : "OPEN"}
                          </span>
                        </div>
                        <div className="mt-4 h-2 rounded-full bg-muted overflow-hidden">
                          <div className={quota.isFull ? "h-full bg-red-500" : "h-full bg-emerald-500"} style={{ width: `${pct}%` }} />
                        </div>
                        <p className="mt-2 text-right text-xs font-mono text-muted-foreground">{pct}%</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
