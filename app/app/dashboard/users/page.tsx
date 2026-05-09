import bcrypt from "bcrypt";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getServerAuthSession } from "@/lib/auth";
import { Role } from "@/prisma/generated/enums";
import styles from "./page.module.css";
import { ConfirmSubmitButton } from "@/app/dashboard/_components/ConfirmSubmitButton";
import { ResetPasswordButton } from "./ResetPasswordButton";

async function createUser(formData: FormData) {
  "use server";

  const session = await getServerAuthSession();
  if (!session) redirect("/signin?callbackUrl=/dashboard/users");
  if (session.user.role !== "ADMIN") redirect("/dashboard/forbidden");

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "VIEWER") as Role;

  if (!email || !name) redirect("/dashboard/users");

  const sessionEmail = String(session.user.email ?? "")
    .trim()
    .toLowerCase();
  if (sessionEmail && email === sessionEmail && role !== session.user.role) {
    redirect("/dashboard/users");
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        name,
        role,
      },
    });
  } else {
    if (!password) redirect("/dashboard/users");

    const hash = await bcrypt.hash(password, 12);

    await prisma.user.create({
      data: {
        email,
        name,
        password: hash,
        role,
      },
    });
  }

  redirect("/dashboard/users");
}

async function setRole(formData: FormData) {
  "use server";

  const session = await getServerAuthSession();
  if (!session) redirect("/signin?callbackUrl=/dashboard/users");
  if (session.user.role !== "ADMIN") redirect("/dashboard/forbidden");

  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "VIEWER") as Role;
  if (!userId) redirect("/dashboard/users");

  if (userId === session.user.id) {
    redirect("/dashboard/users");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { role },
  });

  redirect("/dashboard/users");
}

async function deleteUser(formData: FormData) {
  "use server";

  const session = await getServerAuthSession();
  if (!session) redirect("/signin?callbackUrl=/dashboard/users");
  if (session.user.role !== "ADMIN") redirect("/dashboard/forbidden");

  const confirmed = String(formData.get("confirmed") ?? "").trim();
  const userId = String(formData.get("userId") ?? "").trim();
  if (confirmed !== "1" || !userId) redirect("/dashboard/users");

  if (userId === session.user.id) {
    redirect("/dashboard/users");
  }

  await prisma.user.delete({ where: { id: userId } });
  redirect("/dashboard/users");
}

export default async function UsersPage() {
  const session = await getServerAuthSession();
  if (!session) redirect("/signin?callbackUrl=/dashboard/users");

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard/forbidden");
  }

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
        <p className={styles.subtitle}>Benutzer anlegen, Stammdaten pflegen, Rollen zuweisen, Passwörter zurücksetzen.</p>
      </header>

      <div className={styles.grid}>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Benutzer anlegen oder aktualisieren</h2>
          <form action={createUser} className={styles.form}>
            <div className={styles.row}>
              <label className={styles.label}>
                Email
                <input name="email" className={styles.input} placeholder="z.B. editor@hospitalinsights.local" type="email" required />
              </label>
            </div>
            <div className={styles.row}>
              <label className={styles.label}>
                Name
                <input name="name" className={styles.input} placeholder="z.B. Max Mustermann" required />
              </label>
            </div>
            <div className={styles.row}>
              <label className={styles.label}>
                Initialpasswort
                <input name="password" className={styles.input} type="password" placeholder="Nur für neue Benutzer erforderlich" />
              </label>
            </div>
            <div className={styles.row}>
              <label className={styles.label}>
                Rolle
                <select name="role" className={styles.select} defaultValue={Role.EDITOR}>
                  {Object.values(Role).map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className={styles.actions}>
              <button className={styles.button} type="submit">
                Benutzer speichern
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
                  <div className={styles.userMeta}>{((u.name ?? "").trim() || "—") + " · " + u.role}</div>
                </div>

                <form action={setRole} className={styles.roleForm}>
                  <input type="hidden" name="userId" value={u.id} />
                  <select name="role" className={styles.roleSelect} defaultValue={u.role}>
                    {Object.values(Role).map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <button className={styles.secondary} type="submit">
                    Setzen
                  </button>
                </form>

                <div className={styles.rowActions}>
                  <ResetPasswordButton userId={u.id} email={u.email} className={styles.secondary} />
                  <form action={deleteUser}>
                    <input type="hidden" name="userId" value={u.id} />
                    <input type="hidden" name="confirmed" value="1" />
                    <ConfirmSubmitButton className={styles.dangerSmall} confirmMessage={`Benutzer ${u.email} wirklich löschen?`}>
                      Löschen
                    </ConfirmSubmitButton>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
