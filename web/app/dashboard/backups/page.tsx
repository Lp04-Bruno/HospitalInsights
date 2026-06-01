import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireDashboardRouteAccess } from "@/lib/access";
import { parseFlashMessage, redirectWithFlash } from "@/lib/actionResult";
import {
  backupsAutoDailyEnabled,
  backupsFeatureEnabled,
  backupsRestoreEnabled,
  createBackup,
  createDataExport,
  deleteBackup,
  ensureDailyBackup,
  importBackup,
  listBackups,
  uploadBackup,
} from "@/lib/dbBackups";
import { NoticeBanner, PendingActionButton, RestoreWithPreview, UploadBackupForm } from "./BackupsClient";

import styles from "./page.module.css";
import {
  DashboardCard,
  DashboardGrid,
  DashboardHeader,
  DashboardNotice,
  DashboardPage,
  dashboardUi,
} from "@/app/dashboard/_components/DashboardUi";

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
  searchParams?: Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>;
};

async function requireBackupAdmin(callbackUrl: string) {
  return requireDashboardRouteAccess(callbackUrl);
}

async function createManualBackup() {
  "use server";
  await requireBackupAdmin("/dashboard/backups");

  if (!backupsFeatureEnabled()) {
    redirectWithFlash("/dashboard/backups", { tone: "warning", message: "Backups sind deaktiviert." });
  }

  let filename: string;
  try {
    filename = await createBackup("manual");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Backup fehlgeschlagen.";
    redirectWithFlash("/dashboard/backups", { tone: "danger", message: `Backup fehlgeschlagen: ${msg}` });
  }

  revalidatePath("/dashboard/backups");
  redirectWithFlash("/dashboard/backups", { tone: "success", message: `Backup erstellt: ${filename}` });
}

async function ensureDailyBackupAction() {
  "use server";
  await requireBackupAdmin("/dashboard/backups");

  if (!backupsAutoDailyEnabled()) {
    redirectWithFlash("/dashboard/backups", { tone: "warning", message: "Daily-Backup ist deaktiviert (BACKUP_AUTO_DAILY)." });
  }

  let res: { created: boolean; filename?: string };
  try {
    res = await ensureDailyBackup();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Daily-Backup fehlgeschlagen.";
    redirectWithFlash("/dashboard/backups", { tone: "danger", message: `Daily-Backup fehlgeschlagen: ${msg}` });
  }

  revalidatePath("/dashboard/backups");
  if (res.created && res.filename) {
    redirectWithFlash("/dashboard/backups", { tone: "success", message: `Daily-Backup erstellt: ${res.filename}` });
  }
  redirectWithFlash("/dashboard/backups", { tone: "info", message: "Daily-Backup ist für heute bereits vorhanden." });
}

async function createDataExportAction() {
  "use server";
  await requireBackupAdmin("/dashboard/backups");

  if (!backupsFeatureEnabled()) {
    redirectWithFlash("/dashboard/backups", { tone: "warning", message: "Backups sind deaktiviert." });
  }

  let filename: string;
  try {
    filename = await createDataExport();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Datenexport fehlgeschlagen.";
    redirectWithFlash("/dashboard/backups", { tone: "danger", message: `Datenexport fehlgeschlagen: ${msg}` });
  }

  revalidatePath("/dashboard/backups");
  redirectWithFlash("/dashboard/backups", { tone: "success", message: `Datenexport erstellt: ${filename}` });
}

async function deleteBackupAction(formData: FormData) {
  "use server";
  await requireBackupAdmin("/dashboard/backups");

  const filename = String(formData.get("filename") ?? "").trim();
  const confirmed = String(formData.get("confirmed") ?? "").trim();
  if (!filename || confirmed !== "1") redirect("/dashboard/backups");

  try {
    await deleteBackup(filename);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Löschen fehlgeschlagen.";
    redirectWithFlash("/dashboard/backups", { tone: "danger", message: `Löschen fehlgeschlagen: ${msg}` });
  }

  revalidatePath("/dashboard/backups");
  redirectWithFlash("/dashboard/backups", { tone: "success", message: `Backup gelöscht: ${filename}` });
}

