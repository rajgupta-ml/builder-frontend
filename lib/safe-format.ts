export const safeText = (value: unknown, fallback = "N/A") => {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
};

export const safeIdShort = (value: unknown, fallback = "N/A") => {
  const raw = safeText(value, "");
  if (!raw) return fallback;
  const [short] = raw.split("-");
  return short || raw || fallback;
};

export const safeDate = (
  value: unknown,
  options?: Intl.DateTimeFormatOptions,
  fallback = "N/A"
) => {
  const date = new Date(value as string);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString(undefined, options);
};

export const safeDateTime = (
  value: unknown,
  options?: Intl.DateTimeFormatOptions,
  fallback = "N/A"
) => {
  const date = new Date(value as string);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString(undefined, options);
};

export const safeOpenExternal = (url: string) => {
  try {
    const nextUrl = new URL(url, window.location.origin);
    if (!["http:", "https:"].includes(nextUrl.protocol)) {
      return false;
    }
    window.open(nextUrl.toString(), "_blank", "noopener,noreferrer");
    return true;
  } catch {
    return false;
  }
};

