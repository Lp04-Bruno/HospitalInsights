"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Unit, type StatementType } from "@prisma/client";

import styles from "./page.module.css";
import { ValueEntryTable } from "./ValueEntryTable";
import { parseUserNumberDetailed } from "./numberParsing";

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
    saveAction: (prevState: SaveFactsState, formData: FormData) => Promise<SaveFactsState>;
    undoAction?: (prevState: SaveFactsState, formData: FormData) => Promise<SaveFactsState>;
    hospitalId: string;
    periodId: string;
    statementType: StatementType;
    rows: FlatRow[];
    initialLastSavedAt?: string;
};

export type SaveFactsState = {
    ok: boolean;
    message?: string;
    globalError?: string;
    savedAt?: string;
    savedBy?: string;
    changesApplied?: number;
    fieldErrors?: Record<string, string>;
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

function DirtyBottomBar({
    dirtyCount,
    invalidCount,
    onDiscard,
    pending,
}: {
    dirtyCount: number;
    invalidCount: number;
    onDiscard: () => void;
    pending: boolean;
}) {
    if (dirtyCount === 0 && invalidCount === 0) return null;

    return (
        <div className={styles.bottomBar} role="status" aria-live="polite">
            <div className={styles.bottomBarInner}>
                <div className={styles.bottomBarLeft}>
                    {invalidCount > 0 ? (
                        <>
                            <span className={styles.errorPill}>Bitte korrigieren</span>
                            <span className={styles.unsavedMeta}>
                                {invalidCount} Feld{invalidCount === 1 ? "" : "er"} ungültig
                            </span>
                        </>
                    ) : (
                        <>
                            <span className={styles.unsavedPill}>Ungespeicherte Änderungen</span>
                            <span className={styles.unsavedMeta}>
                                {dirtyCount} Feld{dirtyCount === 1 ? "" : "er"} geändert
                            </span>
                        </>
                    )}
                </div>
                <div className={styles.bottomBarButtons}>
                    <button type="button" className={styles.secondary} onClick={onDiscard} disabled={pending}>
                        Verwerfen
                    </button>
                    <button className={styles.button} type="submit" disabled={pending || invalidCount > 0}>
                        {pending ? "Speichert…" : "Speichern"}
                    </button>
                </div>
            </div>
        </div>
    );
}

const INITIAL_STATE: SaveFactsState = { ok: true };

function formatTimestampBerlin(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;

    try {
        return new Intl.DateTimeFormat("de-DE", {
            timeZone: "Europe/Berlin",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        }).format(d);
    } catch {
        return d.toISOString().slice(0, 16).replace("T", " ");
    }
}

export function DirtySaveForm({
    saveAction,
    undoAction,
    hospitalId,
    periodId,
    statementType,
    rows,
    initialLastSavedAt,
}: DirtySaveFormProps) {
    const formRef = useRef<HTMLFormElement>(null);
    const baselineRef = useRef<Map<string, string>>(new Map());
    const dirtyFieldsRef = useRef<Set<string>>(new Set());
    const dirtyCountRef = useRef(0);

    const [dirtyCount, setDirtyCount] = useState(0);
    const [clientFieldErrors, setClientFieldErrors] = useState<Record<string, string>>({});
    const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({});
    const [serverState, setServerState] = useState<SaveFactsState>(INITIAL_STATE);
    const [lastSavedAt, setLastSavedAt] = useState<string | undefined>(initialLastSavedAt);

    const [pending, startTransition] = useTransition();

    const setDirtyCountIfChanged = (next: number) => {
        if (dirtyCountRef.current === next) return;
        dirtyCountRef.current = next;
        setDirtyCount(next);
    };

    const clearDirty = useCallback(() => {
        dirtyFieldsRef.current.clear();
        setDirtyCountIfChanged(0);
    }, []);

    const rowByCode = useMemo(() => {
        const m = new Map<string, FlatRow>();
        for (const r of rows) m.set(r.code, r);
        return m;
    }, [rows]);

    const initialBaseline = useMemo(() => {
        const m = new Map<string, string>();
        for (const r of rows) {
            if (!r.isInput) continue;
            m.set(`v:${r.code}`, r.prettyValue ?? "");
        }
        return m;
    }, [rows]);

    useEffect(() => {
        baselineRef.current = new Map(initialBaseline);
    }, [initialBaseline]);

    const mergedErrors = useMemo(() => {
        return { ...serverFieldErrors, ...clientFieldErrors };
    }, [serverFieldErrors, clientFieldErrors]);

    const invalidCount = useMemo(() => Object.keys(mergedErrors).length, [mergedErrors]);

    const applyResult = useCallback(
        (res: SaveFactsState) => {
            setServerState(res);

            if (res.ok) {
                setServerFieldErrors({});
                if (res.savedAt) setLastSavedAt(res.savedAt);

                baselineRef.current = snapshotValues(formRef.current);
                clearDirty();
            } else {
                setServerFieldErrors(res.fieldErrors ?? {});
            }
        },
        [clearDirty]
    );

    const onInput = useCallback((e: React.FormEvent<HTMLFormElement>) => {
        const target = e.target;
        if (!(target instanceof HTMLInputElement)) return;
        if (!target.name.startsWith("v:")) return;

        const code = target.name.slice(2);

        const row = rowByCode.get(code);
        if (row?.isInput) {
            const parsed = parseUserNumberDetailed(target.value, row.unit);
            setClientFieldErrors((prev) => {
                const next = { ...prev };
                if (parsed.kind === "invalid") {
                    next[code] = row.unit === Unit.PERCENT ? "Ungültige Prozentzahl." : "Ungültige Zahl.";
                } else {
                    delete next[code];
                }
                return next;
            });

            setServerFieldErrors((prev) => {
                if (!prev[code]) return prev;
                const next = { ...prev };
                delete next[code];
                return next;
            });
        }

        const baseline = baselineRef.current.get(target.name) ?? "";
        const isDirty = target.value !== baseline;

        if (isDirty) dirtyFieldsRef.current.add(target.name);
        else dirtyFieldsRef.current.delete(target.name);

        setDirtyCountIfChanged(dirtyFieldsRef.current.size);
    }, [rowByCode]);

    const discard = useCallback(() => {
        const form = formRef.current;
        if (!form) return;
        form.reset();
        setClientFieldErrors({});
        setServerFieldErrors({});
        setServerState(INITIAL_STATE);
        clearDirty();
    }, [clearDirty]);

    const onSubmit = useCallback(
        (e: React.FormEvent<HTMLFormElement>) => {
            e.preventDefault();

            if (invalidCount > 0) {
                applyResult({ ok: false, globalError: "Bitte korrigiere die markierten Felder." });
                return;
            }

            const form = formRef.current;
            if (!form) return;
            const fd = new FormData(form);

            startTransition(async () => {
                const res = await saveAction(INITIAL_STATE, fd);
                applyResult(res);
            });
        },
        [invalidCount, saveAction, applyResult, startTransition]
    );

    const onUndo = useCallback(() => {
        if (!undoAction) return;
        const form = formRef.current;
        if (!form) return;
        const fd = new FormData(form);

        startTransition(async () => {
            const res = await undoAction(INITIAL_STATE, fd);
            applyResult(res);
        });
    }, [undoAction, applyResult, startTransition]);

    const humanLastSaved = useMemo(() => {
        if (!lastSavedAt) return "—";
        return formatTimestampBerlin(lastSavedAt);
    }, [lastSavedAt]);

    return (
        <form ref={formRef} onSubmit={onSubmit} onInput={onInput} onChange={onInput}>
            <input type="hidden" name="hospitalId" value={hospitalId} />
            <input type="hidden" name="periodId" value={periodId} />
            <input type="hidden" name="statementType" value={statementType} />

            {serverState.ok && serverState.message ? (
                <div className={`${styles.toast} ${styles.toastSuccess}`}>{serverState.message}</div>
            ) : null}

            {!serverState.ok && serverState.globalError ? (
                <div className={`${styles.toast} ${styles.toastError}`}>{serverState.globalError}</div>
            ) : null}

            <div className={styles.lastSavedRow}>
                <div className={styles.lastSavedLabel}>Zuletzt gespeichert</div>
                <div className={styles.lastSavedValue}>
                    {humanLastSaved}
                </div>

                {undoAction ? (
                    <button
                        type="button"
                        className={styles.secondarySmall}
                        disabled={pending}
                        onClick={onUndo}
                    >
                        Undo letzter Save
                    </button>
                ) : null}
            </div>

            <ValueEntryTable rows={rows} errorByCode={mergedErrors} />

            <div className={styles.saveHint}>
                Zahlen wie <code>129.658.900,5</code>, <code>129658900.5</code> oder <code>39%</code>.
            </div>

            <DirtyBottomBar dirtyCount={dirtyCount} invalidCount={invalidCount} onDiscard={discard} pending={pending} />
        </form>
    );
}
