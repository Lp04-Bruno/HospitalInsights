import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { parseFlashMessage, redirectWithFlash } from "@/lib/actionResult";
import { requireAdmin } from "@/lib/access";
import { formString, parseStatementType, yearSchema } from "@/lib/validation";
import { StatementType } from "@/prisma/generated/enums";
import { ConfirmSubmitButton } from "@/app/dashboard/_components/ConfirmSubmitButton";
import { DashboardToast } from "@/app/dashboard/_components/DashboardToast";
import { DashboardButtonLink, DashboardCard, DashboardHeader, DashboardPage, dashboardUi } from "@/app/dashboard/_components/DashboardUi";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

function parseISODate(raw: string | undefined): Date | undefined {
  if (!raw) return undefined;
  const m = /^\d{4}-\d{2}-\d{2}$/.exec(raw);
  if (!m) return undefined;
  const d = new Date(`${raw}T00:00:00.000Z`);
  return Number.isFinite(d.getTime()) ? d : undefined;
}

function startOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function endOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

type AuditManagePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
};

export default async function AuditManagePage({ searchParams }: AuditManagePageProps) {
  await requireAdmin("/dashboard/audit/manage");

  async function deleteRun(formData: FormData) {
    "use server";
    await requireAdmin("/dashboard/audit/manage");

    const runId = formString(formData, "runId");
    if (!runId) redirect("/dashboard/audit/manage");

    await prisma.factChangeRun.delete({ where: { id: runId } });
    redirectWithFlash("/dashboard/audit/manage", { tone: "success", message: "Audit-Run gelöscht." });
  }

  async function deleteAll(formData: FormData) {
    "use server";
    await requireAdmin("/dashboard/audit/manage");

    const confirmed = formString(formData, "confirmed");
    if (confirmed !== "1") redirect("/dashboard/audit/manage");

    await prisma.factChangeRun.deleteMany({});
    redirectWithFlash("/dashboard/audit/manage", { tone: "success", message: "Audit Log komplett gelöscht." });
  }

  async function deleteByFilter(formData: FormData) {
    "use server";
    await requireAdmin("/dashboard/audit/manage");

    const hospitalId = formString(formData, "hospitalId");
    const yearRaw = formString(formData, "year");
    const statementTypeRaw = formString(formData, "statementType");
    const userId = formString(formData, "userId");
    const fromRaw = formString(formData, "from");
    const toRaw = formString(formData, "to");

    const confirmed = formString(formData, "confirmed");
    if (confirmed !== "1") redirect("/dashboard/audit/manage");

    const yearResult = yearSchema.safeParse(yearRaw);
    const year = yearResult.success ? yearResult.data : undefined;
    const statementType = parseStatementType(statementTypeRaw);
    const fromDate = parseISODate(fromRaw);
    const toDate = parseISODate(toRaw);

    const hasAnyFilter = !!hospitalId || year !== undefined || !!statementType || !!userId || !!fromDate || !!toDate;
    if (!hasAnyFilter) {
      redirectWithFlash("/dashboard/audit/manage", { tone: "warning", message: "Ohne Filter wird nichts gelöscht." });
    }

    const periodId = year !== undefined ? (await prisma.period.findUnique({ where: { year }, select: { id: true } }))?.id : undefined;

    const whereRun: Record<string, unknown> = {
      ...(hospitalId ? { hospitalId } : {}),
      ...(periodId ? { periodId } : {}),
      ...(statementType ? { statementType } : {}),
      ...(userId ? { userId } : {}),
    };

    if (fromDate || toDate) {
      whereRun.createdAt = {
        ...(fromDate ? { gte: startOfDayUTC(fromDate) } : {}),
        ...(toDate ? { lte: endOfDayUTC(toDate) } : {}),
      };
    }

    const [runsToDelete, changesToDelete] = await Promise.all([
      prisma.factChangeRun.count({ where: whereRun }),
      prisma.factChange.count({ where: { run: whereRun } }),
    ]);

    if (runsToDelete === 0) {
      redirectWithFlash("/dashboard/audit/manage", { tone: "info", message: "Keine passenden Audit-Runs gefunden." });
    }

    await prisma.factChangeRun.deleteMany({ where: whereRun });
    redirectWithFlash("/dashboard/audit/manage", {
      tone: "success",
      message: `${runsToDelete} Audit-Runs und ${changesToDelete} Einzeländerungen gelöscht.`,
    });
  }

  const [runCount, changeCount, latestRuns, hospitals, periods, users] = await Promise.all([
    prisma.factChangeRun.count(),
    prisma.factChange.count(),
    prisma.factChangeRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        user: { select: { email: true, name: true } },
        hospital: { select: { name: true } },
        period: { select: { year: true } },
        _count: { select: { changes: true } },
      },
    }),
    prisma.hospital.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.period.findMany({ orderBy: { year: "desc" }, select: { id: true, year: true } }),
    prisma.user.findMany({
      orderBy: { email: "asc" },
      select: { id: true, email: true, name: true },
    }),
  ]);
  const resolvedSearchParams = await searchParams;
  const flash = parseFlashMessage(resolvedSearchParams);

  return (
    <DashboardPage>
      <DashboardHeader
        title="Audit Log Management"
        subtitle="Admin-Funktionen: Einträge/Runs löschen oder kompletten Audit Log leeren."
        actions={<DashboardButtonLink href="/dashboard/audit">Zurück zum Audit Log</DashboardButtonLink>}
      />

      <DashboardToast flash={flash} />

      <DashboardCard>
        <div className={styles.row}>
          <div>
            <div>
              <strong>Aktuell</strong>: {runCount} Runs, {changeCount} Einzeländerungen
            </div>
            <div className={styles.muted}>Hinweis: Löschen entfernt Historie unwiderruflich.</div>
          </div>

          <form className={styles.actions} action={deleteAll}>
            <input type="hidden" name="confirmed" value="1" />
            <ConfirmSubmitButton
              className={`${dashboardUi.button} ${dashboardUi.danger}`}
              confirmMessage="Audit Log wirklich komplett löschen? Das kann nicht rückgängig gemacht werden."
            >
              Audit Log komplett löschen
            </ConfirmSubmitButton>
          </form>
        </div>
      </DashboardCard>

      <DashboardCard title="Löschen nach Filter" hint="Sicherheit: Ohne Filter wird nichts gelöscht.">
        <div className={styles.row}>
          <div>
            <div className={styles.muted}>Sicherheit: Ohne Filter wird nichts gelöscht. Bestätige mit „LÖSCHEN“.</div>
          </div>
        </div>

        <form className={styles.actions} action={deleteByFilter}>
          <select className={`${dashboardUi.select} ${styles.filterControl}`} name="hospitalId" defaultValue="">
            <option value="">Hospital: alle</option>
            {hospitals.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>

          <select className={`${dashboardUi.select} ${styles.filterControl}`} name="year" defaultValue="">
            <option value="">Jahr: alle</option>
            {periods.map((p) => (
              <option key={p.id} value={String(p.year)}>
                {p.year}
              </option>
            ))}
          </select>

          <select className={`${dashboardUi.select} ${styles.filterControl}`} name="statementType" defaultValue="">
            <option value="">Statement: alle</option>
            {Object.values(StatementType).map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          <select className={`${dashboardUi.select} ${styles.filterControl}`} name="userId" defaultValue="">
            <option value="">Benutzer: alle</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email ?? u.name ?? u.id}
              </option>
            ))}
          </select>

          <input className={`${dashboardUi.input} ${styles.filterControl}`} type="date" name="from" aria-label="Von" />
          <input className={`${dashboardUi.input} ${styles.filterControl}`} type="date" name="to" aria-label="Bis" />

          <input type="hidden" name="confirmed" value="1" />
          <ConfirmSubmitButton
            className={`${dashboardUi.button} ${dashboardUi.danger}`}
            confirmMessage="Wirklich alle Audit-Runs löschen, die zu diesen Filtern passen? Das kann nicht rückgängig gemacht werden."
          >
            Nach Filter löschen
          </ConfirmSubmitButton>
        </form>
      </DashboardCard>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Zeitpunkt</th>
              <th className={styles.th}>Benutzer</th>
              <th className={styles.th}>Hospital</th>
              <th className={styles.th}>Jahr</th>
              <th className={styles.th}>Statement</th>
              <th className={styles.th}>#Änderungen</th>
              <th className={styles.th}>Run-ID</th>
              <th className={styles.th}>Details</th>
              <th className={styles.th}>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {latestRuns.map((r) => {
              const who = r.user?.email ?? r.user?.name ?? "—";
              return (
                <tr key={r.id}>
                  <td className={styles.td}>{r.createdAt.toLocaleString("de-DE")}</td>
                  <td className={styles.td}>{who}</td>
                  <td className={styles.td}>{r.hospital.name}</td>
                  <td className={styles.td}>{r.period.year}</td>
                  <td className={styles.td}>{r.statementType}</td>
                  <td className={styles.td}>{r._count.changes}</td>
                  <td className={styles.td}>
                    <span className={styles.mono}>{r.id}</span>
                  </td>
                  <td className={styles.td}>
                    <Link className={`${dashboardUi.button} ${dashboardUi.secondary}`} href={`/dashboard/audit/manage/${r.id}`}>
                      Öffnen
                    </Link>
                  </td>
                  <td className={styles.td}>
                    <form action={deleteRun}>
                      <input type="hidden" name="runId" value={r.id} />
                      <ConfirmSubmitButton
                        className={`${dashboardUi.button} ${dashboardUi.danger}`}
                        confirmMessage={`Audit-Run ${r.id} wirklich löschen?`}
                      >
                        Run löschen
                      </ConfirmSubmitButton>
                    </form>
                  </td>
                </tr>
              );
            })}

            {latestRuns.length === 0 ? (
              <tr>
                <td className={styles.td} colSpan={9}>
                  Keine Runs vorhanden.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </DashboardPage>
  );
}
