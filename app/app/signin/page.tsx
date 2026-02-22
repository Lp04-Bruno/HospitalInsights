import { SignInForm } from "./SignInForm";
import Link from "next/link";
import styles from "./page.module.css";

type SignInPageProps = {
  searchParams?: { callbackUrl?: string | string[] } | Promise<{ callbackUrl?: string | string[] }>;
};

async function resolveSearchParams(searchParams: SignInPageProps["searchParams"]): Promise<{ callbackUrl?: string | string[] }> {
  if (!searchParams) return {};
  const maybePromise = searchParams as unknown as { then?: unknown };
  if (typeof maybePromise.then === "function") {
    return (await (searchParams as Promise<{ callbackUrl?: string | string[] }>)) ?? {};
  }
  return (searchParams as { callbackUrl?: string | string[] }) ?? {};
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const sp = await resolveSearchParams(searchParams);
  const callbackUrlRaw = Array.isArray(sp.callbackUrl) ? sp.callbackUrl[0] : sp.callbackUrl;

  const callbackUrl = typeof callbackUrlRaw === "string" && callbackUrlRaw ? callbackUrlRaw : "/dashboard";

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.topLink}>
          Startseite
        </Link>
      </header>
      <div className={styles.center}>
        <SignInForm callbackUrl={callbackUrl} />
      </div>
    </main>
  );
}
