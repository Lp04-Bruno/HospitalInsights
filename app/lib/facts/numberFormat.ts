import { Unit } from "@/prisma/generated/enums";

export function formatNumberDE(value: number, unit: Unit, opts: { useGrouping?: boolean } = {}): string {
  const maximumFractionDigits = unit === Unit.PERCENT ? 2 : 0;
  return new Intl.NumberFormat("de-DE", {
    useGrouping: opts.useGrouping ?? true,
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(value);
}

export function displayValue(raw: string | undefined, unit: Unit): string {
  if (!raw) return "";
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  return formatNumberDE(n, unit);
}
