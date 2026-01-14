import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import styles from "./page.module.css";

export default async function DashboardPage() {
  const session = await getServerAuthSession();
  if (!session) redirect("/signin?callbackUrl=/dashboard");

  if (session.user.role !== "ADMIN" && session.user.role !== "EDITOR") {
    redirect("/dashboard/forbidden");
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Dashboard</h1>

      <div className={styles.meta}>
        <p>
          Eingeloggt als <strong>{session.user?.email}</strong>
        </p>
        <p>
          Rolle: <strong>{session.user.role}</strong>
        </p>
      </div>

      <div className={styles.actions}>
        <Link href="/" className={styles.link}>
          Öffentliche Startseite
        </Link>
        <Link
          href="/api/auth/signout?callbackUrl=/"
          className={`${styles.link} ${styles.primary}`}
        >
          Abmelden
        </Link>
      </div>
    </main>
  );
}


