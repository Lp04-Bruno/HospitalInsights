"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

import styles from "@/app/signin/sign-in-form.module.css";

export function LogoutClient({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter();

  const doSignOut = useCallback(() => {
    void signOut({ callbackUrl });
  }, [callbackUrl]);

  const goBack = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(callbackUrl);
  }, [router, callbackUrl]);

  return (
    <section className={styles.card}>
      <h1 className={styles.title}>Abmelden</h1>
      <p className={styles.subtitle}>Willst du dich wirklich abmelden?</p>
      <div className={styles.actions}>
        <button className={styles.button} onClick={doSignOut}>
          Abmelden
        </button>
        <button type="button" className={styles.link} onClick={goBack}>
          Zurück
        </button>
      </div>
    </section>
  );
}
