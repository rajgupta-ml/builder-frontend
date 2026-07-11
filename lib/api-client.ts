import axios from "axios";
import { reportApiError } from "@/lib/error-reporter";
import { getPublicEnv } from "@/lib/env";
import { captureException } from "@/lib/observability";
import { getOrCreateTraceId, TRACE_ID_HEADER } from "@/lib/trace";
import { refreshSession, signOut } from "@/lib/cognito";

const { NEXT_PUBLIC_API_URL } = getPublicEnv();
const API_URL = NEXT_PUBLIC_API_URL;

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
  timeout: 15000,
});

const MAX_GET_RETRIES = 2;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getRetryDelay = (attempt: number) => {
  const base = 250 * Math.pow(2, attempt - 1);
  const jitter = Math.floor(Math.random() * 120);
  return base + jitter;
};

const clearAuthStateAndRedirect = () => {
  if (typeof window === "undefined") return;
  signOut();
  localStorage.removeItem("accessToken");
  localStorage.removeItem("user");
  if (window.location.pathname !== "/") {
    window.location.href = "/";
  }
};

apiClient.interceptors.request.use(
  (config) => {
    config.headers = config.headers ?? {};
    config.headers[TRACE_ID_HEADER] = getOrCreateTraceId();
    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as
      | (typeof error.config & { _retry?: boolean; _retryCount?: number })
      | undefined;

    if (!originalRequest) {
      reportApiError(error, { phase: "response", reason: "missing_config" });
      void captureException(error, {
        operation: "api.response.missing_config",
        traceId: getOrCreateTraceId(),
      });
      return Promise.reject(error);
    }

    const method = (originalRequest.method || "get").toLowerCase();
    const status = error.response?.status as number | undefined;
    const isNetworkError = !error.response;
    const isTimeout = error.code === "ECONNABORTED";
    const isRetryableStatus = status === 502 || status === 503 || status === 504;
    const isAborted = Boolean(originalRequest.signal?.aborted);
    const retryCount = originalRequest._retryCount ?? 0;
    const isRefreshCall = originalRequest?.url?.includes("/auth/refresh");

    if (
      method === "get" &&
      !isRefreshCall &&
      !isAborted &&
      retryCount < MAX_GET_RETRIES &&
      (isNetworkError || isTimeout || isRetryableStatus)
    ) {
      const nextAttempt = retryCount + 1;
      originalRequest._retryCount = nextAttempt;
      await sleep(getRetryDelay(nextAttempt));
      return apiClient(originalRequest);
    }

    if (status === 401 && !isRefreshCall && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const newToken = await refreshSession();
        if (typeof window !== "undefined") {
          localStorage.setItem("accessToken", newToken);
        }
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch {
        clearAuthStateAndRedirect();
      }
    }

    if (!isAborted && (!status || status >= 500)) {
      void captureException(error, {
        operation: originalRequest.url || "api.request",
        traceId: error?.response?.data?.traceId || getOrCreateTraceId(),
        requestId: error?.response?.data?.requestId,
        extra: {
          status,
          method,
          retryCount,
        },
      });
      reportApiError(error, {
        phase: "response",
        method,
        url: originalRequest.url,
        retryCount,
      });
    }

    return Promise.reject(error);
  }
);

export default apiClient;
