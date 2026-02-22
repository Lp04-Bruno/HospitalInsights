"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import styles from "./CookieBanner.module.css";
import { getConsentServerSnapshot, getConsentSnapshot, setStoredConsent, subscribeConsent } from "./consent";

export default function CookieBanner() {
  const pathname = usePathname();
  const consent = useSyncExternalStore(subscribeConsent, getConsentSnapshot, getConsentServerSnapshot);

  if (pathname !== "/") return null;

  if (consent !== "unknown") return null;

  return (
    <div className={styles.wrap} role="region" aria-label="Cookie-Hinweis">
      <div className={styles.banner}>
        <div className={styles.text}>
          Diese Website kann externe Inhalte von Metabase laden. Erst nach Zustimmung werden diese Inhalte angezeigt. Details in der{" "}
          <Link className={styles.link} href="/datenschutz">
            Datenschutzerklärung
          </Link>
          .
        </div>
        <div className={styles.actions}>
          <button className={`${styles.button} ${styles.primary}`} onClick={() => setStoredConsent("accepted")}>
            Akzeptieren
          </button>
          <button className={styles.button} onClick={() => setStoredConsent("declined")}>
            Ablehnen
          </button>
        </div>
      </div>
    </div>
  );
}
