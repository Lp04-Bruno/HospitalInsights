import styles from "./page.module.css";

export default async function DashboardPage() {
  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Übersicht</h1>
      <p className={styles.text}>
        Willkommen im internen Bereich. Nutze das Menü links, um Eingabedaten zu pflegen oder
        Stammdaten zu verwalten.
      </p>
    </section>
  );
}


