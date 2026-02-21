"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import styles from "./ErrorState.module.css";

export type ErrorStateProps = {
  title: string;
  subtitle?: string;
  error?: (Error & { digest?: string }) | null;
  onRetry?: (() => void) | null;
  retryLabel?: string;
  backLabel?: string;
  linkAction?: { href: string; label: string } | null;
  supportHint?: string;
};

export function ErrorState({
  title,
  subtitle,
  error,
  onRetry,
  retryLabel = "Erneut versuchen",
  backLabel = "Zurück",
  linkAction = null,
  supportHint,
}: ErrorStateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (error) console.error(error);
  }, [error]);

  const supportInfo = useMemo(() => {
    const when = new Date().toISOString();
    const query = searchParams?.toString();

    return {
      when,
      path: query ? `${pathname}?${query}` : pathname,
      digest: error?.digest,
      message: error?.message,
      hint: supportHint,
    };
  }, [error?.digest, error?.message, pathname, searchParams, supportHint]);

  return (
    <div className={styles.wrapper}>
      <section className={styles.card}>
        <header className={styles.header}>
          <h1 className={styles.title}>{title}</h1>
          {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
        </header>

        <div className={styles.notice}>
          <div>
            Bitte versuche es erneut. Wenn das Problem reproduzierbar ist, melde
            dich kurz mit den Schritten.
          </div>
        </div>

        <div className={styles.actions}>
          {onRetry ? (
            <button
              className={styles.buttonPrimary}
              type="button"
              onClick={onRetry}
            >
              {retryLabel}
            </button>
          ) : null}

          <button
            className={styles.buttonSecondary}
            type="button"
            onClick={() => router.back()}
          >
            {backLabel}
          </button>

          {linkAction ? (
            <Link className={styles.link} href={linkAction.href}>
              {linkAction.label}
            </Link>
          ) : null}
        </div>

        <details className={styles.support}>
          <summary className={styles.supportSummary}>Support-Info</summary>
          <div className={styles.supportBox}>
            {`Zeit: ${supportInfo.when}\nURL: ${supportInfo.path}\nDigest: ${supportInfo.digest ?? "-"}\nMessage: ${supportInfo.message ?? "-"}${supportInfo.hint ? `\nHint: ${supportInfo.hint}` : ""}`}
          </div>
        </details>
      </section>
    </div>
  );
}
