import type { NextConfig } from "next";

function cspSourceFromUrl(raw: string | undefined) {
  if (!raw) return undefined;
  try {
    return new URL(raw).origin;
  } catch {
    return undefined;
  }
}

const metabaseFrameSources = Array.from(
  new Set(
    [
      "'self'",
      "http://localhost:3001",
      "https://metabase.hospitalinsights.de",
      cspSourceFromUrl(process.env.METABASE_SITE_URL),
      ...(process.env.SECURITY_FRAME_SRC ?? "")
        .split(",")
        .map((source) => source.trim())
        .filter(Boolean),
    ].filter(Boolean)
  )
);

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  ["script-src", "'self'", "'unsafe-inline'", process.env.NODE_ENV !== "production" ? "'unsafe-eval'" : undefined]
    .filter(Boolean)
    .join(" "),
  "connect-src 'self'",
  `frame-src ${metabaseFrameSources.join(" ")}`,
  "frame-ancestors 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
