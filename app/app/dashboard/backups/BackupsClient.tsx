"use client";

import type { ChangeEvent, MouseEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import styles from "./page.module.css";

function useEstimatedProgress(pending: boolean) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState<number>(0);

  useEffect(() => {
    let raf = 0;
    raf = window.requestAnimationFrame(() => {
      if (!pending) {
        setStartedAt(null);
        setNow(0);
        return;
      }
      const t = Date.now();
      setStartedAt(t);
      setNow(t);
    });
    return () => window.cancelAnimationFrame(raf);
  }, [pending]);

  useEffect(() => {
    if (!pending) return;

    let raf = 0;
    const tick = () => {
      setNow(Date.now());
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [pending]);

  return useMemo(() => {
    if (!pending || startedAt === null) return { percent: 0, elapsedSec: 0 };
    const elapsedMs = Math.max(0, now - startedAt);
    const elapsedSec = Math.floor(elapsedMs / 1000);

    const percent = Math.min(99, Math.max(1, Math.round((1 - Math.exp(-elapsedMs / 8000)) * 100)));
    return { percent, elapsedSec };
  }, [pending, startedAt, now]);
}

type PendingActionButtonProps = {
  children: ReactNode;
  className?: string;
  pendingText?: string;
  confirmMessage?: string;
  disabled?: boolean;
};

export function PendingActionButton({ children, className, pendingText, confirmMessage, disabled }: PendingActionButtonProps) {
  const { pending } = useFormStatus();
  const { percent, elapsedSec } = useEstimatedProgress(pending);

  const onClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      if (!confirmMessage) return;
      if (!window.confirm(confirmMessage)) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    [confirmMessage]
  );

  return (
    <div className={styles.pendingWrap} aria-live="polite">
      <button type="submit" className={className} onClick={onClick} disabled={pending || disabled}>
        {pending ? (
          <span className={styles.pendingInline}>
            <span className={styles.spinner} aria-hidden="true" />
            <span>{pendingText ?? "Wird ausgeführt…"}</span>
          </span>
        ) : (
          children
        )}
      </button>

      {pending ? (
        <div className={styles.progress}>
          <div className={styles.progressTop}>
            <span className={styles.progressLabel}>Fortschritt (geschätzt)</span>
            <span className={styles.progressMeta}>
              {percent}% · {elapsedSec}s
            </span>
          </div>
          <div className={styles.progressTrack}>
            <div className={styles.progressBar} style={{ width: `${percent}%` }} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

type UploadBackupFormProps = {
  action: (formData: FormData) => void | Promise<void>;
};

export function UploadBackupForm({ action }: UploadBackupFormProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string>("");

  const onPick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const onChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const f = e.currentTarget.files?.[0];
    setFileName(f?.name ?? "");
  }, []);

  return (
    <form action={action} className={styles.form}>
      <div className={styles.fileRow}>
        <span className={styles.labelText}>Backup hochladen (.dump)</span>
        <div className={styles.filePickerRow}>
          <input ref={inputRef} className={styles.fileInput} type="file" name="file" accept=".dump" required onChange={onChange} />
          <button type="button" className={styles.secondary} onClick={onPick}>
            Durchsuchen…
          </button>
          <div className={styles.fileName} title={fileName || "Keine Datei ausgewählt"}>
            {fileName || "Keine Datei ausgewählt"}
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <PendingActionButton className={styles.secondary} pendingText="Upload läuft…">
          Upload
        </PendingActionButton>
      </div>
    </form>
  );
}
