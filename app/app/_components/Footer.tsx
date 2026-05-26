import Link from "next/link";
import styles from "./Footer.module.css";
import { APP_VERSION } from "@/lib/version";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer} aria-label="Footer">
      <div className={styles.meta}>
        <span>© {year} Hospitalinsights</span>
        <span className={styles.version}>v{APP_VERSION}</span>
      </div>
      <div className={styles.links}>
        <Link className={styles.link} href="/datenschutz">
          Datenschutz
        </Link>
        <Link className={styles.link} href="/impressum">
          Impressum
        </Link>
      </div>
    </footer>
  );
}
