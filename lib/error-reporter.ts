import { parseApiError } from "@/lib/api-error";

export type FrontendErrorKind =
  | "runtime"
  | "unhandled_rejection"
  | "api"
  | "auth"
  | "store";

export interface FrontendErrorEvent {
  kind: FrontendErrorKind;
  message: string;
  stack?: string;
  route?: string;
  status?: number;
  code?: string;
  requestId?: string;
  traceId?: string;
  details?: Record<string, unknown>;
}

const APP_ENV = process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || "development";

const getRoute = () => {
  if (typeof window === "undefined") return undefined;
  return window.location.pathname;
};

export const reportError = (event: FrontendErrorEvent) => {
  const payload = {
    ts: new Date().toISOString(),
    env: APP_ENV,
    ...event,
    route: event.route || getRoute(),
  };

  void fetch("/api/telemetry/errors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    // Never throw from telemetry.
  });
};

export const reportTelemetry = (event: {
  kind: string;
  message?: string;
  route?: string;
  traceId?: string;
  details?: Record<string, unknown>;
}) => {
  const payload = {
    ts: new Date().toISOString(),
    env: APP_ENV,
    ...event,
    route: event.route || getRoute(),
  };

  void fetch("/api/telemetry/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    // Never throw from telemetry.
  });
};

export const reportApiError = (
  error: unknown,
  details?: Record<string, unknown>
) => {
  const parsed = parseApiError(error);
  reportError({
    kind: "api",
    message: parsed.detail || "API request failed",
    status: parsed.status,
    code: parsed.code,
    requestId: parsed.requestId,
    traceId: parsed.traceId,
    details,
  });
};
