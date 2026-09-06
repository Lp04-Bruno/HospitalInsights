"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./sign-in-form.module.css";
import { SIGN_IN_ERROR, SIGN_IN_FALLBACK_MESSAGE, signInErrorMessage } from "@/lib/signIn";

type SignInFormProps = {
  callbackUrl: string;
  initialError?: string;
};

export function SignInForm({ callbackUrl, initialError }: SignInFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(() => signInErrorMessage(initialError) ?? null);
  const [isLoading, setIsLoading] = useState(false);

  return (
    <section className={styles.card}>
      <h1 className={styles.title}>Sign in</h1>
      <p className={styles.subtitle}>Melde dich an, um auf den geschützten Bereich zuzugreifen.</p>

      <form
        className={styles.form}
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);

          if (!email.trim() || !password) {
            setError("Bitte Email und Passwort ausfüllen.");
            return;
          }

          setIsLoading(true);

          try {
            const res = await signIn("credentials", {
              email,
              password,
              redirect: false,
              callbackUrl,
            });

            if (!res || res.error) {
              setError(signInErrorMessage(res?.error) ?? SIGN_IN_FALLBACK_MESSAGE);
              setIsLoading(false);
              return;
            }

            router.push(res.url ?? callbackUrl);
            router.refresh();
          } catch {
            setError(signInErrorMessage(SIGN_IN_ERROR.SERVICE_UNAVAILABLE) ?? SIGN_IN_FALLBACK_MESSAGE);
            setIsLoading(false);
          }
        }}
      >
        <label className={styles.field}>
          <span className={styles.label}>Email</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className={styles.input}
            disabled={isLoading}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Passwort</span>
          <input
            value={password}
            type={showPassword ? "text" : "password"}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            autoComplete="current-password"
            className={styles.input}
            disabled={isLoading}
          />
        </label>

        <label className={styles.checkRow}>
          <input className={styles.checkbox} type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
          <span className={styles.checkLabel}>Passwort anzeigen</span>
        </label>

        <button type="submit" disabled={isLoading} className={styles.button}>
          {isLoading ? "Signing in…" : "Sign in"}
        </button>

        {error && (
          <p className={styles.error} role="alert" aria-live="assertive">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
