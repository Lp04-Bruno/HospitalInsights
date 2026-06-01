"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { isDashboardRouteActive, type DashboardRoute } from "@/lib/dashboardRoutes";
import styles from "./layout.module.css";

export function DashboardNav({ items }: { items: readonly DashboardRoute[] }) {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();

  const preservedKeys = ["hospitalId", "year", "statementType"] as const;
  const preserved = new URLSearchParams();
  for (const k of preservedKeys) {
    const v = searchParams.get(k);
    if (v) preserved.set(k, v);
  }
  const preservedQs = preserved.toString();

  return (
    <nav className={styles.nav}>
      {items.map((item) => {
        const active = isDashboardRouteActive(item, pathname);

        const hrefWithPreserved = preservedQs ? `${item.href}?${preservedQs}` : item.href;
        return (
          <Link
            key={item.href}
            href={hrefWithPreserved}
            className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
