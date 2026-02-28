import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getServerAuthSession } from "@/lib/auth";
import {
  backupsAutoDailyEnabled,
  backupsFeatureEnabled,
  backupsRestoreEnabled,
  createBackup,
  deleteBackup,
  ensureDailyBackup,
  listBackups,
  restoreBackup,
  uploadBackup,
} from "@/lib/dbBackups";
import { PendingActionButton, UploadBackupForm } from "./BackupsClient";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"] as const;
  let idx = 0;
  let v = bytes;
  while (v >= 1024 && idx < units.length - 1) {
    v /= 1024;
    idx++;
  }
  return `${v.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

async function requireAdmin(callbackUrl: string) {
  const session = await getServerAuthSession();
  if (!session) redirect(`/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  if (session.user.role !== "ADMIN") redirect("/dashboard/forbidden");
  return session;
}

async function createManualBackup() {
  "use server";
  await requireAdmin("/dashboard/backups");

  if (!backupsFeatureEnabled()) redirect("/dashboard/backups?notice=Backups%20sind%20deaktiviert.");

  let filename: string;
  try {
    filename = await createBackup("manual");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Backup fehlgeschlagen.";
    redirect(`/dashboard/backups?notice=${encodeURIComponent(`Backup fehlgeschlagen: ${msg}`)}`);
  }

  revalidatePath("/dashboard/backups");
  redirect(`/dashboard/backups?notice=${encodeURIComponent(`Backup erstellt: ${filename}`)}`);
}

async function ensureDailyBackupAction() {
  "use server";
  await requireAdmin("/dashboard/backups");

  if (!backupsAutoDailyEnabled()) {
    redirect("/dashboard/backups?notice=Daily-Backup%20ist%20deaktiviert%20(BACKUP_AUTO_DAILY).");
  }

  let res: { created: boolean; filename?: string };
  try {
    res = await ensureDailyBackup();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Daily-Backup fehlgeschlagen.";
    redirect(`/dashboard/backups?notice=${encodeURIComponent(`Daily-Backup fehlgeschlagen: ${msg}`)}`);
  }

  revalidatePath("/dashboard/backups");
  if (res.created && res.filename) {
    redirect(`/dashboard/backups?notice=${encodeURIComponent(`Daily-Backup erstellt: ${res.filename}`)}`);
  }
  redirect(`/dashboard/backups?notice=${encodeURIComponent(`Daily-Backup ist für heute bereits vorhanden.`)}`);
}

async function deleteBackupAction(formData: FormData) {
  "use server";
  await requireAdmin("/dashboard/backups");

  const filename = String(formData.get("filename") ?? "").trim();
  const confirmed = String(formData.get("confirmed") ?? "").trim();
  if (!filename || confirmed !== "1") redirect("/dashboard/backups");

  try {
    await deleteBackup(filename);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Löschen fehlgeschlagen.";
    redirect(`/dashboard/backups?notice=${encodeURIComponent(`Löschen fehlgeschlagen: ${msg}`)}`);
  }

  revalidatePath("/dashboard/backups");
  redirect(`/dashboard/backups?notice=${encodeURIComponent(`Backup gelöscht: ${filename}`)}`);
}

async function restoreBackupAction(formData: FormData) {
  "use server";
  await requireAdmin("/dashboard/backups");

  const filename = String(formData.get("filename") ?? "").trim();
  const confirmed = String(formData.get("confirmed") ?? "").trim();
  if (!filename || confirmed !== "1") redirect("/dashboard/backups");

  if (!backupsRestoreEnabled()) {
    redirect("/dashboard/backups?notice=Restore%20ist%20deaktiviert%20(BACKUP_RESTORE_ENABLED).");
  }

  try {
    await restoreBackup(filename);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Restore fehlgeschlagen.";
    redirect(`/dashboard/backups?notice=${encodeURIComponent(`Restore fehlgeschlagen: ${msg}`)}`);
  }

  revalidatePath("/dashboard/backups");
  redirect(`/dashboard/backups?notice=${encodeURIComponent(`DB wiederhergestellt aus: ${filename}`)}`);
}

