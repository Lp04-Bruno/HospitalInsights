export default async function Home() {
  const res = await fetch(
    "http://localhost:3000/api/metabase/embed/dashboard/1",
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
