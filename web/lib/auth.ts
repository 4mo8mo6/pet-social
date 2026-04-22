import { API_BASE_URL } from "./constants";

export const SECONDME_STATE_COOKIE_NAME = "pet-agent-social-secondme-state";
export const SECONDME_AUTH_RESULT_COOKIE_NAME =
  "pet-agent-social-secondme-login";

const AUTH_TOKEN_STORAGE_KEY = "pet-agent-social:auth-token";
const AUTH_SESSION_STORAGE_KEY = "pet-agent-social:auth-session";
const AUTH_USER_EMAIL_STORAGE_KEY = "pet-agent-social:auth-user-email";
export const AUTH_COOKIE_NAME = "pet-agent-social-auth";
export const AUTH_SESSION_MARKER = "cookie-session";
export const PROTECTED_ROUTE_PREFIXES = [
  "/chat",
  "/community",
  "/create-pet",
  "/home",
  "/my-pet",
  "/my-pets",
  "/shop",
  "/social",
] as const;

const readCookieValue = (name: string) => {
  if (typeof document === "undefined") {
    return null;
  }

  const cookiePrefix = `${name}=`;
  const cookie = document.cookie
    .split("; ")
    .find((item) => item.startsWith(cookiePrefix));

  if (!cookie) {
    return null;
  }

  return decodeURIComponent(cookie.slice(cookiePrefix.length));
};

const clearAuthCookie = () => {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${AUTH_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
};

export type TemporarySecondMeAuthResult = {
  email: string;
};

export const readStoredAuthToken = () => {
  if (typeof window === "undefined") {
    return null;
  }

  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);

  const sessionMarker = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);

  if (sessionMarker?.trim()) {
    return AUTH_SESSION_MARKER;
  }

  const legacyCookieToken = readCookieValue(AUTH_COOKIE_NAME);

  if (legacyCookieToken?.trim()) {
    clearAuthCookie();
  }

  return null;
};

export const readStoredAuthUserEmail = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const storedEmail = window.localStorage.getItem(AUTH_USER_EMAIL_STORAGE_KEY);

  return storedEmail?.trim() ? storedEmail : null;
};

export const hasStoredAuthToken = () => readStoredAuthToken() !== null;

export const storeAuthToken = (_token: string, email: string) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, AUTH_SESSION_MARKER);
  window.localStorage.setItem(AUTH_USER_EMAIL_STORAGE_KEY, email);
};

export const clearStoredAuth = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  window.localStorage.removeItem(AUTH_USER_EMAIL_STORAGE_KEY);
  clearAuthCookie();
};

const decodeBase64Url = (value: string) => {
  const normalizedValue = value.replace(/-/g, "+").replace(/_/g, "/");
  const paddedValue = normalizedValue.padEnd(
    normalizedValue.length + ((4 - (normalizedValue.length % 4)) % 4),
    "="
  );

  return window.atob(paddedValue);
};

export const readTemporarySecondMeAuthResult =
  (): TemporarySecondMeAuthResult | null => {
    if (typeof window === "undefined") {
      return null;
    }

    const rawValue = readCookieValue(SECONDME_AUTH_RESULT_COOKIE_NAME);

    if (!rawValue) {
      return null;
    }

    try {
      const parsedValue = JSON.parse(
        decodeBase64Url(rawValue)
      ) as Record<string, unknown>;

      if (
        typeof parsedValue.email === "string" &&
        parsedValue.email
      ) {
        return {
          email: parsedValue.email,
        };
      }
    } catch {
      return null;
    }

    return null;
  };

export const clearTemporarySecondMeAuthResult = () => {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${SECONDME_AUTH_RESULT_COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax`;
};

export const buildAuthHeaders = (token: string, includeJson = false) => {
  void token;
  const headers: Record<string, string> = {};

  if (includeJson) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
};

export const withAuthCredentials = (init: RequestInit = {}): RequestInit => ({
  ...init,
  credentials: "include",
});

export const logoutCurrentSession = async () => {
  await fetch(`${API_BASE_URL}/auth/logout`, withAuthCredentials({
    method: "POST",
    headers: buildAuthHeaders(AUTH_SESSION_MARKER),
    cache: "no-store",
  }));
  clearStoredAuth();
};
