"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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

  return (
    <nav className={styles.nav}>
      {items.map((item) => {
        const active = isActive(pathname, item.href, !!item.exact);
        return (
          <Link
            key={item.href}
            href={item.href}
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
