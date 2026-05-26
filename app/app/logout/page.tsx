import { LogoutClient } from "./LogoutClient";
import { AuthShell } from "@/app/_components/AuthShell";

type LogoutPageProps = {
  searchParams?: { callbackUrl?: string | string[] } | Promise<{ callbackUrl?: string | string[] }>;
};

async function resolveSearchParams(searchParams: LogoutPageProps["searchParams"]): Promise<{ callbackUrl?: string | string[] }> {
  if (!searchParams) return {};
  const maybePromise = searchParams as unknown as { then?: unknown };
  if (typeof maybePromise.then === "function") {
    return (await (searchParams as Promise<{ callbackUrl?: string | string[] }>)) ?? {};
  }
  return (searchParams as { callbackUrl?: string | string[] }) ?? {};
}

export default async function LogoutPage({ searchParams }: LogoutPageProps) {
  const sp = await resolveSearchParams(searchParams);
  const callbackUrlRaw = Array.isArray(sp.callbackUrl) ? sp.callbackUrl[0] : sp.callbackUrl;
  const callbackUrl = typeof callbackUrlRaw === "string" && callbackUrlRaw ? callbackUrlRaw : "/";

  return (
    <AuthShell>
      <LogoutClient callbackUrl={callbackUrl} />
    </AuthShell>
  );
}
