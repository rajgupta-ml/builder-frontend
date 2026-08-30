import axios from "axios";

export interface ApiValidationIssue {
  path: string;
  message: string;
  code?: string;
}

export interface NormalizedApiError {
  status?: number;
  code?: string;
  title?: string;
  detail?: string;
  requestId?: string;
  traceId?: string;
  errors?: ApiValidationIssue[];
  isNetworkError: boolean;
  isTimeout: boolean;
}

const MESSAGE_BY_CODE: Record<string, string> = {
  UNAUTHORIZED: "Your session expired. Please log in again.",
  FORBIDDEN: "You do not have permission to perform this action.",
  NOT_FOUND: "The requested resource was not found.",
  CONFLICT: "This action conflicts with current server state. Please refresh and try again.",
  VALIDATION_ERROR: "Please check the highlighted fields and try again.",
  SERVICE_UNAVAILABLE: "Service is temporarily unavailable. Please retry shortly.",
  INTERNAL_ERROR: "Something went wrong on our side. Please try again.",
  BAD_REQUEST: "Request was invalid. Please review inputs and try again.",
};

export const parseApiError = (error: unknown): NormalizedApiError => {
  if (!axios.isAxiosError(error)) {
    return {
      isNetworkError: false,
      isTimeout: false,
      detail: error instanceof Error ? error.message : "Unexpected error",
    };
  }

  const payload = error.response?.data as
    | {
        status?: number;
        code?: string;
        title?: string;
        detail?: string;
        requestId?: string;
        traceId?: string;
        errors?: ApiValidationIssue[];
      }
    | undefined;

  return {
    status: payload?.status ?? error.response?.status,
    code: payload?.code,
    title: payload?.title,
    detail: payload?.detail ?? error.message,
    requestId: payload?.requestId,
    traceId: payload?.traceId,
    errors: payload?.errors,
    isNetworkError: !error.response,
    isTimeout: error.code === "ECONNABORTED",
  };
};

export const toUserMessage = (error: unknown, fallback = "Something went wrong. Please try again.") => {
  const parsed = parseApiError(error);

  if (parsed.isTimeout) {
    return "Request timed out. Please retry.";
  }

  if (parsed.isNetworkError) {
    return "Network error. Please check your connection and try again.";
  }

  if (parsed.status === 403 && parsed.detail) {
    const match = parsed.detail.match(/^Requires scope:\s*(.+)$/i);
    if (match?.[1]) {
      return `You need the "${match[1]}" permission to access this feature.`;
    }
    return parsed.detail;
  }

  if (parsed.code && MESSAGE_BY_CODE[parsed.code]) {
    return MESSAGE_BY_CODE[parsed.code];
  }

  if (parsed.detail && parsed.detail.trim().length > 0) {
    return parsed.detail;
  }

  return fallback;
};
