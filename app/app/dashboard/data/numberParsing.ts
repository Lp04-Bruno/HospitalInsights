import { Unit } from "@/prisma/generated/enums";

export type ParseUserNumberResult = { kind: "empty" } | { kind: "invalid" } | { kind: "value"; value: number };

function normalizeNumberString(raw: string): string {
  let s = raw.trim();
  if (!s) return "";

  s = s.replace(/\s+/g, "");

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");

  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      // DE style: 1.234.567,89
      s = s.replace(/\./g, "");
      s = s.replace(/,/g, ".");
    } else {
      // EN style: 1,234,567.89
      s = s.replace(/,/g, "");
    }
    return s;
  }

  if (lastComma !== -1) {
    const commaCount = (s.match(/,/g) ?? []).length;
    if (commaCount > 1) {
      s = s.replace(/,/g, "");
    } else {
      s = s.replace(/,/g, ".");
    }
    return s;
  }

  if (lastDot !== -1) {
    const dotCount = (s.match(/\./g) ?? []).length;
    if (dotCount > 1) {
      // treat dots as thousands separators
      s = s.replace(/\./g, "");
    }
    return s;
  }

  return s;
}

export function parseUserNumberDetailed(raw: string, unit: Unit): ParseUserNumberResult {
  const trimmed = raw.trim();
  if (!trimmed) return { kind: "empty" };

  const noPercent = trimmed.replace(/%/g, "");
  const normalized = normalizeNumberString(noPercent);

  if (!normalized) return { kind: "empty" };

  if (!/^-?\d*(?:\.\d+)?$/.test(normalized)) return { kind: "invalid" };

  const n = Number(normalized);
  if (!Number.isFinite(n)) return { kind: "invalid" };

  if (unit === Unit.COUNT) return { kind: "value", value: Math.trunc(n) };
  return { kind: "value", value: n };
}
