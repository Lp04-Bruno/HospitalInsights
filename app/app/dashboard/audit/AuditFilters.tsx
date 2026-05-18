"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import styles from "./page.module.css";

type Option = { value: string; label: string };

type AuditFiltersProps = {
  hospitals: Option[];
  users: Option[];
  years: number[];
  statementOptions: Option[];

  initial: {
    hospitalId: string;
    userId: string;
    from: string;
    to: string;
    q: string;
    year: string;
    statementType: string;
    realOnly: boolean;
    mine: boolean;
  };
};

function buildQueryFromState(state: AuditFiltersProps["initial"]) {
  const qs = new URLSearchParams();

  if (state.hospitalId) qs.set("hospitalId", state.hospitalId);
  if (state.year) qs.set("year", state.year);
  if (state.statementType) qs.set("statementType", state.statementType);
  if (state.userId) qs.set("userId", state.userId);
  if (state.from) qs.set("from", state.from);
  if (state.to) qs.set("to", state.to);
  if (state.q.trim()) qs.set("q", state.q.trim());

  if (!state.realOnly) qs.set("realOnly", "0");

  if (state.mine) qs.set("mine", "1");

  return qs;
}

export default function AuditFilters(props: AuditFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [state, setState] = useState(props.initial);

  const initialQuery = useMemo(() => buildQueryFromState(props.initial).toString(), [props.initial]);
  const desiredQuery = useMemo(() => buildQueryFromState(state).toString(), [state]);

  const debounceRef = useRef<number | null>(null);
  const initialMount = useRef(true);

  useEffect(() => {
    if (initialMount.current) {
      initialMount.current = false;
      return;
    }

    if (initialQuery === desiredQuery) return;

    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      const href = desiredQuery ? `${pathname}?${desiredQuery}` : pathname;
      router.replace(href);
    }, 300);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [desiredQuery, initialQuery, pathname, router]);

  return (
    <form
      className={styles.filters}
      onSubmit={(e) => {
        e.preventDefault();
      }}
    >
      <div className={styles.field}>
        <label>Hospital</label>
        <select name="hospitalId" value={state.hospitalId} onChange={(e) => setState((s) => ({ ...s, hospitalId: e.target.value }))}>
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
        <input type="date" name="from" value={state.from} onChange={(e) => setState((s) => ({ ...s, from: e.target.value }))} />
      </div>

      <div className={styles.field}>
        <label>Zeitraum bis</label>
        <input type="date" name="to" value={state.to} onChange={(e) => setState((s) => ({ ...s, to: e.target.value }))} />
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
            <input type="checkbox" checked={state.realOnly} onChange={(e) => setState((s) => ({ ...s, realOnly: e.target.checked }))} />
            Nur echte Änderungen
          </label>
        </div>
        <div className={styles.checkRow}>
          <label className={styles.checkLabel}>
            <input type="checkbox" checked={state.mine} onChange={(e) => setState((s) => ({ ...s, mine: e.target.checked }))} />
            Nur meine
          </label>
        </div>
      </div>

      <div className={styles.field}>
        <label>Jahr</label>
        <select name="year" value={state.year} onChange={(e) => setState((s) => ({ ...s, year: e.target.value }))}>
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

      <div className={styles.actions}>
        <Link className={styles.secondary} href="/dashboard/audit">
          Reset
        </Link>
      </div>
    </form>
  );
}
