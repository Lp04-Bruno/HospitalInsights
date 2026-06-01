import { ROLE, type AppRole } from "@/lib/roles";

export type DashboardRoute = {
  href: `/dashboard${string}`;
  label: string;
  roles: readonly AppRole[];
  exact?: boolean;
};

export const DASHBOARD_ROUTES = [
  { href: "/dashboard", label: "Übersicht", roles: [ROLE.ADMIN, ROLE.EDITOR, ROLE.VIEWER], exact: true },
  { href: "/dashboard/data", label: "Datenverwaltung", roles: [ROLE.ADMIN, ROLE.EDITOR] },
  { href: "/dashboard/audit", label: "Audit Log", roles: [ROLE.ADMIN, ROLE.EDITOR] },
  { href: "/dashboard/audit/manage", label: "Audit Log – Management", roles: [ROLE.ADMIN] },
  { href: "/dashboard/hospitals", label: "Hospitalverwaltung", roles: [ROLE.ADMIN, ROLE.EDITOR] },
  { href: "/dashboard/users", label: "Benutzerverwaltung", roles: [ROLE.ADMIN] },
  { href: "/dashboard/backups", label: "Backups", roles: [ROLE.ADMIN] },
] as const satisfies readonly DashboardRoute[];

export function isDashboardRouteActive(route: Pick<DashboardRoute, "href" | "exact">, pathname: string) {
  if (route.exact) return pathname === route.href;
  return pathname === route.href || pathname.startsWith(`${route.href}/`);
}

export function getDashboardRoutesForRole(role: AppRole) {
  return DASHBOARD_ROUTES.filter((route) => (route.roles as readonly AppRole[]).includes(role));
}

export function getDashboardRouteForPath(pathname: string) {
  return [...DASHBOARD_ROUTES].sort((a, b) => b.href.length - a.href.length).find((route) => isDashboardRouteActive(route, pathname));
}

export function getDashboardRouteRoles(pathname: string) {
  return getDashboardRouteForPath(pathname)?.roles;
}
