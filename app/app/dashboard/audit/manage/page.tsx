import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getServerAuthSession } from "@/lib/auth";
import { StatementType } from "@prisma/client";
import { ConfirmSubmitButton } from "@/app/dashboard/_components/ConfirmSubmitButton";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

function parseStatementType(raw: string | undefined): StatementType | undefined {
  if (!raw) return undefined;
  const values = Object.values(StatementType) as string[];
  return values.includes(raw) ? (raw as StatementType) : undefined;
}

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

export default async function AuditManagePage() {
  const session = await getServerAuthSession();
  if (!session) redirect("/signin?callbackUrl=/dashboard/audit/manage");
  if (session.user.role !== "ADMIN") redirect("/dashboard/forbidden");

  async function deleteRun(formData: FormData) {
    "use server";
    const session = await getServerAuthSession();
    if (!session) redirect("/signin?callbackUrl=/dashboard/audit/manage");
    if (session.user.role !== "ADMIN") redirect("/dashboard/forbidden");

    const runId = String(formData.get("runId") ?? "").trim();
    if (!runId) redirect("/dashboard/audit/manage");

    await prisma.factChangeRun.delete({ where: { id: runId } });
    redirect("/dashboard/audit/manage");
  }

  async function deleteAll(formData: FormData) {
    "use server";
    const session = await getServerAuthSession();
    if (!session) redirect("/signin?callbackUrl=/dashboard/audit/manage");
    if (session.user.role !== "ADMIN") redirect("/dashboard/forbidden");

    const confirmed = String(formData.get("confirmed") ?? "").trim();
    if (confirmed !== "1") redirect("/dashboard/audit/manage");

    await prisma.factChangeRun.deleteMany({});
    redirect("/dashboard/audit/manage");
  }

  async function deleteByFilter(formData: FormData) {
    "use server";
    const session = await getServerAuthSession();
    if (!session) redirect("/signin?callbackUrl=/dashboard/audit/manage");
    if (session.user.role !== "ADMIN") redirect("/dashboard/forbidden");

    const hospitalId = String(formData.get("hospitalId") ?? "").trim();
    const yearRaw = String(formData.get("year") ?? "").trim();
    const statementTypeRaw = String(formData.get("statementType") ?? "").trim();
    const userId = String(formData.get("userId") ?? "").trim();
    const fromRaw = String(formData.get("from") ?? "").trim();
    const toRaw = String(formData.get("to") ?? "").trim();

    const confirmed = String(formData.get("confirmed") ?? "").trim();
    if (confirmed !== "1") redirect("/dashboard/audit/manage");

    const year = yearRaw && Number.isFinite(Number(yearRaw)) ? Number(yearRaw) : undefined;
    const statementType = parseStatementType(statementTypeRaw);
    const fromDate = parseISODate(fromRaw);
    const toDate = parseISODate(toRaw);

    const hasAnyFilter = !!hospitalId || year !== undefined || !!statementType || !!userId || !!fromDate || !!toDate;
    if (!hasAnyFilter) {
      redirect("/dashboard/audit/manage?error=nofilter");
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
      redirect("/dashboard/audit/manage?deletedRuns=0");
    }

    await prisma.factChangeRun.deleteMany({ where: whereRun });
    redirect(`/dashboard/audit/manage?deletedRuns=${runsToDelete}&deletedChanges=${changesToDelete}`);
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

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Audit Log – Management</h1>
          <div className={styles.muted}>Admin-Funktionen: Einträge/Runs löschen oder kompletten Audit Log leeren</div>
        </div>
        <Link className={styles.secondary} href="/dashboard/audit">
          ← Zurück zum Audit Log
        </Link>
      </div>

      <div className={styles.card}>
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
              className={styles.danger}
              confirmMessage="Audit Log wirklich komplett löschen? Das kann nicht rückgängig gemacht werden."
            >
              Audit Log komplett löschen
            </ConfirmSubmitButton>
          </form>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.row}>
          <div>
            <div>
              <strong>Löschen nach Filter</strong>
            </div>
            <div className={styles.muted}>Sicherheit: Ohne Filter wird nichts gelöscht. Bestätige mit „LÖSCHEN“.</div>
          </div>
        </div>

        <form className={styles.actions} action={deleteByFilter}>
          <select className={styles.input} name="hospitalId" defaultValue="">
            <option value="">Hospital: alle</option>
            {hospitals.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>

          <select className={styles.input} name="year" defaultValue="">
            <option value="">Jahr: alle</option>
            {periods.map((p) => (
              <option key={p.id} value={String(p.year)}>
                {p.year}
              </option>
            ))}
          </select>

          <select className={styles.input} name="statementType" defaultValue="">
            <option value="">Statement: alle</option>
            {Object.values(StatementType).map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          <select className={styles.input} name="userId" defaultValue="">
            <option value="">Benutzer: alle</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email ?? u.name ?? u.id}
              </option>
            ))}
          </select>

          <input className={styles.input} type="date" name="from" aria-label="Von" />
          <input className={styles.input} type="date" name="to" aria-label="Bis" />

          <input type="hidden" name="confirmed" value="1" />
          <ConfirmSubmitButton
            className={styles.danger}
            confirmMessage="Wirklich alle Audit-Runs löschen, die zu diesen Filtern passen? Das kann nicht rückgängig gemacht werden."
          >
            Nach Filter löschen
          </ConfirmSubmitButton>
        </form>
      </div>

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
                    <Link className={styles.secondary} href={`/dashboard/audit/manage/${r.id}`}>
                      Öffnen
                    </Link>
                  </td>
                  <td className={styles.td}>
                    <form action={deleteRun}>
                      <input type="hidden" name="runId" value={r.id} />
                      <button className={styles.danger} type="submit">
                        Run löschen
                      </button>
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
    </section>
  );
}
