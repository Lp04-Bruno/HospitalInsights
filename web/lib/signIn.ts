/**
 * Fehlercodes, die der Credentials-Provider an das Sign-in-Formular durchreicht.
 */
export const SIGN_IN_ERROR = {
  CREDENTIALS: "CredentialsSignin",
  RATE_LIMITED: "RateLimited",
  SERVICE_UNAVAILABLE: "ServiceUnavailable",
} as const;

export type SignInErrorCode = (typeof SIGN_IN_ERROR)[keyof typeof SIGN_IN_ERROR];

const SIGN_IN_ERROR_MESSAGES: Record<SignInErrorCode, string> = {
  [SIGN_IN_ERROR.CREDENTIALS]: "Email oder Passwort ist falsch.",
  [SIGN_IN_ERROR.RATE_LIMITED]: "Zu viele Anmeldeversuche. Bitte warte einige Minuten und versuche es dann erneut.",
  [SIGN_IN_ERROR.SERVICE_UNAVAILABLE]: "Anmeldung ist derzeit nicht möglich. Bitte versuche es in Kürze erneut.",
};

export const SIGN_IN_FALLBACK_MESSAGE = "Anmeldung fehlgeschlagen. Bitte versuche es erneut.";

export function signInErrorMessage(code: string | null | undefined): string | undefined {
  if (!code) return undefined;
  return SIGN_IN_ERROR_MESSAGES[code as SignInErrorCode] ?? SIGN_IN_FALLBACK_MESSAGE;
}

export const DEFAULT_CALLBACK_URL = "/dashboard";

/**
 * Lässt nur anwendungsinterne Ziele zu.
 */
export function safeCallbackUrl(raw: string | null | undefined, fallback: string = DEFAULT_CALLBACK_URL): string {
  if (typeof raw !== "string") return fallback;

  const value = raw.trim();
  if (!value.startsWith("/")) return fallback;
  if (value[1] === "/" || value[1] === "\\") return fallback;

  return value;
}
