// Mirrors the backend mapping in builder-api/src/services/screenerRedirect.ts.
// Keep the two in sync: this is the builder-time preview; publish is authoritative.

// Maps an End node's Session Outcome to a status token GLE's screener callback
// accepts. Terminations collapse to "terminated" — never "complete".
export const screenerStatusForOutcome = (outcome: string | undefined): string => {
    const normalized = String(outcome ?? "").trim().toLowerCase();
    if (normalized === "" || normalized === "completed" || normalized === "complete") {
        return "complete";
    }
    if (normalized === "quality_terminate") {
        return "quality_terminate";
    }
    return "terminated";
};

// Builds the GLE screener callback URL for an End node's outcome. The
// [transactionid] placeholder is substituted per respondent by the runner.
export const buildEndNodeScreenerRedirect = (outcome: string | undefined, baseUrl: string): string => {
    const base = baseUrl.replace(/\/+$/, "");
    const status = screenerStatusForOutcome(outcome);
    return `${base}/screener/callback?transactionid=[transactionid]&status=${status}`;
};

// If `url` is already a GLE screener callback URL, return it with only the
// `status=` value rewritten to match `outcome` (base, transactionid token, and
// param order preserved). Returns null when `url` isn't a screener callback URL
// (a custom/empty value), so callers know to leave it untouched.
export const updateScreenerRedirectStatus = (
    url: string | undefined | null,
    outcome: string | undefined
): string | null => {
    if (!url) return null;
    if (!/\/screener\/callback\b/.test(url)) return null;
    if (!/[?&]status=/.test(url)) return null;
    const status = screenerStatusForOutcome(outcome);
    return url.replace(/([?&]status=)[^&#]*/, `$1${status}`);
};

// Base URL of GLE's screener that hosts /screener/callback (prod: set the env var).
export const SCREENER_CALLBACK_BASE_URL =
    process.env.NEXT_PUBLIC_GLE_SCREENER_CALLBACK_BASE_URL || "http://localhost:8787";
