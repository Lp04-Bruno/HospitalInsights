import Link from "next/link";
import type { ReactNode } from "react";

import styles from "./PublicPageShell.module.css";

type PublicPageShellProps = {
  title: string;
  children: ReactNode;
};

export function PublicPageShell({ title, children }: PublicPageShellProps) {
  return (
    <main className={styles.shell}>
      <div className={styles.page}>
        <Link className={styles.back} href="/">
          Zurück
        </Link>

        <section className={styles.card}>
          <header className={styles.header}>
            <h1 className={styles.title}>{title}</h1>
          </header>
          <div className={styles.body}>{children}</div>
        </section>
      </div>
    </main>
  );
}
