import { describe, expect, it } from "vitest";

import { generateTemporaryPassword, passwordSchema } from "@/lib/passwordPolicy";

describe("passwordPolicy", () => {
  it("rejects weak passwords", () => {
    expect(passwordSchema.safeParse("admin1234").success).toBe(false);
    expect(passwordSchema.safeParse("lowercase-only-password").success).toBe(false);
  });

  it("accepts strong passwords", () => {
    expect(passwordSchema.safeParse("HospitalInsights-2026!").success).toBe(true);
  });

  it("generates compliant temporary passwords", () => {
    const password = generateTemporaryPassword();
    expect(passwordSchema.safeParse(password).success).toBe(true);
  });
});
