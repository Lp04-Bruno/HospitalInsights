import { describe, expect, it } from "vitest";

import { DEFAULT_CALLBACK_URL, SIGN_IN_ERROR, safeCallbackUrl, signInErrorMessage } from "@/lib/signIn";

describe("signInErrorMessage", () => {
  it("unterscheidet falsche Zugangsdaten, Sperre und Störung", () => {
    const credentials = signInErrorMessage(SIGN_IN_ERROR.CREDENTIALS);
    const rateLimited = signInErrorMessage(SIGN_IN_ERROR.RATE_LIMITED);
    const unavailable = signInErrorMessage(SIGN_IN_ERROR.SERVICE_UNAVAILABLE);

    expect(credentials).toBeTruthy();
    expect(new Set([credentials, rateLimited, unavailable]).size).toBe(3);
  });

  it("fällt bei unbekannten Codes auf eine allgemeine Meldung zurück", () => {
    expect(signInErrorMessage("SomethingElse")).toBe(signInErrorMessage("AnotherUnknownCode"));
    expect(signInErrorMessage("SomethingElse")).toBeTruthy();
  });

  it("liefert ohne Code keine Meldung", () => {
    expect(signInErrorMessage(undefined)).toBeUndefined();
    expect(signInErrorMessage(null)).toBeUndefined();
    expect(signInErrorMessage("")).toBeUndefined();
  });
});

describe("safeCallbackUrl", () => {
  it("lässt interne Pfade durch", () => {
    expect(safeCallbackUrl("/dashboard/data")).toBe("/dashboard/data");
    expect(safeCallbackUrl("/dashboard?hospitalId=abc&year=2024")).toBe("/dashboard?hospitalId=abc&year=2024");
  });

  it("blockt fremde Origins", () => {
    expect(safeCallbackUrl("https://example.com/phish")).toBe(DEFAULT_CALLBACK_URL);
    expect(safeCallbackUrl("//example.com")).toBe(DEFAULT_CALLBACK_URL);
    expect(safeCallbackUrl("/\\example.com")).toBe(DEFAULT_CALLBACK_URL);
    expect(safeCallbackUrl("javascript:alert(1)")).toBe(DEFAULT_CALLBACK_URL);
  });

  it("nutzt den Fallback für fehlende oder leere Werte", () => {
    expect(safeCallbackUrl(undefined)).toBe(DEFAULT_CALLBACK_URL);
    expect(safeCallbackUrl(null)).toBe(DEFAULT_CALLBACK_URL);
    expect(safeCallbackUrl("")).toBe(DEFAULT_CALLBACK_URL);
    expect(safeCallbackUrl("   ")).toBe(DEFAULT_CALLBACK_URL);
    expect(safeCallbackUrl(undefined, "/signin")).toBe("/signin");
  });
});
