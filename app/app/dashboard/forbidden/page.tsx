export default function ForbiddenPage() {
  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1>Zugriff verweigert</h1>
      <p>Du bist eingeloggt, hast aber keine Berechtigung für diesen Bereich.</p>
      <p>
        Wenn du glaubst, dass das ein Fehler ist, wende dich an einen Admin.
      </p>
    </main>
  );
}
