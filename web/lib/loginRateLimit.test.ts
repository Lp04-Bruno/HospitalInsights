import { describe, expect, it } from "vitest";

import { getLoginRateLimitKeys } from "@/lib/loginRateLimit";

describe("loginRateLimit", () => {
  it("normalizes email and uses forwarded IP for Redis keys", () => {
    expect(
      getLoginRateLimitKeys(" Admin@HospitalInsights.Local ", {
        headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.1" },
      })
    ).toEqual({
      emailKey: "login:email:admin@hospitalinsights.local",
      ipKey: "login:ip:203.0.113.5",
    });
  });
});
