import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import styles from "./page.module.css";

async function createHospital(formData: FormData) {
    "use server";

    const name = String(formData.get("name") ?? "").trim();
    const city = String(formData.get("city") ?? "").trim();
    const state = String(formData.get("state") ?? "").trim();

    if (!name) redirect("/dashboard/hospitals");

    await prisma.hospital.create({
        data: {
            name,
            city: city || null,
            state: state || null,
        },
    });

    redirect("/dashboard/hospitals");
}

async function deleteHospital(formData: FormData) {
    "use server";

    const hospitalId = String(formData.get("hospitalId") ?? "");
    if (!hospitalId) redirect("/dashboard/hospitals");

    await prisma.hospital.delete({ where: { id: hospitalId } });
    redirect("/dashboard/hospitals");
}

async function deleteHospitalYear(formData: FormData) {
    "use server";

    const hospitalId = String(formData.get("hospitalId") ?? "");
    const year = Number(String(formData.get("year") ?? "").trim());
    if (!hospitalId) redirect("/dashboard/hospitals");
    if (!Number.isInteger(year) || year < 1900 || year > 2100) redirect("/dashboard/hospitals");

    const period = await prisma.period.findUnique({ where: { year } });
    if (!period) redirect("/dashboard/hospitals");

    await prisma.factValue.deleteMany({
        where: {
            hospitalId,
            periodId: period.id,
        },
    });

    redirect("/dashboard/hospitals");
}

export default async function HospitalsPage() {
    const hospitals = await prisma.hospital.findMany({
        orderBy: { name: "asc" },
    });

    const periods = await prisma.period.findMany({
        orderBy: { year: "desc" },
    });

    return (
        <section className={styles.page}>
            <header className={styles.header}>
                <h1 className={styles.title}>Hospitalverwaltung</h1>
                <p className={styles.subtitle}>
                    Krankenhäuser anlegen und verwalten.
                </p>
            </header>

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
                                Stadt (optional)
                                <input name="city" className={styles.input} placeholder="z.B. Hannover" />
                            </label>
                        </div>
                        <div className={styles.row}>
                            <label className={styles.label}>
                                Bundesland (optional)
                                <input name="state" className={styles.input} placeholder="z.B. Niedersachsen" />
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
                                            {[h.city, h.state].filter(Boolean).join(" · ") || "—"}
                                        </div>
                                    </div>

                                    <div className={styles.listActions}>
                                        {periods.length === 0 ? (
                                            <div className={styles.actionsMeta}>Keine Jahre vorhanden.</div>
                                        ) : (
                                            <form action={deleteHospitalYear} className={styles.inlineForm}>
                                                <input type="hidden" name="hospitalId" value={h.id} />
                                                <select name="year" className={styles.select} defaultValue={String(periods[0]?.year)}>
                                                    {periods.map((p) => (
                                                        <option key={p.id} value={String(p.year)}>
                                                            {p.year}
                                                        </option>
                                                    ))}
                                                </select>
                                                <button className={styles.dangerSmall} type="submit">
                                                    Jahr löschen
                                                </button>
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
