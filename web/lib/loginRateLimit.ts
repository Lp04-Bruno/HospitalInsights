import { clearRateLimit, hitRateLimit } from "@/lib/rateLimit";

const LOGIN_LIMIT = Number(process.env.AUTH_RATE_LIMIT_MAX_ATTEMPTS ?? 8);
const LOGIN_WINDOW_SECONDS = Number(process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS ?? 15 * 60);

type LoginRequestLike = {
  headers?: Record<string, string | string[] | undefined>;
  socket?: {
    remoteAddress?: string;
  };
};

function normalizeEmail(raw: string | undefined) {
  return String(raw ?? "")
    .trim()
    .toLowerCase();
}

function firstForwardedValue(raw: string | string[] | undefined) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value?.split(",")[0]?.trim() || "";
}

export function getLoginRateLimitKeys(email: string | undefined, req: LoginRequestLike | undefined) {
  const normalizedEmail = normalizeEmail(email);
  const forwardedIp = firstForwardedValue(req?.headers?.["x-forwarded-for"]);
  const realIp = firstForwardedValue(req?.headers?.["x-real-ip"]);
  const ip = forwardedIp || realIp || req?.socket?.remoteAddress || "unknown";

  return {
    emailKey: `login:email:${normalizedEmail || "empty"}`,
    ipKey: `login:ip:${ip}`,
  };
}

export async function assertLoginAllowed(email: string | undefined, req: LoginRequestLike | undefined) {
  const keys = getLoginRateLimitKeys(email, req);
  const [emailLimit, ipLimit] = await Promise.all([
    hitRateLimit({ key: keys.emailKey, limit: LOGIN_LIMIT, windowSeconds: LOGIN_WINDOW_SECONDS }),
    hitRateLimit({ key: keys.ipKey, limit: LOGIN_LIMIT * 3, windowSeconds: LOGIN_WINDOW_SECONDS }),
  ]);

  return emailLimit.allowed && ipLimit.allowed;
}

export async function clearLoginRateLimit(email: string | undefined, req: LoginRequestLike | undefined) {
  const keys = getLoginRateLimitKeys(email, req);
  await Promise.all([clearRateLimit(keys.emailKey), clearRateLimit(keys.ipKey)]);
}
