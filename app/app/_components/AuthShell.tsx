import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import styles from "./AuthShell.module.css";

const wordmarkLogo = "/assets/hospitalinsights-logo-with-text.png";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.logoLink} aria-label="Hospitalinsights Startseite">
          <Image className={styles.logo} src={wordmarkLogo} alt="Hospitalinsights" width={300} height={100} priority />
        </Link>
        <Link href="/" className={styles.topLink}>
          Startseite
        </Link>
      </header>
      <div className={styles.center}>{children}</div>
    </main>
  );
}