async function uploadBackupAction(formData: FormData) {
  "use server";
  await requireAdmin("/dashboard/backups");

  const file = formData.get("file");
  if (!(file instanceof File)) redirect("/dashboard/backups?notice=Kein%20Backup%20hochgeladen.");

  let filename: string;
  try {
    filename = await uploadBackup(file);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload fehlgeschlagen.";
    redirect(`/dashboard/backups?notice=${encodeURIComponent(`Upload fehlgeschlagen: ${msg}`)}`);
  }

  revalidatePath("/dashboard/backups");
  redirect(`/dashboard/backups?notice=${encodeURIComponent(`Backup hochgeladen: ${filename}`)}`);
}

export default async function BackupsPage({ searchParams }: PageProps) {
  await requireAdmin("/dashboard/backups");

  const enabled = backupsFeatureEnabled();
  const restoreEnabled = backupsRestoreEnabled();
  const autoDailyEnabled = backupsAutoDailyEnabled();

  const notice = typeof searchParams?.notice === "string" ? searchParams.notice : undefined;

  const backups = enabled ? await listBackups() : [];

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Backups</h1>
        <p className={styles.subtitle}>Datenbank-Backups erstellen, verwalten und wiederherstellen.</p>
      </header>

      {notice ? <div className={styles.notice}>{notice}</div> : null}

      <div className={styles.grid}>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Aktionen</h2>

          {!enabled ? (
            <div className={styles.notice}>Backups sind deaktiviert. Setze `BACKUP_ENABLED=true` (oder aktiviere es in Dev).</div>
          ) : (
            <div className={styles.actions}>
              <form action={createManualBackup}>
                <PendingActionButton className={styles.button} pendingText="Backup wird erstellt…">
                  Backup erstellen
                </PendingActionButton>
              </form>

              <form action={ensureDailyBackupAction}>
                <PendingActionButton className={styles.secondary} pendingText="Prüfe/erstelle Daily-Backup…" disabled={!autoDailyEnabled}>
                  Daily-Backup prüfen
                </PendingActionButton>
              </form>

              <UploadBackupForm action={uploadBackupAction} />
            </div>
          )}
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Status</h2>
          <div className={styles.backupMeta}>`BACKUP_ENABLED`: {String(enabled)}</div>
          <div className={styles.backupMeta}>`BACKUP_RESTORE_ENABLED`: {String(restoreEnabled)}</div>
          <div className={styles.backupMeta}>`BACKUP_AUTO_DAILY`: {String(autoDailyEnabled)}</div>
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Vorhandene Backups</h2>

        {!enabled ? (
          <div className={styles.backupMeta}>Feature deaktiviert.</div>
        ) : backups.length === 0 ? (
          <div className={styles.backupMeta}>Keine Backups vorhanden.</div>
        ) : (
          <div className={styles.list}>
            {backups.map((b) => (
              <div key={b.filename} className={styles.listItem}>
                <div>
                  <div className={styles.backupName}>{b.filename}</div>
                  <div className={styles.backupMeta}>
                    {b.kind} · {formatBytes(b.sizeBytes)} · {b.createdAt.toLocaleString("de-DE")}
                  </div>
                </div>

                <div className={styles.rowActions}>
                  <Link className={styles.link} href={`/api/admin/backups/download?file=${encodeURIComponent(b.filename)}`}>
                    Download
                  </Link>

                  {restoreEnabled ? (
                    <form action={restoreBackupAction}>
                      <input type="hidden" name="filename" value={b.filename} />
                      <input type="hidden" name="confirmed" value="1" />
                      <PendingActionButton
                        className={styles.secondary}
                        pendingText="Restore läuft…"
                        confirmMessage={`DB wirklich durch ${b.filename} ersetzen? Das kann nicht rückgängig gemacht werden.`}
                      >
                        Restore
                      </PendingActionButton>
                    </form>
                  ) : null}

                  <form action={deleteBackupAction}>
                    <input type="hidden" name="filename" value={b.filename} />
                    <input type="hidden" name="confirmed" value="1" />
                    <PendingActionButton
                      className={styles.dangerSmall}
                      pendingText="Lösche…"
                      confirmMessage={`Backup ${b.filename} wirklich löschen?`}
                    >
                      Löschen
                    </PendingActionButton>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
