import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await getServerAuthSession();
  if (!session) redirect("/signin?callbackUrl=/dashboard");

  if (session.user.role !== "ADMIN" && session.user.role !== "EDITOR") {
    redirect("/dashboard/forbidden");
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Dashboard</h1>
      <p>
        Eingeloggt als <strong>{session.user?.email}</strong>
      </p>
      <p>Rolle: {session.user.role}</p>

      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <Link href="/">Öffentliche Startseite</Link>
      </div>
    </main>
  );
}
