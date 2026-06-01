export type ConsentState = "unknown" | "accepted" | "declined";

const CONSENT_COOKIE = "hi_cookie_consent";
export const CONSENT_EVENT = "hi-consent-changed";

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const parts = document.cookie.split(";").map((p) => p.trim());
  const hit = parts.find((p) => p.startsWith(`${name}=`));
  if (!hit) return undefined;
  return decodeURIComponent(hit.substring(name.length + 1));
}

export function getStoredConsent(): ConsentState {
  if (typeof window === "undefined") return "unknown";

  const fromCookie = readCookie(CONSENT_COOKIE);
  if (fromCookie === "accepted" || fromCookie === "declined") return fromCookie;

  const fromStorage = window.localStorage.getItem(CONSENT_COOKIE);
  if (fromStorage === "accepted" || fromStorage === "declined") return fromStorage;

  return "unknown";
}

export function setStoredConsent(value: Exclude<ConsentState, "unknown">) {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  // 1 year
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(value)}; Max-Age=31536000; Path=/; SameSite=Lax`;
  window.localStorage.setItem(CONSENT_COOKIE, value);
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

export function subscribeConsent(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};

  window.addEventListener(CONSENT_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);

  return () => {
    window.removeEventListener(CONSENT_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

export function getConsentSnapshot(): ConsentState {
  return getStoredConsent();
}

export function getConsentServerSnapshot(): ConsentState {
  return "unknown";
}
