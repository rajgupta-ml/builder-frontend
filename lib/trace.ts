const TRACE_STORAGE_KEY = "surveychamp.builder.traceId";

export const TRACE_ID_HEADER = "x-trace-id";

export const getOrCreateTraceId = () => {
  if (typeof window === "undefined" || typeof window.sessionStorage === "undefined") {
    return crypto.randomUUID();
  }

  const existing = window.sessionStorage.getItem(TRACE_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const created = crypto.randomUUID();
  window.sessionStorage.setItem(TRACE_STORAGE_KEY, created);
  return created;
};
