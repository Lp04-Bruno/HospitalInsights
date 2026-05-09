"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Unit, type StatementType } from "@/prisma/generated/enums";

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
  isCollapsible: boolean;
  prettyValue: string;
  suggestedPrettyValue?: string;
};

type DirtySaveFormProps = {
  saveAction: (prevState: SaveFactsState, formData: FormData) => Promise<SaveFactsState>;
  hospitalId: string;
  periodId: string;
  statementType: StatementType;
  rows: FlatRow[];
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

function canonicalizeNumber(raw: string, unit: Unit): { kind: "empty" } | { kind: "invalid" } | { kind: "value"; value: number } {
  const parsed = parseUserNumberDetailed(raw, unit);
  if (parsed.kind !== "value") return parsed;
  const rounded = Math.round(parsed.value * 100) / 100;
  return { kind: "value", value: rounded };
}

function canonicalEquals(a: ReturnType<typeof canonicalizeNumber>, b: ReturnType<typeof canonicalizeNumber>): boolean {
  if (a.kind !== b.kind) return false;

  switch (a.kind) {
    case "empty":
      return true;
    case "invalid":
      return false;
    case "value": {
      const bv = b as Extract<ReturnType<typeof canonicalizeNumber>, { kind: "value" }>;
      return a.value === bv.value;
    }
  }

  return false;
}

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

export function DirtySaveForm({ saveAction, hospitalId, periodId, statementType, rows }: DirtySaveFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const baselineRef = useRef<Map<string, string>>(new Map());
  const dirtyFieldsRef = useRef<Set<string>>(new Set());
  const dirtyCountRef = useRef(0);

  const [dirtyCount, setDirtyCount] = useState(0);
  const [dirtyCodes, setDirtyCodes] = useState<Set<string>>(new Set());
  const [clientFieldErrors, setClientFieldErrors] = useState<Record<string, string>>({});
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({});
  const [serverState, setServerState] = useState<SaveFactsState>(INITIAL_STATE);
  const [navBlockMessage, setNavBlockMessage] = useState<string | null>(null);

  const [pending, startTransition] = useTransition();

  const setDirtyCountIfChanged = (next: number) => {
    if (dirtyCountRef.current === next) return;
    dirtyCountRef.current = next;
    setDirtyCount(next);
  };

  const clearDirty = useCallback(() => {
    dirtyFieldsRef.current.clear();
    setDirtyCodes(new Set());
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

  const isNavigationBlocked = dirtyCount > 0 || invalidCount > 0 || pending;

  useEffect(() => {
    if (!isNavigationBlocked) return;

    const message =
      invalidCount > 0
        ? "Bitte korrigiere die markierten Felder und speichere (oder verwerfe), bevor du die Seite wechselst."
        : "Du hast ungespeicherte Änderungen. Bitte speichere oder verwerfe, bevor du die Seite wechselst.";

    const onDocumentClickCapture = (e: MouseEvent) => {
      if (!isNavigationBlocked) return;
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      const anchor = target?.closest?.("a") as HTMLAnchorElement | null;
      if (!anchor) return;

      const hrefAttr = anchor.getAttribute("href");
      if (!hrefAttr) return;
      if (hrefAttr.startsWith("#")) return;
      if (hrefAttr.startsWith("javascript:")) return;

      e.preventDefault();
      e.stopPropagation();
      setNavBlockMessage(message);
    };

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    document.addEventListener("click", onDocumentClickCapture, true);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      document.removeEventListener("click", onDocumentClickCapture, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [invalidCount, isNavigationBlocked, pending, dirtyCount]);

  useEffect(() => {
    if (!navBlockMessage) return;
    const t = window.setTimeout(() => setNavBlockMessage(null), 3500);
    return () => window.clearTimeout(t);
  }, [navBlockMessage]);

  const applyResult = useCallback(
    (res: SaveFactsState) => {
      setServerState(res);

      if (res.ok) {
        setServerFieldErrors({});

        baselineRef.current = snapshotValues(formRef.current);
        clearDirty();

        router.refresh();
      } else {
        setServerFieldErrors(res.fieldErrors ?? {});
      }
    },
    [clearDirty, router]
  );

  const onInput = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
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
      const isDirty =
        row?.isInput && row.unit
          ? !canonicalEquals(canonicalizeNumber(target.value, row.unit), canonicalizeNumber(baseline, row.unit))
          : target.value !== baseline;

      if (isDirty) dirtyFieldsRef.current.add(target.name);
      else dirtyFieldsRef.current.delete(target.name);

      setDirtyCountIfChanged(dirtyFieldsRef.current.size);

      setDirtyCodes(
        new Set(
          Array.from(dirtyFieldsRef.current)
            .filter((n) => n.startsWith("v:"))
            .map((n) => n.slice(2))
        )
      );
    },
    [rowByCode]
  );

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

  return (
    <form ref={formRef} onSubmit={onSubmit} onInput={onInput} onChange={onInput}>
      <input type="hidden" name="hospitalId" value={hospitalId} />
      <input type="hidden" name="periodId" value={periodId} />
      <input type="hidden" name="statementType" value={statementType} />

      {serverState.ok && serverState.message ? <div className={`${styles.toast} ${styles.toastSuccess}`}>{serverState.message}</div> : null}

      {navBlockMessage ? <div className={`${styles.toast} ${styles.toastError}`}>{navBlockMessage}</div> : null}

      {!serverState.ok && serverState.globalError ? (
        <div className={`${styles.toast} ${styles.toastError}`}>{serverState.globalError}</div>
      ) : null}

      <ValueEntryTable rows={rows} errorByCode={mergedErrors} dirtyByCode={dirtyCodes} />

      <DirtyBottomBar dirtyCount={dirtyCount} invalidCount={invalidCount} onDiscard={discard} pending={pending} />
    </form>
  );
}
