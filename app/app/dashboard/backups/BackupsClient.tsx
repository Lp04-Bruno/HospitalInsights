"use client";

import type { ChangeEvent, MouseEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import type { BackupAnalysis, RestoreMode } from "@/lib/dbBackups";
import { useRouter, useSearchParams } from "next/navigation";

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

type NoticeBannerProps = {
  notice?: string;
};

export function NoticeBanner({ notice }: NoticeBannerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(Boolean(notice));

  const dismiss = useCallback(() => {
    setVisible(false);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("notice");
    const qs = params.toString();
    router.replace(qs ? `/dashboard/backups?${qs}` : "/dashboard/backups");
  }, [router, searchParams]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => {
      dismiss();
    }, 8000);
    return () => window.clearTimeout(t);
  }, [notice, dismiss]);

  if (!notice || !visible) return null;

  return (
    <div className={styles.notice} role="status" aria-live="polite">
      <div className={styles.noticeRow}>
        <span className={styles.noticeText}>{notice}</span>
        <button type="button" className={styles.noticeClose} onClick={dismiss} aria-label="Hinweis schließen">
          ×
        </button>
      </div>
    </div>
  );
}

type RestoreWithPreviewProps = {
  filename: string;
  kind: string;
  action: (formData: FormData) => void | Promise<void>;
};

export function RestoreWithPreview({ filename, kind, action }: RestoreWithPreviewProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<RestoreMode>("replace");
  const [analysis, setAnalysis] = useState<BackupAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const abortRef = useRef<AbortController | null>(null);

  const close = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setOpen(false);
    setError("");
  }, []);

  const onOpen = useCallback(() => {
    if (open) return;
    setOpen(true);

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError("");
    setAnalysis(null);

    fetch(`/api/admin/backups/analyze?file=${encodeURIComponent(filename)}`, { cache: "no-store", signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return (await r.json()) as BackupAnalysis;
      })
      .then((json) => {
        setAnalysis(json);
      })
      .catch((e) => {
        if (ctrl.signal.aborted) return;
        setError(e instanceof Error ? e.message : "Analyse fehlgeschlagen.");
      })
      .finally(() => {
        if (ctrl.signal.aborted) return;
        setLoading(false);
      });
  }, [filename, open]);

  const tablePreview = useMemo(() => {
    const items = analysis?.tableData ?? [];
    const unique = new Map<string, { schema: string; table: string }>();
    for (const t of items) unique.set(`${t.schema}.${t.table}`, t);
    return Array.from(unique.values()).slice(0, 8);
  }, [analysis]);

  return (
    <>
      <button type="button" className={styles.secondary} onClick={onOpen}>
        Restore
      </button>

      {open ? (
        <div className={styles.modalOverlay} role="presentation" onMouseDown={close}>
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-label={`Restore: ${filename}`}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div>
                <div className={styles.modalTitle}>Restore / Import</div>
                <div className={styles.modalSubtitle}>{filename}</div>
              </div>
              <button type="button" className={styles.secondary} onClick={close}>
                Schließen
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.modalHint}>
                {kind === "data"
                  ? "Datenexport: importiert Daten in bestehende Tabellen."
                  : "Backup: kann die DB vollständig ersetzen oder nur Daten importieren."}
              </div>

              {loading ? <div className={styles.modalMeta}>Analysiere Dump…</div> : null}
              {error ? <div className={styles.modalError}>{error}</div> : null}

              {analysis ? (
                <div className={styles.modalMeta}>
                  Format: {analysis.format} · Inhalt: {analysis.hasSchema ? "Schema+" : ""}
                  {analysis.hasData ? "Daten" : ""}
                </div>
              ) : null}

              {tablePreview.length > 0 ? (
                <div className={styles.modalPreview}>
                  <div className={styles.modalPreviewTitle}>Vorschau (Tabellen mit Daten)</div>
                  <ul className={styles.modalList}>
                    {tablePreview.map((t) => (
                      <li key={`${t.schema}.${t.table}`}>
                        {t.schema}.{t.table}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className={styles.modalPreview}>
                <div className={styles.modalPreviewTitle}>Modus</div>
                <label className={styles.radioRow}>
                  <input type="radio" name="mode_choice" checked={mode === "replace"} onChange={() => setMode("replace")} />
                  <span>
                    <strong>Ersetzen</strong> – vorhandene Daten werden vorher gelöscht.
                  </span>
                </label>
                <label className={styles.radioRow}>
                  <input type="radio" name="mode_choice" checked={mode === "append"} onChange={() => setMode("append")} />
                  <span>
                    <strong>Zusätzlich importieren</strong> – versucht Daten einzufügen (kann bei Duplikaten fehlschlagen).
                  </span>
                </label>
              </div>

              <div className={styles.modalActions}>
                <button type="button" className={styles.secondary} onClick={close}>
                  Abbrechen
                </button>

                <form action={action}>
                  <input type="hidden" name="filename" value={filename} />
                  <input type="hidden" name="mode" value={mode} />
                  <input type="hidden" name="confirmed" value="1" />
                  <PendingActionButton className={styles.button} pendingText="Import/Restore läuft…" disabled={loading}>
                    Starten
                  </PendingActionButton>
                </form>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
