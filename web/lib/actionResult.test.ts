import { describe, expect, it } from "vitest";

import { clearFlashSearchParams, encodeFlashMessage, parseFlashMessage } from "@/lib/actionResult";

describe("actionResult flash messages", () => {
  it("roundtrips typed flash messages", () => {
    const encoded = encodeFlashMessage({ tone: "success", message: "Gespeichert" });

    expect(parseFlashMessage({ flash: encoded })).toEqual({ tone: "success", message: "Gespeichert" });
  });

  it("keeps old notice links readable", () => {
    expect(parseFlashMessage({ notice: "Alter Hinweis" })).toEqual({ tone: "info", message: "Alter Hinweis" });
  });

  it("clears flash and legacy notice params while preserving other filters", () => {
    const params = new URLSearchParams("flash=x&notice=y&hospitalId=123");

    expect(clearFlashSearchParams(params).toString()).toBe("hospitalId=123");
  });
});
