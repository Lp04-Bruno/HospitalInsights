import { SignInForm } from "./SignInForm";
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
      <div className={styles.center}>
        <SignInForm callbackUrl={callbackUrl} />
      </div>
    </main>
  );
}



