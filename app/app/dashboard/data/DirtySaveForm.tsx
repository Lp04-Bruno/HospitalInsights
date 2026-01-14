"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { StatementType, Unit } from "@prisma/client";

import styles from "./page.module.css";
import { ValueEntryTable } from "./ValueEntryTable";

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

type DirtySaveFormProps = {
    action: (formData: FormData) => void | Promise<void>;
    hospitalId: string;
    periodId: string;
    statementType: StatementType;
    rows: FlatRow[];
};

function snapshotValues(form: HTMLFormElement | null) {
    const map = new Map<string, string>();
    if (!form) return map;

    const elements = Array.from(form.elements);
    for (const el of elements) {
        if (!(el instanceof HTMLInputElement)) continue;
        if (!el.name.startsWith("v:")) continue;
        map.set(el.name, el.value);
    }

    return map;
}

function DirtyBottomBar({ dirtyCount, onDiscard }: { dirtyCount: number; onDiscard: () => void }) {
    const { pending } = useFormStatus();

    if (dirtyCount === 0) return null;

    return (
        <div className={styles.bottomBar} role="status" aria-live="polite">
            <div className={styles.bottomBarInner}>
                <div className={styles.bottomBarLeft}>
                    <span className={styles.unsavedPill}>Ungespeicherte Änderungen</span>
                    <span className={styles.unsavedMeta}>
                        {dirtyCount} Feld{dirtyCount === 1 ? "" : "er"} geändert
                    </span>
                </div>
                <div className={styles.bottomBarButtons}>
                    <button type="button" className={styles.secondary} onClick={onDiscard} disabled={pending}>
                        Verwerfen
                    </button>
                    <button className={styles.button} type="submit" disabled={pending}>
                        {pending ? "Speichert…" : "Speichern"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export function DirtySaveForm({ action, hospitalId, periodId, statementType, rows }: DirtySaveFormProps) {
    const formRef = useRef<HTMLFormElement>(null);
    const baselineRef = useRef<Map<string, string>>(new Map());
    const dirtyFieldsRef = useRef<Set<string>>(new Set());
    const dirtyCountRef = useRef(0);

    const [dirtyCount, setDirtyCount] = useState(0);

    const setDirtyCountIfChanged = (next: number) => {
        if (dirtyCountRef.current === next) return;
        dirtyCountRef.current = next;
        setDirtyCount(next);
    };

    const clearDirty = useCallback(() => {
        dirtyFieldsRef.current.clear();
        setDirtyCountIfChanged(0);
    }, []);

    const recomputeBaseline = useCallback(() => {
        baselineRef.current = snapshotValues(formRef.current);
        clearDirty();
    }, [clearDirty]);

    useEffect(() => {
        const raf = requestAnimationFrame(() => {
            recomputeBaseline();
        });
        return () => cancelAnimationFrame(raf);
    }, [hospitalId, periodId, statementType, rows, recomputeBaseline]);

    const onInput = useCallback((e: React.FormEvent<HTMLFormElement>) => {
        const target = e.target;
        if (!(target instanceof HTMLInputElement)) return;
        if (!target.name.startsWith("v:")) return;

        const baseline = baselineRef.current.get(target.name) ?? "";
        const isDirty = target.value !== baseline;

        if (isDirty) dirtyFieldsRef.current.add(target.name);
        else dirtyFieldsRef.current.delete(target.name);

        setDirtyCountIfChanged(dirtyFieldsRef.current.size);
    }, []);

    const discard = useCallback(() => {
        const form = formRef.current;
        if (!form) return;
        form.reset();
        clearDirty();
    }, [clearDirty]);

    return (
        <form ref={formRef} action={action} onInput={onInput} onChange={onInput}>
            <input type="hidden" name="hospitalId" value={hospitalId} />
            <input type="hidden" name="periodId" value={periodId} />
            <input type="hidden" name="statementType" value={statementType} />

            <ValueEntryTable rows={rows} />

            <div className={styles.saveRow}>
                <button className={styles.button} type="submit">
                    Speichern
                </button>
                <div className={styles.saveHint}>
                    Zahlen wie <code>129.658.900,5</code>, <code>129658900.5</code> oder <code>39%</code>.
                </div>
            </div>

            <DirtyBottomBar dirtyCount={dirtyCount} onDiscard={discard} />
        </form>
    );
}
