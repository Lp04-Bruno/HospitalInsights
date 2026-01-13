import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

export default async function AdminPage() {
    const session = await getServerSession();
    if (!session) redirect("/signin");

    return (
        <main style={{ padding: 24 }}>
            <h1>Admin</h1>
            <p>Du bist eingeloggt.</p>
        </main>
    );
}
