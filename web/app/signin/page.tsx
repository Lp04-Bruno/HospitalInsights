import { SignInForm } from "./SignInForm";
import { AuthShell } from "@/app/_components/AuthShell";

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
    <AuthShell>
      <SignInForm callbackUrl={callbackUrl} />
    </AuthShell>
  );
}
