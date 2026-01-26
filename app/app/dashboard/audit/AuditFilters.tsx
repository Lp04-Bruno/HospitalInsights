"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import styles from "./page.module.css";

type Option = { value: string; label: string };

type AuditFiltersProps = {
  hospitals: Option[];
  users: Option[];
  years: number[];
  statementOptions: Option[];
  kindOptions: Option[];

  initial: {
    hospitalId: string;
    userId: string;
    from: string;
    to: string;
    q: string;
    year: string;
    statementType: string;
    kind: string;
    realOnly: boolean;
    mine: boolean;
  };
};

function buildQueryFromState(state: AuditFiltersProps["initial"]) {
  const qs = new URLSearchParams();

  if (state.hospitalId) qs.set("hospitalId", state.hospitalId);
  if (state.year) qs.set("year", state.year);
  if (state.statementType) qs.set("statementType", state.statementType);
  if (state.kind) qs.set("kind", state.kind);
  if (state.userId) qs.set("userId", state.userId);
  if (state.from) qs.set("from", state.from);
  if (state.to) qs.set("to", state.to);
  if (state.q.trim()) qs.set("q", state.q.trim());

  if (!state.realOnly) qs.set("realOnly", "0");

  if (state.mine) qs.set("mine", "1");

  return qs;
}

function readParam(sp: URLSearchParams, key: string) {
  return sp.get(key) ?? "";
}

function readBool(sp: URLSearchParams, key: string, opts?: { defaultTrue?: boolean }) {
  const v = sp.get(key);
  if (v === null) return opts?.defaultTrue ?? false;
  if (v === "1" || v.toLowerCase() === "true") return true;
  if (v === "0" || v.toLowerCase() === "false") return false;
  return opts?.defaultTrue ?? false;
}

export default function AuditFilters(props: AuditFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [state, setState] = useState(props.initial);

  useEffect(() => {
    if (!sp) return;

    const next: AuditFiltersProps["initial"] = {
      hospitalId: readParam(sp, "hospitalId"),
      userId: readParam(sp, "userId"),
      from: readParam(sp, "from"),
      to: readParam(sp, "to"),
      q: readParam(sp, "q"),
      year: readParam(sp, "year"),
      statementType: readParam(sp, "statementType"),
      kind: readParam(sp, "kind"),
      realOnly: readBool(sp, "realOnly", { defaultTrue: true }),
      mine: readBool(sp, "mine"),
    };

    const same = Object.entries(next).every(([k, v]) => (state as Record<string, unknown>)[k] === v);
    if (!same) setState(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp?.toString()]);

  const desiredQuery = useMemo(() => buildQueryFromState(state).toString(), [state]);

  const debounceRef = useRef<number | null>(null);
  const initialMount = useRef(true);

  useEffect(() => {
    if (!sp) return;

    if (initialMount.current) {
      initialMount.current = false;
      return;
    }

    const current = new URLSearchParams(sp.toString());
    current.delete("page");
    const currentStr = current.toString();

    if (currentStr === desiredQuery) return;

    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      const href = desiredQuery ? `${pathname}?${desiredQuery}` : pathname;
      router.replace(href);
    }, 300);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [desiredQuery, pathname, router, sp]);

  return (
    <form
      className={styles.filters}
      onSubmit={(e) => {
        e.preventDefault();
      }}
    >
      <div className={styles.field}>
        <label>Hospital</label>
        <select
          name="hospitalId"
          value={state.hospitalId}
          onChange={(e) => setState((s) => ({ ...s, hospitalId: e.target.value }))}
        >
          <option value="">Alle</option>
          {props.hospitals.map((h) => (
            <option key={h.value} value={h.value}>
              {h.label}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label>Benutzer</label>
        <select
          name="userId"
          value={state.userId}
          disabled={state.mine}
          onChange={(e) => setState((s) => ({ ...s, userId: e.target.value }))}
        >
          <option value="">Alle</option>
          {props.users.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label>Zeitraum von</label>
        <input
          type="date"
          name="from"
          value={state.from}
          onChange={(e) => setState((s) => ({ ...s, from: e.target.value }))}
        />
      </div>

      <div className={styles.field}>
        <label>Zeitraum bis</label>
        <input
          type="date"
          name="to"
          value={state.to}
          onChange={(e) => setState((s) => ({ ...s, to: e.target.value }))}
        />
      </div>

      <div className={styles.field}>
        <label>LineItem (Code/Label)</label>
        <input
          name="q"
          placeholder="z.B. 1.1 oder Erlöse"
          value={state.q}
          onChange={(e) => setState((s) => ({ ...s, q: e.target.value }))}
        />
      </div>

      <div className={styles.field}>
        <label>Anzeige</label>
        <div className={styles.checkRow}>
          <label className={styles.checkLabel}>
            <input
              type="checkbox"
              checked={state.realOnly}
              onChange={(e) => setState((s) => ({ ...s, realOnly: e.target.checked }))}
            />
            Nur echte Änderungen
          </label>
        </div>
        <div className={styles.checkRow}>
          <label className={styles.checkLabel}>
            <input
              type="checkbox"
              checked={state.mine}
              onChange={(e) => setState((s) => ({ ...s, mine: e.target.checked }))}
            />
            Nur meine
          </label>
        </div>
      </div>

      <div className={styles.field}>
        <label>Jahr</label>
        <select
          name="year"
          value={state.year}
          onChange={(e) => setState((s) => ({ ...s, year: e.target.value }))}
        >
          <option value="">Alle</option>
          {props.years.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label>Statement</label>
        <select
          name="statementType"
          value={state.statementType}
          onChange={(e) => setState((s) => ({ ...s, statementType: e.target.value }))}
        >
          <option value="">Alle</option>
          {props.statementOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label>Aktion</label>
        <select
          name="kind"
          value={state.kind}
          onChange={(e) => setState((s) => ({ ...s, kind: e.target.value }))}
        >
          <option value="">Alle</option>
          {props.kindOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.actions}>
        <Link className={styles.secondary} href="/dashboard/audit">
          Reset
        </Link>
      </div>
    </form>
  );
}
