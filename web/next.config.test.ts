import { describe, expect, it } from "vitest";

import nextConfig from "./next.config";

describe("next security headers", () => {
  it("allows the configured Metabase frame origins", async () => {
    const headerRules = nextConfig.headers ? await nextConfig.headers() : [];
    const csp = headerRules[0]?.headers.find((header) => header.key === "Content-Security-Policy")?.value;

    expect(csp).toContain("frame-src");
    expect(csp).toContain("http://localhost:3001");
    expect(csp).toContain("https://metabase.hospitalinsights.de");
  });
});
