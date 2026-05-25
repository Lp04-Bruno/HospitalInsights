import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/access";
import { Unit } from "@/prisma/generated/enums";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ runId: string }> | { runId: string };
};

async function resolveParams(params: PageProps["params"]): Promise<{ runId: string }> {
  const maybePromise = params as unknown as { then?: unknown };
  if (typeof maybePromise.then === "function") {
    return (await (params as Promise<{ runId: string }>)) ?? { runId: "" };
  }
  return (params as { runId: string }) ?? { runId: "" };
}

function unitSuffix(unit: Unit) {
  switch (unit) {
    case Unit.EUR:
      return "EUR";
    case Unit.PERCENT:
      return "%";
    case Unit.COUNT:
      return "Anzahl";
    default:
      return "";
  }
}

function formatNumberDE(value: number, unit: Unit): string {
  const maximumFractionDigits = unit === Unit.COUNT ? 0 : 2;
  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(value);
}

function formatMaybeDecimal(value: unknown, unit: Unit): string {
  if (value === null || value === undefined) return "—";
  const n = Number(String(value));
  if (!Number.isFinite(n)) return String(value);
  return `${formatNumberDE(n, unit)} ${unitSuffix(unit)}`.trim();
}

export default async function AuditRunDetailsPage({ params }: PageProps) {
  await requireAdmin("/dashboard/audit/manage");

  const { runId } = await resolveParams(params);
  if (!runId) redirect("/dashboard/audit/manage");

  async function deleteChange(formData: FormData) {
    "use server";
    await requireAdmin(`/dashboard/audit/manage/${runId}`);

    const changeId = String(formData.get("changeId") ?? "").trim();
    if (!changeId) redirect(`/dashboard/audit/manage/${runId}`);

    await prisma.$transaction(async (tx) => {
      const existing = await tx.factChange.findUnique({
        where: { id: changeId },
        select: { runId: true },
      });
      if (!existing) return;
      await tx.factChange.delete({ where: { id: changeId } });
      const remaining = await tx.factChange.count({ where: { runId: existing.runId } });
      if (remaining === 0) {
        await tx.factChangeRun.delete({ where: { id: existing.runId } });
      }
    });

    redirect(`/dashboard/audit/manage/${runId}`);
  }

  async function deleteRun() {
    "use server";
    await requireAdmin(`/dashboard/audit/manage/${runId}`);

    await prisma.factChangeRun.delete({ where: { id: runId } });
    redirect("/dashboard/audit/manage");
  }

  const run = await prisma.factChangeRun.findUnique({
    where: { id: runId },
    include: {
      user: { select: { email: true, name: true } },
      hospital: { select: { name: true } },
      period: { select: { year: true } },
      changes: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      },
    },
  });

  if (!run) {
    return (
      <section className={styles.page}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Run nicht gefunden</h1>
            <div className={styles.muted}>{runId}</div>
          </div>
          <Link className={styles.secondary} href="/dashboard/audit/manage">
            ← Zurück
          </Link>
        </div>
      </section>
    );
  }

  const who = run.user?.email ?? run.user?.name ?? "—";

  const codes = Array.from(new Set(run.changes.map((c) => c.lineItemCode)));
  const items =
    codes.length > 0
      ? await prisma.lineItem.findMany({
          where: { code: { in: codes } },
          select: { code: true, label: true },
        })
      : [];
  const labelByCode = new Map(items.map((i) => [i.code, i.label] as const));

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Run-Details</h1>
          <div className={styles.muted}>
            {run.createdAt.toLocaleString("de-DE")} · {who} · {run.hospital.name} · {run.period.year} · {run.statementType}
          </div>
        </div>
        <div className={styles.actions}>
          <Link className={styles.secondary} href="/dashboard/audit/manage">
            ← Zurück
          </Link>
          <form action={deleteRun}>
            <button className={styles.danger} type="submit">
              Run löschen
            </button>
          </form>
        </div>
      </div>

      <div className={styles.card}>
        <div>
          <strong>Run-ID:</strong> <span className={styles.mono}>{run.id}</span>
        </div>
        <div className={styles.muted}>
          Hinweis: Einzelnes Löschen entfernt die Änderung aus der Historie. Falls der Run danach leer ist, wird er automatisch mitgelöscht.
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Zeitpunkt</th>
              <th className={styles.th}>Position</th>
              <th className={styles.th}>Vorher</th>
              <th className={styles.th}>Nachher</th>
              <th className={styles.th}>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {run.changes.map((c) => {
              const label = labelByCode.get(c.lineItemCode) ?? c.lineItemCode;
              const before = formatMaybeDecimal(c.beforeValue, c.unit);
              const after = formatMaybeDecimal(c.afterValue, c.unit);
              return (
                <tr key={c.id}>
                  <td className={styles.td}>{c.createdAt.toLocaleString("de-DE")}</td>
                  <td className={styles.td}>
                    <div>{label}</div>
                    <div className={styles.mono}>{c.lineItemCode}</div>
                  </td>
                  <td className={styles.td}>{before}</td>
                  <td className={styles.td}>{after}</td>
                  <td className={styles.td}>
                    <form action={deleteChange}>
                      <input type="hidden" name="changeId" value={c.id} />
                      <button className={styles.dangerSmall} type="submit">
                        Löschen
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}

            {run.changes.length === 0 ? (
              <tr>
                <td className={styles.td} colSpan={5}>
                  Keine Änderungen im Run.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
