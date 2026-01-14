export default async function Home() {
  const dashboardId = Number(process.env.METABASE_DASHBOARD_ID ?? "1");
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  const res = await fetch(
    new URL(`/api/metabase/embed/dashboard/${dashboardId}`, baseUrl),
    { cache: "no-store" }
  );
  const data = await res.json();

  return (
    <main style={{ padding: 20 }}>
      <h1>HospitalInsights</h1>
      {data.iframeUrl ? (
        <iframe
          src={data.iframeUrl}
          style={{ width: "100%", height: "80vh", border: 0 }}
        />
      ) : (
        <p>No dashboard iframeUrl returned.</p>
      )}
    </main>
  );
}
