import { describe, expect, it } from "vitest";

import { getDashboardRouteForPath, getDashboardRoutesForRole, isDashboardRouteActive } from "@/lib/dashboardRoutes";

describe("dashboardRoutes", () => {
  it("filters navigation entries by role", () => {
    expect(getDashboardRoutesForRole("VIEWER").map((route) => route.href)).toEqual(["/dashboard"]);
    expect(getDashboardRoutesForRole("EDITOR").map((route) => route.href)).toEqual([
      "/dashboard",
      "/dashboard/data",
      "/dashboard/audit",
      "/dashboard/hospitals",
    ]);
    expect(getDashboardRoutesForRole("ADMIN").map((route) => route.href)).toContain("/dashboard/backups");
  });

  it("matches the most specific route for nested paths", () => {
    expect(getDashboardRouteForPath("/dashboard/audit/manage/abc")?.href).toBe("/dashboard/audit/manage");
  });

  it("keeps exact routes exact", () => {
    expect(isDashboardRouteActive({ href: "/dashboard", exact: true }, "/dashboard")).toBe(true);
    expect(isDashboardRouteActive({ href: "/dashboard", exact: true }, "/dashboard/data")).toBe(false);
  });
});
