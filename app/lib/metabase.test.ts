import { describe, expect, it, vi } from "vitest";

import { findAllowedMetabaseView, getMetabaseLandingViews, parseMetabaseCatalog } from "@/lib/metabase";

describe("metabase catalog helpers", () => {
  it("parses valid catalog entries and normalizes defaults", () => {
    const catalog = parseMetabaseCatalog(
      JSON.stringify([
        { id: "12", name: "  Auslastung  ", hospitalParamKey: " hospital_id " },
        { type: "question", id: 7, name: "Frage" },
      ])
    );

    expect(catalog).toEqual([
      { type: "dashboard", id: 12, name: "Auslastung", hospitalParamKey: "hospital_id" },
      { type: "question", id: 7, name: "Frage" },
    ]);
  });

  it("returns an empty catalog for malformed input", () => {
    expect(parseMetabaseCatalog("not json")).toEqual([]);
    expect(parseMetabaseCatalog(JSON.stringify([{ id: "nope" }]))).toEqual([]);
  });

  it("exposes named landing views from env and checks allowed views", () => {
    vi.stubEnv("METABASE_DASHBOARD_CATALOG", JSON.stringify([{ type: "question", id: 21, name: "Benchmark" }]));

    expect(getMetabaseLandingViews()).toEqual([{ type: "question", id: 21, name: "Benchmark" }]);
    expect(findAllowedMetabaseView("question", 21)).toEqual({ type: "question", id: 21, name: "Benchmark" });
    expect(findAllowedMetabaseView("dashboard", 21)).toBeNull();
  });
});
