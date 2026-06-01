import Link from "next/link";
import Image from "next/image";

import { requireSession } from "@/lib/access";
import { getDashboardRoutesForRole } from "@/lib/dashboardRoutes";
import { DashboardNav } from "./DashboardNav";

import styles from "./layout.module.css";

const logoIcon = "/assets/hospitalinsights-logo-icon.png";

export const dynamic = "force-dynamic";

type DashboardLayoutProps = {
  children: React.ReactNode;
};

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const session = await requireSession("/dashboard");
  const role = session.user.role;
  const navItems = getDashboardRoutesForRole(role);

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link href="/" className={styles.brand} aria-label="Hospitalinsights Startseite">
          <Image className={styles.brandIcon} src={logoIcon} alt="" width={42} height={42} priority />
          <div className={styles.brandCopy}>
            <div className={styles.brandTitle}>Hospitalinsights</div>
            <div className={styles.brandSubtitle}>Dashboard</div>
          </div>
        </Link>

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
