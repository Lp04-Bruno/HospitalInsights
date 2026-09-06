import { SignInForm } from "./SignInForm";
import { AuthShell } from "@/app/_components/AuthShell";
import { safeCallbackUrl } from "@/lib/signIn";
import { firstSearchParam, resolveSearchParams } from "@/lib/validation";

type SignInPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const sp = await resolveSearchParams(searchParams);

  const callbackUrl = safeCallbackUrl(firstSearchParam(sp.callbackUrl));
  const initialError = firstSearchParam(sp.error);

  return (
    <AuthShell>
      <SignInForm callbackUrl={callbackUrl} initialError={initialError} />
    </AuthShell>
  );
}
