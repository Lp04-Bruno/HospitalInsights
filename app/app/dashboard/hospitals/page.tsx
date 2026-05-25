import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { EDITOR_ROLES, requireAnyRole } from "@/lib/access";
import { ConfirmSubmitButton } from "@/app/dashboard/_components/ConfirmSubmitButton";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

async function requireHospitalAccess() {
  await requireAnyRole(EDITOR_ROLES, "/dashboard/hospitals");
}

async function createHospital(formData: FormData) {
  "use server";

  await requireHospitalAccess();

  const name = String(formData.get("name") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();

  if (!name || !city || !state) redirect("/dashboard/hospitals");

  await prisma.hospital.create({
    data: {
      name,
      city,
      state,
    },
  });

  revalidatePath("/dashboard/hospitals");
  redirect("/dashboard/hospitals");
}

async function deleteHospital(formData: FormData) {
  "use server";

  await requireHospitalAccess();

  const hospitalId = String(formData.get("hospitalId") ?? "");
  if (!hospitalId) redirect("/dashboard/hospitals");

  await prisma.hospital.delete({ where: { id: hospitalId } });

  revalidatePath("/dashboard/hospitals");
  redirect("/dashboard/hospitals");
}

async function deleteHospitalYear(formData: FormData) {
  "use server";

  await requireHospitalAccess();

  const hospitalId = String(formData.get("hospitalId") ?? "");
  const year = Number(String(formData.get("year") ?? "").trim());
  if (!hospitalId) redirect("/dashboard/hospitals");
  if (!Number.isInteger(year) || year < 1900 || year > 2100) redirect("/dashboard/hospitals");

  const period = await prisma.period.findUnique({ where: { year } });
  if (!period) redirect("/dashboard/hospitals");

  await prisma.factChangeRun.deleteMany({
    where: {
      hospitalId,
      periodId: period.id,
    },
  });

  const res = await prisma.factValue.deleteMany({
    where: {
      hospitalId,
      periodId: period.id,
    },
  });

  await prisma.hospitalPeriod.deleteMany({
    where: {
      hospitalId,
      periodId: period.id,
    },
  });

  revalidatePath("/dashboard/hospitals");
  redirect(`/dashboard/hospitals?notice=${encodeURIComponent(`Jahr ${year} gelöscht (${res.count} Werte entfernt).`)}`);
}

type HospitalsPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function HospitalsPage({ searchParams }: HospitalsPageProps) {
  await requireHospitalAccess();

  const hospitals = await prisma.hospital.findMany({
    orderBy: { name: "asc" },
  });

  const hospitalPeriods = await prisma.hospitalPeriod.findMany({
    include: { period: { select: { year: true } } },
  });

  const yearsByHospitalId = new Map<string, number[]>();
  for (const hp of hospitalPeriods) {
    const list = yearsByHospitalId.get(hp.hospitalId);
    if (list) list.push(hp.period.year);
    else yearsByHospitalId.set(hp.hospitalId, [hp.period.year]);
  }
  for (const [hid, yrs] of yearsByHospitalId) {
    yearsByHospitalId.set(
      hid,
      Array.from(new Set(yrs)).sort((a, b) => b - a)
    );
  }

  const notice = typeof searchParams?.notice === "string" ? searchParams.notice : undefined;

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Hospitalverwaltung</h1>
        <p className={styles.subtitle}>Krankenhäuser anlegen und verwalten.</p>
      </header>

      {notice ? <div className={styles.empty}>{notice}</div> : null}

      <div className={styles.grid}>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Neues Krankenhaus</h2>
          <form action={createHospital} className={styles.form}>
            <div className={styles.row}>
              <label className={styles.label}>
                Name
                <input name="name" className={styles.input} placeholder="z.B. Klinikum Musterstadt" required />
              </label>
            </div>
            <div className={styles.row}>
              <label className={styles.label}>
                Stadt
                <input name="city" className={styles.input} placeholder="z.B. Hannover" required />
              </label>
            </div>
            <div className={styles.row}>
              <label className={styles.label}>
                Bundesland
                <input name="state" className={styles.input} placeholder="z.B. Niedersachsen" required />
              </label>
            </div>
            <div className={styles.actions}>
              <button className={styles.button} type="submit">
                Anlegen
              </button>
            </div>
          </form>
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Bestehende Krankenhäuser</h2>
          {hospitals.length === 0 ? (
            <div className={styles.empty}>Noch keine Krankenhäuser vorhanden.</div>
          ) : (
            <div className={styles.list}>
              {hospitals.map((h) => (
                <div key={h.id} className={styles.listItem}>
                  <div className={styles.listMain}>
                    <div className={styles.hospitalName}>{h.name}</div>
                    <div className={styles.hospitalMeta}>
                      {[h.city, h.state]
                        .map((x) => String(x ?? "").trim())
                        .filter((x) => x.length > 0)
                        .join(" · ") || "—"}
                    </div>
                  </div>

                  <div className={styles.listActions}>
                    {(yearsByHospitalId.get(h.id)?.length ?? 0) === 0 ? (
                      <div className={styles.actionsMeta}>Keine Jahre mit Daten vorhanden.</div>
                    ) : (
                      <form action={deleteHospitalYear} className={styles.inlineForm}>
                        <input type="hidden" name="hospitalId" value={h.id} />
                        <select name="year" className={styles.select} defaultValue={String((yearsByHospitalId.get(h.id) ?? [])[0])}>
                          {(yearsByHospitalId.get(h.id) ?? []).map((y) => (
                            <option key={y} value={String(y)}>
                              {y}
                            </option>
                          ))}
                        </select>

                        <ConfirmSubmitButton
                          className={styles.dangerSmall}
                          confirmMessage="Soll das ausgewählte Jahr wirklich gelöscht werden? Alle Eingaben für dieses Krankenhaus/Jahr werden entfernt."
                        >
                          Jahr löschen
                        </ConfirmSubmitButton>
                      </form>
                    )}

                    <form action={deleteHospital}>
                      <input type="hidden" name="hospitalId" value={h.id} />
                      <button className={styles.danger} type="submit">
                        Hospital löschen
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
