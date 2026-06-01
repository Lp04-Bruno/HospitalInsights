import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/lib/auth";
import { getDashboardRouteRoles } from "@/lib/dashboardRoutes";
import { ADMIN_ROLES, EDITOR_ROLES, hasAnyRoleValue, type AppRole } from "@/lib/roles";

export { ADMIN_ROLES, EDITOR_ROLES };

export function hasAnyRole(session: { user?: { role?: string } } | null | undefined, roles: readonly AppRole[]) {
  return hasAnyRoleValue(session?.user?.role, roles);
}

export async function requireSession(callbackUrl: string) {
  const session = await getServerAuthSession();
  if (!session) redirect(`/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  return session;
}

export async function requireAnyRole(roles: readonly AppRole[], callbackUrl: string) {
  const session = await requireSession(callbackUrl);
  if (!hasAnyRole(session, roles)) redirect("/dashboard/forbidden");
  return session;
}

export async function requireAdmin(callbackUrl: string) {
  return requireAnyRole(ADMIN_ROLES, callbackUrl);
}

export async function requireDashboardRouteAccess(pathname: string) {
  const roles = getDashboardRouteRoles(pathname);
  return roles ? requireAnyRole(roles, pathname) : requireSession(pathname);
}

export async function getSessionIfAllowed(roles: readonly AppRole[]) {
  const session = await getServerAuthSession();
  if (!session || !hasAnyRole(session, roles)) return null;
  return session;
}

export async function requireApiAnyRole(roles: readonly AppRole[]) {
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
