export const ROLE = {
  ADMIN: "ADMIN",
  EDITOR: "EDITOR",
  VIEWER: "VIEWER",
} as const;

export type AppRole = (typeof ROLE)[keyof typeof ROLE];

export const ADMIN_ROLES = [ROLE.ADMIN] as const;
export const EDITOR_ROLES = [ROLE.ADMIN, ROLE.EDITOR] as const;

export function hasAnyRoleValue(role: string | null | undefined, roles: readonly AppRole[]) {
  return roles.some((allowed) => allowed === role);
}
