import { Unit } from "@/prisma/generated/enums";
import type { CatalogFormulaByCode } from "@/lib/statementCatalog";
import { displayValue, formatNumberDE } from "@/lib/facts/numberFormat";
import type { FlatRow, StatementLineItem } from "@/lib/facts/types";

const DEFAULT_ALWAYS_EXPANDED = new Set<string>([
  "UKV__VVK",
  "UKV__MAT",
  "UKV__PER",
  "UKV__STEUERN",
  "GKV__MAT",
  "GKV__PER",
  "GKV__STEUERN",
]);

export function buildStatementRows({
  lineItems,
  factMap,
  formulasByCode,
  alwaysExpanded = DEFAULT_ALWAYS_EXPANDED,
}: {
  lineItems: StatementLineItem[];
  factMap: Map<string, string>;
  formulasByCode: CatalogFormulaByCode;
  alwaysExpanded?: ReadonlySet<string>;
}): FlatRow[] {
  const byCode = new Map(lineItems.map((li) => [li.code, li] as const));
  const childrenByCode = new Map<string, string[]>();

  for (const li of lineItems) {
    if (!li.parentCode) continue;
    const arr = childrenByCode.get(li.parentCode) ?? [];
    arr.push(li.code);
    childrenByCode.set(li.parentCode, arr);
  }

  const depthMemo = new Map<string, number>();
  const computeDepth = (code: string, visiting = new Set<string>()): number => {
    const cached = depthMemo.get(code);
    if (cached !== undefined) return cached;

    if (visiting.has(code)) {
      depthMemo.set(code, 0);
      return 0;
    }

    const li = byCode.get(code);
    if (!li?.parentCode) {
      depthMemo.set(code, 0);
      return 0;
    }

    visiting.add(code);
    const out = computeDepth(li.parentCode, visiting) + 1;
    visiting.delete(code);
    depthMemo.set(code, out);
    return out;
  };

  const overrideNumericByCode = new Map<string, number>();
  for (const li of lineItems) {
    const raw = factMap.get(li.code);
    if (!raw) continue;
    const n = Number(raw);
    if (!Number.isFinite(n)) continue;
    overrideNumericByCode.set(li.code, n);
  }

  const hasChildrenByCode = new Map<string, boolean>();
  const childrenAllDavonByCode = new Map<string, boolean>();
  const isEditableByCode = new Map<string, boolean>();

  for (const li of lineItems) {
    const hasChildren = (childrenByCode.get(li.code)?.length ?? 0) > 0;
    const hasFormula = (formulasByCode.get(li.code)?.length ?? 0) > 0;

    const children = childrenByCode.get(li.code) ?? [];
    const eurChildren = children
      .map((childCode) => byCode.get(childCode))
      .filter((c): c is NonNullable<typeof c> => !!c)
      .filter((c) => c.unit === Unit.EUR);
    const childrenAllDavon =
      eurChildren.length > 0 &&
      eurChildren.every((child) => {
        const label = child.label?.trim() ?? "";
        return /^davon\b/i.test(label);
      });

    hasChildrenByCode.set(li.code, hasChildren);
    childrenAllDavonByCode.set(li.code, childrenAllDavon);
    isEditableByCode.set(li.code, li.isInput && (!hasChildren || childrenAllDavon) && (!hasFormula || childrenAllDavon));
  }

  const computedCache = new Map<string, number | null>();
  const computeValue = (code: string, visiting = new Set<string>()): number | null => {
    if (computedCache.has(code)) return computedCache.get(code) ?? null;

    if (isEditableByCode.get(code)) {
      const override = overrideNumericByCode.get(code);
      if (override !== undefined) {
        computedCache.set(code, override);
        return override;
      }
    }

    if (visiting.has(code)) {
      computedCache.set(code, null);
      return null;
    }

    visiting.add(code);

    const li = byCode.get(code);
    if (!li) {
      visiting.delete(code);
      computedCache.set(code, null);
      return null;
    }

    const formula = formulasByCode.get(code);
    if (formula?.length) {
      let sum = 0;
      let hasAny = false;
      for (const ref of formula) {
        const v = computeValue(ref.code, visiting);
        if (v === null) continue;
        sum += v * ref.weight;
        hasAny = true;
      }

      const out = hasAny ? sum : null;
      visiting.delete(code);
      computedCache.set(code, out);
      return out;
    }

    if (li.unit !== Unit.EUR) {
      visiting.delete(code);
      computedCache.set(code, null);
      return null;
    }

    const children = childrenByCode.get(code) ?? [];
    if (children.length === 0) {
      visiting.delete(code);
      computedCache.set(code, null);
      return null;
    }

    if (childrenAllDavonByCode.get(code)) {
      visiting.delete(code);
      computedCache.set(code, null);
      return null;
    }

    let sum = 0;
    let hasAny = false;
    for (const childCode of children) {
      const child = byCode.get(childCode);
      if (!child || child.unit !== Unit.EUR) continue;
      const v = computeValue(childCode, visiting);
      if (v === null) continue;
      sum += v;
      hasAny = true;
    }

    const out = hasAny ? sum : null;
    visiting.delete(code);
    computedCache.set(code, out);
    return out;
  };

  return lineItems.map((li) => {
    const depth = computeDepth(li.code);
    const hasChildren = hasChildrenByCode.get(li.code) ?? false;
    const isEditable = isEditableByCode.get(li.code) ?? false;
    const overrideRaw = isEditable ? factMap.get(li.code) : undefined;
    const computed = computeValue(li.code);
    const prettyValue = isEditable ? displayValue(overrideRaw, li.unit) : computed === null ? "" : formatNumberDE(computed, li.unit);

    const suggestedPrettyValue =
      isEditable && !overrideRaw && li.unit === Unit.EUR ? (computed === null ? undefined : formatNumberDE(computed, li.unit)) : undefined;

    return {
      code: li.code,
      depth,
      label: li.label,
      unit: li.unit,
      isInput: isEditable,
      isSection: hasChildren && depth <= 1,
      hasChildren,
      isCollapsible: hasChildren && !alwaysExpanded.has(li.code),
      prettyValue,
      suggestedPrettyValue,
    };
  });
}
