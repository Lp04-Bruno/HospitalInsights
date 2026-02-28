"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import styles from "./layout.module.css";

type NavItem = {
  href: string;
  label: string;
  exact?: boolean;
};

function isActive(pathname: string, href: string, exact: boolean) {
  if (exact) return pathname === href;
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

export function DashboardNav({ items }: { items: NavItem[] }) {
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
        const active = isActive(pathname, item.href, !!item.exact);

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
