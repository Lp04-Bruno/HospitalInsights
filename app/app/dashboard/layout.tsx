import Link from "next/link";
import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/lib/auth";
import { DashboardNav } from "./DashboardNav";

import styles from "./layout.module.css";

export const dynamic = "force-dynamic";

type DashboardLayoutProps = {
  children: React.ReactNode;
};

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const session = await getServerAuthSession();
  if (!session) redirect("/signin?callbackUrl=/dashboard");

  const role = session.user.role;
  const navItems =
    role === "ADMIN"
      ? [
          { href: "/dashboard", label: "Übersicht", exact: true },
          { href: "/dashboard/data", label: "Datenverwaltung" },
          { href: "/dashboard/audit", label: "Audit Log" },
          { href: "/dashboard/audit/manage", label: "Audit Log – Management" },
          { href: "/dashboard/hospitals", label: "Hospitalverwaltung" },
          { href: "/dashboard/users", label: "Benutzerverwaltung" },
          { href: "/dashboard/backups", label: "Backups" },
        ]
      : role === "EDITOR"
        ? [
            { href: "/dashboard", label: "Übersicht", exact: true },
            { href: "/dashboard/data", label: "Datenverwaltung" },
            { href: "/dashboard/audit", label: "Audit Log" },
            { href: "/dashboard/hospitals", label: "Hospitalverwaltung" },
          ]
        : [{ href: "/dashboard", label: "Übersicht", exact: true }];

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <div className={styles.brandTitle}>Hospitalinsights</div>
          <div className={styles.brandSubtitle}>Dashboard</div>
        </div>

        <DashboardNav items={navItems} />

        <div className={styles.sidebarFooter}>
          <div className={styles.userBox}>
            <div className={styles.userEmail}>{session.user.email}</div>
            <div className={styles.userRole}>Rolle: {role}</div>
          </div>

          <div className={styles.sidebarFooterLinks}>
            <Link href="/" className={styles.footerLink}>
              Startseite
            </Link>
            <Link href="/logout?callbackUrl=/" className={styles.footerLink}>
              Abmelden
            </Link>
          </div>
        </div>
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.topbarTitle}>Interner Bereich</div>
        </header>

        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
