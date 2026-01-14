"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useSearchParams } from "next/navigation";

export default function SignInPage() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const [email, setEmail] = useState("admin@hospitalinsights.local");
  const [password, setPassword] = useState("admin1234");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#fafafa",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 420,
          padding: 24,
          border: "1px solid #e5e5e5",
          borderRadius: 12,
          background: "white",
        }}
      >
        <h1 style={{ marginTop: 0 }}>Sign in</h1>
        <p style={{ marginTop: 8, color: "#666" }}>
          Melde dich an, um auf den geschützten Bereich zuzugreifen.
        </p>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setIsLoading(true);

          try {
            const res = await signIn("credentials", {
              email,
              password,
              redirect: true,
              callbackUrl,
            });

            // Wenn redirect=true, kommt man i. d. R. nicht hier an
            if (res?.error) setError(res.error);
          } finally {
            setIsLoading(false);
          }
        }}
      >
        <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#444" }}>Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              autoComplete="email"
              inputMode="email"
              style={{ padding: 10, borderRadius: 8, border: "1px solid #ddd" }}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#444" }}>Passwort</span>
            <input
              value={password}
              type="password"
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              style={{ padding: 10, borderRadius: 8, border: "1px solid #ddd" }}
            />
          </label>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #111",
              background: isLoading ? "#333" : "#111",
              color: "white",
              cursor: isLoading ? "not-allowed" : "pointer",
            }}
          >
            {isLoading ? "Signing in…" : "Sign in"}
          </button>

          {error && (
            <p style={{ color: "#b00020", margin: 0 }}>
              {error === "CredentialsSignin"
                ? "Email oder Passwort ist falsch."
                : error}
            </p>
          )}
        </div>
      </form>

        <p style={{ marginTop: 16, fontSize: 12, color: "#666" }}>
          Nach dem Login wirst du weitergeleitet zu: <code>{callbackUrl}</code>
        </p>
      </section>
    </main>
  );
}
