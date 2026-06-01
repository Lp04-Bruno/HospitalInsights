import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireDashboardRouteAccess } from "@/lib/access";
import { parseFlashMessage, redirectWithFlash } from "@/lib/actionResult";
import { formString, yearSchema } from "@/lib/validation";
import { ConfirmSubmitButton } from "@/app/dashboard/_components/ConfirmSubmitButton";
import { DashboardToast } from "@/app/dashboard/_components/DashboardToast";
import styles from "./page.module.css";
import {
  DashboardActions,
  DashboardButton,
  DashboardCard,
  DashboardField,
  DashboardGrid,
  DashboardHeader,
  DashboardNotice,
  DashboardPage,
  dashboardUi,
} from "@/app/dashboard/_components/DashboardUi";

export const dynamic = "force-dynamic";

async function requireHospitalAccess() {
  await requireDashboardRouteAccess("/dashboard/hospitals");
}

async function createHospital(formData: FormData) {
  "use server";

  await requireHospitalAccess();

  const name = formString(formData, "name");
  const city = formString(formData, "city");
  const state = formString(formData, "state");

  if (!name || !city || !state) redirect("/dashboard/hospitals");

  await prisma.hospital.create({
    data: {
      name,
      city,
      state,
    },
  });

  revalidatePath("/dashboard/hospitals");
  redirectWithFlash("/dashboard/hospitals", { tone: "success", message: `Krankenhaus angelegt: ${name}` });
}

async function deleteHospital(formData: FormData) {
  "use server";

  await requireHospitalAccess();

  const hospitalId = formString(formData, "hospitalId");
  const confirmed = formString(formData, "confirmed");
  if (!hospitalId || confirmed !== "1") redirect("/dashboard/hospitals");

  await prisma.hospital.delete({ where: { id: hospitalId } });

  revalidatePath("/dashboard/hospitals");
  redirectWithFlash("/dashboard/hospitals", { tone: "success", message: "Krankenhaus gelöscht." });
}

async function deleteHospitalYear(formData: FormData) {
  "use server";

  await requireHospitalAccess();

  const hospitalId = formString(formData, "hospitalId");
  const confirmed = formString(formData, "confirmed");
  const year = yearSchema.safeParse(formData.get("year"));
  if (!hospitalId) redirect("/dashboard/hospitals");
  if (confirmed !== "1") redirect("/dashboard/hospitals");
  if (!year.success) redirect("/dashboard/hospitals");

  const period = await prisma.period.findUnique({ where: { year: year.data } });
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
  redirectWithFlash("/dashboard/hospitals", { tone: "success", message: `Jahr ${year.data} gelöscht (${res.count} Werte entfernt).` });
}

type HospitalsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
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

  const resolvedSearchParams = await searchParams;
  const flash = parseFlashMessage(resolvedSearchParams);

  return (
    <DashboardPage>
      <DashboardHeader title="Hospitalverwaltung" subtitle="Krankenhäuser anlegen und verwalten." />

      <DashboardToast flash={flash} />

      <DashboardGrid>
        <DashboardCard title="Neues Krankenhaus">
          <form action={createHospital} className={styles.form}>
            <DashboardField label="Name">
              <input name="name" className={dashboardUi.input} placeholder="z.B. Klinikum Musterstadt" required />
            </DashboardField>
            <DashboardField label="Stadt">
              <input name="city" className={dashboardUi.input} placeholder="z.B. Hannover" required />
            </DashboardField>
            <DashboardField label="Bundesland">
              <input name="state" className={dashboardUi.input} placeholder="z.B. Niedersachsen" required />
            </DashboardField>
            <DashboardActions>
              <DashboardButton type="submit">Anlegen</DashboardButton>
            </DashboardActions>
          </form>
        </DashboardCard>

        <DashboardCard title="Bestehende Krankenhäuser">
          {hospitals.length === 0 ? (
            <DashboardNotice>Noch keine Krankenhäuser vorhanden.</DashboardNotice>
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
                        <input type="hidden" name="confirmed" value="1" />
                        <select name="year" className={dashboardUi.select} defaultValue={String((yearsByHospitalId.get(h.id) ?? [])[0])}>
                          {(yearsByHospitalId.get(h.id) ?? []).map((y) => (
                            <option key={y} value={String(y)}>
                              {y}
                            </option>
                          ))}
                        </select>

                        <ConfirmSubmitButton
                          className={`${dashboardUi.button} ${dashboardUi.danger}`}
                          confirmMessage="Soll das ausgewählte Jahr wirklich gelöscht werden? Alle Eingaben für dieses Krankenhaus/Jahr werden entfernt."
                        >
                          Jahr löschen
                        </ConfirmSubmitButton>
                      </form>
                    )}

                    <form action={deleteHospital}>
                      <input type="hidden" name="hospitalId" value={h.id} />
                      <input type="hidden" name="confirmed" value="1" />
                      <ConfirmSubmitButton
                        className={`${dashboardUi.button} ${dashboardUi.danger}`}
                        confirmMessage={`Krankenhaus ${h.name} wirklich löschen?`}
                      >
                        Hospital löschen
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DashboardCard>
      </DashboardGrid>
    </DashboardPage>
  );
}
