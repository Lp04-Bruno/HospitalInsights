"use client";

import { useMemo, useState } from "react";
import { Unit } from "@/prisma/generated/enums";

import styles from "./page.module.css";
import { FormattedValueInput } from "./FormattedValueInput";

type FlatRow = {
  code: string;
  depth: number;
  label: string;
  unit: Unit;
  isInput: boolean;
  isSection: boolean;
  hasChildren: boolean;
  isCollapsible: boolean;
  prettyValue: string;
  suggestedPrettyValue?: string;
};

function unitSuffix(unit: Unit) {
  switch (unit) {
    case Unit.EUR:
      return "€";
    case Unit.PERCENT:
      return "%";
    case Unit.COUNT:
      return "";
    default:
      return "";
  }
}

function shouldDefaultCollapse(row: FlatRow) {
  const t = row.label.trim();
  const isRoman = /^(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)\./.test(t);
  return row.isSection && /^[A-Z]\./.test(t) && !isRoman;
}

export function ValueEntryTable({
  rows,
  errorByCode,
  dirtyByCode,
}: {
  rows: FlatRow[];
  errorByCode?: Record<string, string>;
  dirtyByCode?: Set<string>;
}) {
  const defaultCollapsed = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) {
      if (r.hasChildren && r.isCollapsible && shouldDefaultCollapse(r)) s.add(r.code);
    }
    return s;
  }, [rows]);

  const [collapsed, setCollapsed] = useState<Set<string>>(defaultCollapsed);
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  const collapseAll = () => {
    const next = new Set<string>();
    for (const r of rows) {
      if (r.hasChildren && r.isCollapsible) next.add(r.code);
    }
    setCollapsed(next);
  };

  const expandAll = () => setCollapsed(new Set());

  const rowsWithHidden = useMemo(() => {
    if (!normalizedQuery) {
      const out: Array<{ row: FlatRow; hidden: boolean }> = [];
      const collapsedDepths: number[] = [];

      for (const r of rows) {
        while (collapsedDepths.length && collapsedDepths[collapsedDepths.length - 1] >= r.depth) {
          collapsedDepths.pop();
        }

        const hidden = collapsedDepths.length > 0;
        out.push({ row: r, hidden });

        if (!hidden && r.hasChildren && r.isCollapsible && collapsed.has(r.code)) {
          collapsedDepths.push(r.depth);
        }
      }

      return out;
    }

    const include = new Set<string>();
    const stack: FlatRow[] = [];

    for (const r of rows) {
      while (stack.length && stack[stack.length - 1].depth >= r.depth) stack.pop();

      const hay = `${r.label} ${r.code}`.toLowerCase();
      const isMatch = hay.includes(normalizedQuery);

      if (isMatch) {
        include.add(r.code);
        for (const a of stack) include.add(a.code);
      }

      stack.push(r);
    }

    return rows.map((r) => ({ row: r, hidden: !include.has(r.code) }));
  }, [rows, collapsed, normalizedQuery]);

  const searchHitCount = useMemo(() => {
    if (!normalizedQuery) return 0;
    let count = 0;
    for (const r of rows) {
      const hay = `${r.label} ${r.code}`.toLowerCase();
      if (hay.includes(normalizedQuery)) count++;
    }
    return count;
  }, [rows, normalizedQuery]);

  return (
    <div className={styles.tableWrap}>
      <div className={styles.tableToolbar}>
        <div className={styles.tableToolbarLeft}>
          <div className={styles.searchWrap}>
            <input
              className={styles.searchInput}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Position suchen…"
              aria-label="Position suchen"
            />
            {query ? (
              <button type="button" className={styles.searchClear} onClick={() => setQuery("")} aria-label="Suche löschen">
                ×
              </button>
            ) : null}
          </div>
          {normalizedQuery ? <div className={styles.searchMeta}>{searchHitCount} Treffer</div> : null}
        </div>
        <div className={styles.tableToolbarActions}>
          <button type="button" className={styles.secondarySmall} onClick={expandAll}>
            Alles aufklappen
          </button>
          <button type="button" className={styles.secondarySmall} onClick={collapseAll}>
            Alles einklappen
          </button>
        </div>
      </div>

      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={`${styles.th} ${styles.thLabel}`}>Position</th>
              <th className={`${styles.th} ${styles.thValue}`}>Wert</th>
            </tr>
          </thead>
          <tbody>
            {rowsWithHidden.map(({ row: r, hidden }) => {
              const valueKey = `v:${r.code}`;
              const isDirty = !!dirtyByCode?.has(r.code);
              const rowClass = `${styles.row} ${r.isSection ? styles.groupRow : ""} ${!r.isInput ? styles.readonlyRow : ""} ${isDirty ? styles.dirtyRow : ""}`;
              const paddingLeft = 8 + r.depth * 18;
              const isCollapsed = collapsed.has(r.code);
              const fieldError = errorByCode?.[r.code];
              const suffix = unitSuffix(r.unit);
              return (
                <tr key={r.code} className={rowClass} style={hidden ? { display: "none" } : undefined}>
                  <td className={styles.td}>
                    <div className={styles.itemLabel} style={{ paddingLeft }}>
                      {r.hasChildren && r.isCollapsible ? (
                        <button
                          type="button"
                          className={styles.caret}
                          aria-label={isCollapsed ? "Aufklappen" : "Einklappen"}
                          onClick={() => {
                            setCollapsed((prev) => {
                              const next = new Set(prev);
                              if (next.has(r.code)) next.delete(r.code);
                              else next.add(r.code);
                              return next;
                            });
                          }}
                        >
                          <span className={`${styles.caretIcon} ${isCollapsed ? styles.caretClosed : ""}`}>▾</span>
                        </button>
                      ) : (
                        <span className={styles.caretSpacer} />
                      )}
                      {r.label}
                    </div>
                  </td>
                  <td className={styles.td}>
                    {r.isInput ? (
                      <div className={styles.valueCell}>
                        <div className={styles.valueInputWrap}>
                          <FormattedValueInput
                            name={valueKey}
                            className={`${styles.valueInput} ${fieldError ? styles.valueInputInvalid : ""}`}
                            defaultValue={r.prettyValue}
                            placeholder={r.prettyValue ? "" : (r.suggestedPrettyValue ?? (r.unit === Unit.PERCENT ? "z.B. 39" : ""))}
                            unit={r.unit}
                            invalid={!!fieldError}
                          />
                          {suffix ? <span className={styles.valueSuffix}>{suffix}</span> : null}
                        </div>
                        {fieldError ? <div className={styles.fieldError}>{fieldError}</div> : null}
                      </div>
                    ) : (
                      <div className={styles.readonlyValue}>{r.prettyValue ? `${r.prettyValue}${suffix ? ` ${suffix}` : ""}` : "—"}</div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
