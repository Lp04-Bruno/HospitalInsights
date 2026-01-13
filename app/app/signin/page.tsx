"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function SignInPage() {
  const [email, setEmail] = useState("admin@hospitalinsights.local");
  const [password, setPassword] = useState("admin1234");
  const [error, setError] = useState<string | null>(null);

  return (
    <main style={{ padding: 24, maxWidth: 420 }}>
      <h1>Sign in</h1>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);

          const res = await signIn("credentials", {
            email,
            password,
            redirect: true,
            callbackUrl: "/admin",
          });

          // Wenn redirect=true, kommt man i. d. R. nicht hier an
          if (res?.error) setError(res.error);
        }}
      >
        <div style={{ display: "grid", gap: 12 }}>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
          />
          <input
            value={password}
            type="password"
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
          />
          <button type="submit">Sign in</button>
          {error && <p style={{ color: "red" }}>{error}</p>}
        </div>
      </form>
    </main>
  );
}
