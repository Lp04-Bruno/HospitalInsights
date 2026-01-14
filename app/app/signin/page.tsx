import { SignInForm } from "./SignInForm";
import Link from "next/link";
import styles from "./page.module.css";

type SignInPageProps = {
  searchParams?: {
    callbackUrl?: string;
  };
};

export default function SignInPage({ searchParams }: SignInPageProps) {
  const callbackUrl =
    typeof searchParams?.callbackUrl === "string" && searchParams.callbackUrl
      ? searchParams.callbackUrl
      : "/dashboard";

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



