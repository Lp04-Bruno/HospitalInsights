import Link from "next/link";
import styles from "./page.module.css";

export default function ForbiddenPage() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Zugriff verweigert</h1>
      <p className={styles.text}>
        Du bist eingeloggt, hast aber keine Berechtigung für diesen Bereich.
      </p>
      <p className={styles.text}>
        Wenn du glaubst, dass das ein Fehler ist, wende dich an einen Admin.
      </p>

      <div className={styles.actions}>
        <Link href="/dashboard" className={styles.link}>
          Zurück zum Dashboard
        </Link>
        <Link href="/" className={styles.link}>
          Öffentliche Startseite
        </Link>
      </div>
    </main>
  );
}


