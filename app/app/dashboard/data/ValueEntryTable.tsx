"use client";

import { useMemo, useState } from "react";
import { Unit } from "@prisma/client";

import styles from "./page.module.css";

type FlatRow = {
    code: string;
    depth: number;
    label: string;
    unit: Unit;
    isInput: boolean;
    isSection: boolean;
    hasChildren: boolean;
    prettyValue: string;
};

function unitSuffix(unit: Unit) {
    switch (unit) {
        case Unit.EUR:
            return "EUR";
        case Unit.PERCENT:
            return "%";
        case Unit.COUNT:
            return "Anzahl";
        default:
            return "";
    }
}

function shouldDefaultCollapse(row: FlatRow) {
    return row.isSection && /^[A-Z]\./.test(row.label);
}

export function ValueEntryTable({ rows }: { rows: FlatRow[] }) {
    const defaultCollapsed = useMemo(() => {
        const s = new Set<string>();
        for (const r of rows) {
            if (r.hasChildren && shouldDefaultCollapse(r)) s.add(r.code);
        }
        return s;
    }, [rows]);

    const [collapsed, setCollapsed] = useState<Set<string>>(defaultCollapsed);

    const collapseAllTop = () => {
        const next = new Set<string>();
        for (const r of rows) {
            if (r.depth === 0 && r.hasChildren) next.add(r.code);
        }
        setCollapsed(next);
    };

    const expandAll = () => setCollapsed(new Set());

    const renderedRows = useMemo(() => {
        const out: FlatRow[] = [];
        const collapsedDepths: number[] = [];

        for (const r of rows) {
            while (collapsedDepths.length && collapsedDepths[collapsedDepths.length - 1] >= r.depth) {
                collapsedDepths.pop();
            }

            const hidden = collapsedDepths.length > 0;
            if (!hidden) out.push(r);

            if (!hidden && r.hasChildren && collapsed.has(r.code)) {
                collapsedDepths.push(r.depth);
            }
        }
        return out;
    }, [rows, collapsed]);

    return (
        <div className={styles.tableWrap}>
            <div className={styles.tableToolbar}>
                <button type="button" className={styles.secondarySmall} onClick={expandAll}>
                    Alles aufklappen
                </button>
                <button type="button" className={styles.secondarySmall} onClick={collapseAllTop}>
                    Sektionen einklappen
                </button>
            </div>

            <table className={styles.table}>
                <thead>
                    <tr>
                        <th className={`${styles.th} ${styles.thLabel}`}>Position</th>
                        <th className={`${styles.th} ${styles.thUnit}`}>Einheit</th>
                        <th className={`${styles.th} ${styles.thValue}`}>Wert</th>
                    </tr>
                </thead>
                <tbody>
                    {renderedRows.map((r) => {
                        const valueKey = `v:${r.code}`;
                        const rowClass = `${styles.row} ${r.isSection ? styles.groupRow : ""} ${!r.isInput ? styles.readonlyRow : ""}`;
                        const paddingLeft = 8 + r.depth * 18;
                        const isCollapsed = collapsed.has(r.code);
                        return (
                            <tr key={r.code} className={rowClass}>
                                <td className={styles.td}>
                                    <div className={styles.itemLabel} style={{ paddingLeft }}>
                                        {r.hasChildren ? (
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
                                                <span className={`${styles.caretIcon} ${isCollapsed ? styles.caretClosed : ""}`}>
                                                    ▾
                                                </span>
                                            </button>
                                        ) : (
                                            <span className={styles.caretSpacer} />
                                        )}
                                        {r.label}
                                    </div>
                                </td>
                                <td className={styles.td}>
                                    <span className={styles.unitPill}>{unitSuffix(r.unit)}</span>
                                </td>
                                <td className={styles.td}>
                                    {r.isInput ? (
                                        <input
                                            name={valueKey}
                                            className={styles.valueInput}
                                            defaultValue={r.prettyValue}
                                            placeholder={r.unit === Unit.PERCENT ? "z.B. 39" : ""}
                                            inputMode={r.unit === Unit.COUNT ? "numeric" : "decimal"}
                                        />
                                    ) : (
                                        <div className={styles.readonlyValue}>{r.prettyValue || "—"}</div>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
