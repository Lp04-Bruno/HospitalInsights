import { z } from "zod";

import { Role, StatementType } from "@/prisma/generated/enums";

const roleValues = Object.values(Role) as [Role, ...Role[]];
const statementTypeValues = Object.values(StatementType) as [StatementType, ...StatementType[]];

export const roleSchema = z.enum(roleValues);
export const statementTypeSchema = z.enum(statementTypeValues);

const numericInputSchema = z
  .union([z.number(), z.string().trim().min(1)])
  .transform(Number)
  .refine(Number.isFinite);

export const yearSchema = numericInputSchema.refine(
  (value) => Number.isInteger(value) && value >= 1900 && value <= 2100,
  "Expected a year between 1900 and 2100"
);

export const positiveIntSchema = numericInputSchema.refine((value) => Number.isInteger(value) && value >= 1, "Expected a positive integer");

export const searchNumberSchema = numericInputSchema;

const envBooleanSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.enum(["1", "true", "0", "false"]))
  .transform((value) => value === "1" || value === "true");

export function parseBooleanString(raw: string | undefined, fallback: boolean) {
  if (raw === undefined) return fallback;
  const parsed = envBooleanSchema.safeParse(raw);
  return parsed.success ? parsed.data : fallback;
}

export function parseEnvBoolean(raw: string | undefined, fallback: boolean) {
  return parseBooleanString(raw, fallback);
}

export function parseStatementType(raw: unknown): StatementType | undefined {
  const parsed = statementTypeSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

export function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function firstSearchParam(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
}

export async function resolveSearchParams(
  searchParams: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined> | undefined
): Promise<Record<string, string | string[] | undefined>> {
  if (!searchParams) return {};
  const maybePromise = searchParams as unknown as { then?: unknown };
  if (typeof maybePromise.then === "function") {
    return (await (searchParams as Promise<Record<string, string | string[] | undefined>>)) ?? {};
  }
  return searchParams as Record<string, string | string[] | undefined>;
}
