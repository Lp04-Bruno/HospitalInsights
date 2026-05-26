import bcrypt from "bcrypt";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/access";
import { formString, roleSchema } from "@/lib/validation";
import { Role } from "@/prisma/generated/enums";
import styles from "./page.module.css";
import { ConfirmSubmitButton } from "@/app/dashboard/_components/ConfirmSubmitButton";
import { ResetPasswordButton } from "./ResetPasswordButton";
import {
  DashboardActions,
  DashboardButton,
  DashboardCard,
  DashboardField,
  DashboardGrid,
  DashboardHeader,
  DashboardPage,
  dashboardUi,
} from "@/app/dashboard/_components/DashboardUi";

async function createUser(formData: FormData) {
  "use server";

  const session = await requireAdmin("/dashboard/users");

  const roleResult = roleSchema.safeParse(formData.get("role"));
  const email = formString(formData, "email").toLowerCase();
  const name = formString(formData, "name");
  const password = typeof formData.get("password") === "string" ? String(formData.get("password")) : "";

  if (!email || !name || !roleResult.success) redirect("/dashboard/users");

  const role = roleResult.data;

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

  const session = await requireAdmin("/dashboard/users");

  const userId = formString(formData, "userId");
  const roleResult = roleSchema.safeParse(formData.get("role"));
  if (!userId || !roleResult.success) redirect("/dashboard/users");

  const role = roleResult.data;

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

  const session = await requireAdmin("/dashboard/users");

  const confirmed = formString(formData, "confirmed");
  const userId = formString(formData, "userId");
  if (confirmed !== "1" || !userId) redirect("/dashboard/users");

  if (userId === session.user.id) {
    redirect("/dashboard/users");
  }

  await prisma.user.delete({ where: { id: userId } });
  redirect("/dashboard/users");
}

export default async function UsersPage() {
  await requireAdmin("/dashboard/users");

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
    <DashboardPage>
      <DashboardHeader
        title="Benutzerverwaltung"
        subtitle="Benutzer anlegen, Stammdaten pflegen, Rollen zuweisen, Passwörter zurücksetzen."
      />

      <DashboardGrid>
        <DashboardCard title="Benutzer anlegen oder aktualisieren">
          <form action={createUser} className={styles.form}>
            <DashboardField label="Email">
              <input name="email" className={dashboardUi.input} placeholder="z.B. editor@hospitalinsights.local" type="email" required />
            </DashboardField>
            <DashboardField label="Name">
              <input name="name" className={dashboardUi.input} placeholder="z.B. Max Mustermann" required />
            </DashboardField>
            <DashboardField label="Initialpasswort">
              <input name="password" className={dashboardUi.input} type="password" placeholder="Nur für neue Benutzer erforderlich" />
            </DashboardField>
            <DashboardField label="Rolle">
              <select name="role" className={dashboardUi.select} defaultValue={Role.EDITOR}>
                {Object.values(Role).map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </DashboardField>
            <DashboardActions>
              <DashboardButton type="submit">Benutzer speichern</DashboardButton>
            </DashboardActions>
          </form>
        </DashboardCard>

        <DashboardCard title="Bestehende Benutzer">
          <div className={styles.list}>
            {users.map((u) => (
              <div key={u.id} className={styles.listItem}>
                <div className={styles.listMain}>
                  <div className={styles.userEmail}>{u.email}</div>
                  <div className={styles.userMeta}>{((u.name ?? "").trim() || "—") + " · " + u.role}</div>
                </div>

                <form action={setRole} className={styles.roleForm}>
                  <input type="hidden" name="userId" value={u.id} />
                  <select name="role" className={dashboardUi.select} defaultValue={u.role}>
                    {Object.values(Role).map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <DashboardButton tone="secondary" type="submit">
                    Setzen
                  </DashboardButton>
                </form>

                <div className={styles.rowActions}>
                  <ResetPasswordButton userId={u.id} email={u.email} className={`${dashboardUi.button} ${dashboardUi.secondary}`} />
                  <form action={deleteUser}>
                    <input type="hidden" name="userId" value={u.id} />
                    <input type="hidden" name="confirmed" value="1" />
                    <ConfirmSubmitButton
                      className={`${dashboardUi.button} ${dashboardUi.danger}`}
                      confirmMessage={`Benutzer ${u.email} wirklich löschen?`}
                    >
                      Löschen
                    </ConfirmSubmitButton>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </DashboardCard>
      </DashboardGrid>
    </DashboardPage>
  );
}
