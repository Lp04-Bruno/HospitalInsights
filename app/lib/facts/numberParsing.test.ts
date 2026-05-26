import { describe, expect, it } from "vitest";

import { parseUserNumberDetailed } from "@/lib/facts/numberParsing";
import { Unit } from "@/prisma/generated/enums";

describe("parseUserNumberDetailed", () => {
  it("parses German decimal and thousands separators", () => {
    expect(parseUserNumberDetailed("1.234,56", Unit.EUR)).toEqual({ kind: "value", value: 1234.56 });
  });

  it("accepts percent signs without scaling the entered value", () => {
    expect(parseUserNumberDetailed("39,5 %", Unit.PERCENT)).toEqual({ kind: "value", value: 39.5 });
  });

  it("truncates count values", () => {
    expect(parseUserNumberDetailed("12,9", Unit.COUNT)).toEqual({ kind: "value", value: 12 });
  });

  it("distinguishes empty and invalid input", () => {
    expect(parseUserNumberDetailed("   ", Unit.EUR)).toEqual({ kind: "empty" });
    expect(parseUserNumberDetailed("abc", Unit.EUR)).toEqual({ kind: "invalid" });
  });
});
