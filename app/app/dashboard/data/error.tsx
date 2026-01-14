"use client";

import Link from "next/link";
import { useEffect } from "react";
import styles from "./page.module.css";

export default function DashboardDataError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <section className={styles.page}>
            <header className={styles.header}>
                <h1 className={styles.title}>Datenverwaltung</h1>
                <p className={styles.subtitle}>Beim Laden oder Speichern ist ein Fehler aufgetreten.</p>
            </header>

            <div className={styles.noticeError}>
                <div>Bitte versuche es erneut. Wenn das reproduzierbar ist, sag kurz welche Auswahl (Hospital/Jahr/Bereich).</div>
            </div>

            <div className={styles.filterActions}>
                <button className={styles.button} type="button" onClick={reset}>
                    Erneut versuchen
                </button>
                <Link className={styles.secondary} href="/dashboard">
                    Zum Dashboard
                </Link>
            </div>
        </section>
    );
}
