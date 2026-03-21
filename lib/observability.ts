"use client";

import * as Sentry from "@sentry/browser";
import { getOrCreateTraceId } from "@/lib/trace";
import { reportError, reportTelemetry } from "@/lib/error-reporter";

type CaptureContext = {
  requestId?: string;
  traceId?: string;
  route?: string;
  operation?: string;
  extra?: Record<string, unknown>;
};

const errorTrackingDsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || "";
const observabilityEnabled = process.env.NEXT_PUBLIC_OBSERVABILITY_ENABLED !== "false";
let behaviorTrackingInitialized = false;
let errorTrackerInitialized = false;

const parseStack = (stack?: string) => {
  if (!stack) return undefined;
  const frames = stack
    .split("\n")
    .slice(1)
    .map((line) => line.trim())
    .map((line) => {
      const withFunction = line.match(/^at\s+(.*?)\s+\((.*):(\d+):(\d+)\)$/);
      if (withFunction) {
        return {
          function: withFunction[1],
          filename: withFunction[2],
          lineno: Number(withFunction[3]),
          colno: Number(withFunction[4]),
        };
      }
      const withoutFunction = line.match(/^at\s+(.*):(\d+):(\d+)$/);
      if (withoutFunction) {
        return {
          filename: withoutFunction[1],
          lineno: Number(withoutFunction[2]),
          colno: Number(withoutFunction[3]),
        };
      }
      return { filename: line };
    });
  return frames.length > 0 ? { frames: frames.reverse() } : undefined;
};

const ensureErrorTracker = () => {
  if (errorTrackerInitialized || !observabilityEnabled || !errorTrackingDsn) {
    return;
  }

  Sentry.init({
    dsn: errorTrackingDsn,
    enabled: true,
    environment: process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
    sendDefaultPii: false,
    defaultIntegrations: false,
  });
  errorTrackerInitialized = true;
};

const toError = (value: unknown) => value instanceof Error ? value : new Error(typeof value === "string" ? value : "Unknown error");

export const captureException = async (error: unknown, context: CaptureContext = {}) => {
  const resolved = toError(error);
  const traceId = context.traceId ?? getOrCreateTraceId();

  reportError({
    kind: "runtime",
    message: resolved.message,
    stack: resolved.stack,
    route: context.route,
    requestId: context.requestId,
    traceId,
    details: context.extra,
  });

  if (!observabilityEnabled || !errorTrackingDsn) {
    return;
  }

  try {
    ensureErrorTracker();
    Sentry.withScope((scope) => {
      const route = context.route ?? window.location.pathname;

      scope.setTag("app", "builder-frontend");
      scope.setTag("traceId", traceId);
      scope.setExtra("traceId", traceId);
      if (context.requestId) {
        scope.setTag("requestId", context.requestId);
        scope.setExtra("requestId", context.requestId);
      }
      scope.setTag("route", route);
      scope.setExtra("route", route);
      if (context.operation) {
        scope.setTag("operation", context.operation);
        scope.setExtra("operation", context.operation);
      }
      scope.setContext("correlation", {
        traceId,
        requestId: context.requestId,
        route,
        operation: context.operation,
      });
      if (context.extra) {
        scope.setContext("extra", context.extra);
      }
      Sentry.captureEvent({
        level: "error",
        message: `[traceId:${traceId}] ${resolved.message}`,
        exception: {
          values: [{
            type: resolved.name || "Error",
            value: `[traceId:${traceId}] ${resolved.message}`,
            stacktrace: parseStack(resolved.stack),
          }],
        },
      });
    });
  } catch (captureError) {
    console.error("Failed to send frontend exception", captureError);
  }
};

export const initBehaviorTracking = () => {
  if (!observabilityEnabled || typeof window === "undefined" || behaviorTrackingInitialized) {
    return;
  }
  behaviorTrackingInitialized = true;
  ensureErrorTracker();

  let lastRoute = "";
  const emitPageView = () => {
    const route = window.location.pathname;
    if (route === lastRoute) return;
    lastRoute = route;
    reportTelemetry({
      kind: "page_view",
      traceId: getOrCreateTraceId(),
      details: { href: window.location.href },
    });
  };

  const onClick = (event: MouseEvent) => {
    const target = event.target instanceof Element ? event.target.closest("button,a,[role='button']") : null;
    if (!target) return;
    reportTelemetry({
      kind: "ui_click",
      traceId: getOrCreateTraceId(),
      details: {
        tagName: target.tagName.toLowerCase(),
        id: target.getAttribute("id"),
        href: target.getAttribute("href"),
        label: (target.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80),
      },
    });
  };

  const originalPushState = window.history.pushState.bind(window.history);
  const originalReplaceState = window.history.replaceState.bind(window.history);
  window.history.pushState = (...args) => {
    originalPushState(...args);
    emitPageView();
  };
  window.history.replaceState = (...args) => {
    originalReplaceState(...args);
    emitPageView();
  };

  emitPageView();
  window.addEventListener("popstate", emitPageView);
  window.addEventListener("click", onClick, { capture: true });
};
