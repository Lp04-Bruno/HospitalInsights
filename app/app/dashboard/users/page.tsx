import bcrypt from "bcrypt";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getServerAuthSession } from "@/lib/auth";
import { Role } from "@prisma/client";
import styles from "./page.module.css";

async function createUser(formData: FormData) {
    "use server";

    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const name = String(formData.get("name") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const role = String(formData.get("role") ?? "VIEWER") as Role;

    if (!email || !password) redirect("/dashboard/users");

    const hash = await bcrypt.hash(password, 12);

    await prisma.user.upsert({
        where: { email },
        update: {
            name: name || null,
            role,
        },
        create: {
            email,
            name: name || null,
            password: hash,
            role,
        },
    });

    redirect("/dashboard/users");
}

async function setRole(formData: FormData) {
    "use server";

    const userId = String(formData.get("userId") ?? "");
    const role = String(formData.get("role") ?? "VIEWER") as Role;
    if (!userId) redirect("/dashboard/users");

    await prisma.user.update({
        where: { id: userId },
        data: { role },
    });

    redirect("/dashboard/users");
}

export default async function UsersPage() {
    const session = await getServerAuthSession();
    if (!session) redirect("/signin?callbackUrl=/dashboard/users");

    // Only ADMIN can manage users.
    const isAdmin = session.user.role === "ADMIN";

    const users = await prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
        },
    });

    return (
        <section className={styles.page}>
            <header className={styles.header}>
                <h1 className={styles.title}>Benutzerverwaltung</h1>
                <p className={styles.subtitle}>
                    Benutzer anlegen und Rollen zuweisen. Nur Admins dürfen hier Änderungen machen.
                </p>
            </header>

            {!isAdmin && (
                <div className={styles.notice}>
                    Du bist kein Admin. Du kannst die Benutzerliste sehen, aber keine Änderungen durchführen.
                </div>
            )}

            <div className={styles.grid}>
                <div className={styles.card}>
                    <h2 className={styles.cardTitle}>Benutzer anlegen (oder updaten)</h2>
                    <form action={createUser} className={styles.form}>
                        <div className={styles.row}>
                            <label className={styles.label}>
                                Email
                                <input
                                    name="email"
                                    className={styles.input}
                                    placeholder="z.B. editor@hospitalinsights.local"
                                    type="email"
                                    required
                                    disabled={!isAdmin}
                                />
                            </label>
                        </div>
                        <div className={styles.row}>
                            <label className={styles.label}>
                                Name (optional)
                                <input name="name" className={styles.input} placeholder="z.B. Max Mustermann" disabled={!isAdmin} />
                            </label>
                        </div>
                        <div className={styles.row}>
                            <label className={styles.label}>
                                Passwort
                                <input name="password" className={styles.input} type="password" required disabled={!isAdmin} />
                            </label>
                        </div>
                        <div className={styles.row}>
                            <label className={styles.label}>
                                Rolle
                                <select name="role" className={styles.select} defaultValue={Role.EDITOR} disabled={!isAdmin}>
                                    {Object.values(Role).map((r) => (
                                        <option key={r} value={r}>
                                            {r}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        <div className={styles.actions}>
                            <button className={styles.button} type="submit" disabled={!isAdmin}>
                                Speichern
                            </button>
                        </div>
                    </form>
                </div>

                <div className={styles.card}>
                    <h2 className={styles.cardTitle}>Bestehende Benutzer</h2>
                    <div className={styles.list}>
                        {users.map((u) => (
                            <div key={u.id} className={styles.listItem}>
                                <div className={styles.listMain}>
                                    <div className={styles.userEmail}>{u.email}</div>
                                    <div className={styles.userMeta}>
                                        {(u.name || "—") + " · " + u.role}
                                    </div>
                                </div>

                                <form action={setRole} className={styles.roleForm}>
                                    <input type="hidden" name="userId" value={u.id} />
                                    <select
                                        name="role"
                                        className={styles.roleSelect}
                                        defaultValue={u.role}
                                        disabled={!isAdmin}
                                    >
                                        {Object.values(Role).map((r) => (
                                            <option key={r} value={r}>
                                                {r}
                                            </option>
                                        ))}
                                    </select>
                                    <button className={styles.secondary} type="submit" disabled={!isAdmin}>
                                        Setzen
                                    </button>
                                </form>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
