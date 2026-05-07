export const AUTH_REDIRECT_PARAM = "callbackUrl";
export const AUTH_REDIRECT_STORAGE_KEY = "rtc.auth.callbackUrl";
export const DEFAULT_AUTH_REDIRECT = "/user/dashboard";

export const getSafeRedirectTarget = (
  value: string | null | undefined,
  fallback = DEFAULT_AUTH_REDIRECT,
) => {
  if (!value) return fallback;

  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallback;
  }

  if (
    trimmed === "/" ||
    trimmed.startsWith("/api/") ||
    trimmed.startsWith("/two-factor") ||
    trimmed.startsWith("/firstlogin")
  ) {
    return fallback;
  }

  return trimmed;
};

