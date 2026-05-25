import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/lib/auth";
import { Role } from "@/prisma/generated/enums";

export const EDITOR_ROLES = [Role.ADMIN, Role.EDITOR] as const;
export const ADMIN_ROLES = [Role.ADMIN] as const;

type RoleLike = Role | (typeof EDITOR_ROLES)[number] | (typeof ADMIN_ROLES)[number];

export function hasAnyRole(session: { user?: { role?: string } } | null | undefined, roles: readonly RoleLike[]) {
  const role = session?.user?.role;
  return roles.some((allowed) => allowed === role);
}

export async function requireSession(callbackUrl: string) {
  const session = await getServerAuthSession();
  if (!session) redirect(`/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  return session;
}

export async function requireAnyRole(roles: readonly RoleLike[], callbackUrl: string) {
  const session = await requireSession(callbackUrl);
  if (!hasAnyRole(session, roles)) redirect("/dashboard/forbidden");
  return session;
}

export async function requireAdmin(callbackUrl: string) {
  return requireAnyRole(ADMIN_ROLES, callbackUrl);
}

export async function getSessionIfAllowed(roles: readonly RoleLike[]) {
  const session = await getServerAuthSession();
  if (!session || !hasAnyRole(session, roles)) return null;
  return session;
}

export async function requireApiAnyRole(roles: readonly RoleLike[]) {
  const session = await getServerAuthSession();
  if (!session) {
    return { ok: false as const, response: Response.json({ error: "Not authenticated" }, { status: 401 }) };
  }
  if (!hasAnyRole(session, roles)) {
    return { ok: false as const, response: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true as const, session };
}

export async function requireApiAdmin() {
  return requireApiAnyRole(ADMIN_ROLES);
}