async function restoreBackupAction(formData: FormData) {
  "use server";
  await requireBackupAdmin("/dashboard/backups");

  const filename = String(formData.get("filename") ?? "").trim();
  const confirmFilename = String(formData.get("confirmFilename") ?? "").trim();
  const modeRaw = String(formData.get("mode") ?? "replace").trim();
  const mode = modeRaw === "append" ? "append" : "replace";
  const confirmed = String(formData.get("confirmed") ?? "").trim();
  if (!filename || confirmed !== "1") redirect("/dashboard/backups");
  if (confirmFilename !== filename) {
    redirectWithFlash("/dashboard/backups", { tone: "warning", message: "Restore abgebrochen: Dateiname wurde nicht korrekt bestätigt." });
  }

  if (!backupsRestoreEnabled()) {
    redirectWithFlash("/dashboard/backups", { tone: "warning", message: "Restore ist deaktiviert (BACKUP_RESTORE_ENABLED)." });
  }

  try {
    await importBackup(filename, mode);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Restore fehlgeschlagen.";
    redirectWithFlash("/dashboard/backups", { tone: "danger", message: `Restore fehlgeschlagen: ${msg}` });
  }

  revalidatePath("/dashboard/backups");
  redirectWithFlash("/dashboard/backups", {
    tone: "success",
    message: mode === "append" ? `Daten importiert aus: ${filename}` : `DB wiederhergestellt aus: ${filename}`,
  });
}

async function uploadBackupAction(formData: FormData) {
  "use server";
  await requireBackupAdmin("/dashboard/backups");

  const file = formData.get("file");
  if (!(file instanceof File)) {
    redirectWithFlash("/dashboard/backups", { tone: "warning", message: "Kein Backup hochgeladen." });
  }

  let filename: string;
  try {
    filename = await uploadBackup(file);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload fehlgeschlagen.";
    redirectWithFlash("/dashboard/backups", { tone: "danger", message: `Upload fehlgeschlagen: ${msg}` });
  }

  revalidatePath("/dashboard/backups");
  redirectWithFlash("/dashboard/backups", { tone: "success", message: `Backup hochgeladen: ${filename}` });
}

export default async function BackupsPage({ searchParams }: PageProps) {
  await requireBackupAdmin("/dashboard/backups");

  const enabled = backupsFeatureEnabled();
  const restoreEnabled = backupsRestoreEnabled();
  const autoDailyEnabled = backupsAutoDailyEnabled();

  const resolvedSearchParams = await searchParams;
  const flash = parseFlashMessage(resolvedSearchParams);

  const backups = enabled ? await listBackups() : [];

  return (
    <DashboardPage>
      <DashboardHeader title="Backups" subtitle="Datenbank-Backups erstellen, verwalten und wiederherstellen." />

      <NoticeBanner flash={flash} />

      <DashboardGrid>
        <DashboardCard title="Aktionen">
          {!enabled ? (
            <DashboardNotice tone="warning">
              Backups sind deaktiviert. Setze `BACKUP_ENABLED=true` (oder aktiviere es in Dev).
            </DashboardNotice>
          ) : (
            <div className={styles.actions}>
              <form action={createManualBackup}>
                <PendingActionButton className={dashboardUi.button} pendingText="Backup wird erstellt…">
                  Backup erstellen
                </PendingActionButton>
              </form>

              <form action={createDataExportAction}>
                <PendingActionButton className={`${dashboardUi.button} ${dashboardUi.secondary}`} pendingText="Datenexport wird erstellt…">
                  Datenexport erstellen
                </PendingActionButton>
              </form>

              <form action={ensureDailyBackupAction}>
                <PendingActionButton
                  className={`${dashboardUi.button} ${dashboardUi.secondary}`}
                  pendingText="Prüfe/erstelle Daily-Backup…"
                  disabled={!autoDailyEnabled}
                >
                  Daily-Backup prüfen
                </PendingActionButton>
              </form>

              <UploadBackupForm action={uploadBackupAction} />
            </div>
          )}
        </DashboardCard>

        <DashboardCard title="Status">
          <div className={styles.backupMeta}>`BACKUP_ENABLED`: {String(enabled)}</div>
          <div className={styles.backupMeta}>`BACKUP_RESTORE_ENABLED`: {String(restoreEnabled)}</div>
          <div className={styles.backupMeta}>`BACKUP_AUTO_DAILY`: {String(autoDailyEnabled)}</div>
        </DashboardCard>
      </DashboardGrid>

      <DashboardCard title="Vorhandene Backups">
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
                  <a
                    className={`${dashboardUi.button} ${dashboardUi.secondary}`}
                    href={`/api/admin/backups/download?file=${encodeURIComponent(b.filename)}`}
                    download
                  >
                    Download
                  </a>

                  {restoreEnabled ? <RestoreWithPreview filename={b.filename} kind={b.kind} action={restoreBackupAction} /> : null}

                  <form action={deleteBackupAction}>
                    <input type="hidden" name="filename" value={b.filename} />
                    <input type="hidden" name="confirmed" value="1" />
                    <PendingActionButton
                      className={`${dashboardUi.button} ${dashboardUi.danger}`}
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
      </DashboardCard>
    </DashboardPage>
  );
}
