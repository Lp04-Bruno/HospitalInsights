import Link from "next/link";
import styles from "./Footer.module.css";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer} aria-label="Footer">
      <div>© {year} HospitalInsights</div>
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
