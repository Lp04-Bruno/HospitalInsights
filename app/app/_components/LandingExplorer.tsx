"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import styles from "../page.module.css";
import { getConsentServerSnapshot, getConsentSnapshot, subscribeConsent } from "./consent";

type ViewOption = {
  type: "dashboard" | "question";
  id: number;
  name: string;
  hospitalParamKey?: string;
};

type HospitalOption = {
  id: string;
  name: string;
  city: string;
  state: string;
};

type Props = {
  views: ViewOption[];
  hospitals: HospitalOption[];
  initialView?: { type: "dashboard" | "question"; id: number };
};

type EmbedState = { status: "idle" } | { status: "loading" } | { status: "ready"; url: string } | { status: "error"; message: string };

function initialViewKey(views: ViewOption[], initialView?: { type: "dashboard" | "question"; id: number }) {
  const preferred =
    initialView && views.some((v) => v.type === initialView.type && v.id === initialView.id)
      ? views.find((v) => v.type === initialView.type && v.id === initialView.id)
      : undefined;

  const chosen = preferred ?? views[0];
  return chosen ? `${chosen.type}:${chosen.id}` : "";
}

function hospitalLabel(h: HospitalOption) {
  const suffix = [h.city, h.state].filter(Boolean).join(", ");
  return suffix ? `${h.name} (${suffix})` : h.name;
}

async function fetchViewIframeUrl(view: ViewOption, hospitalId?: string) {
  const params = new URLSearchParams();
  if (hospitalId) params.set("hospitalId", hospitalId);
  if (view.hospitalParamKey) params.set("paramKey", view.hospitalParamKey);

  const base = view.type === "question" ? "question" : "dashboard";
  const res = await fetch(`/api/metabase/embed/${base}/${view.id}?${params.toString()}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || `Embed request failed (${res.status})`);
  }

  const body = (await res.json()) as { iframeUrl?: string };
  if (!body.iframeUrl) throw new Error("No iframeUrl returned.");
  return body.iframeUrl;
}

function parseViewKey(views: ViewOption[], viewKey: string): ViewOption | undefined {
  const [type, idRaw] = viewKey.split(":");
  const id = Number(idRaw);
  if ((type !== "dashboard" && type !== "question") || !Number.isFinite(id)) return undefined;
  return views.find((v) => v.type === type && v.id === id);
}

export default function LandingExplorer({ views, hospitals, initialView }: Props) {
  const consent = useSyncExternalStore(subscribeConsent, getConsentSnapshot, getConsentServerSnapshot);
  const [viewKey, setViewKey] = useState<string>(() => initialViewKey(views, initialView));
  const [hospitalA, setHospitalA] = useState<string>("");
  const [compare, setCompare] = useState(false);
  const [hospitalB, setHospitalB] = useState<string>("");

  const [embedA, setEmbedA] = useState<EmbedState>({ status: "idle" });
  const [embedB, setEmbedB] = useState<EmbedState>({ status: "idle" });

  const requestSeqA = useRef(0);
  const requestSeqB = useRef(0);

  const canLoadEmbeds = consent === "accepted";

  useEffect(() => {
    if (!canLoadEmbeds) return;
    if (viewKey && hospitalA) loadEmbedA(viewKey, hospitalA);
    if (compare && viewKey && hospitalB) loadEmbedB(viewKey, hospitalB);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canLoadEmbeds]);

  function loadEmbedA(nextViewKey: string, nextHospitalId: string) {
    if (!canLoadEmbeds) {
      setEmbedA({ status: "idle" });
      return;
    }

    const view = parseViewKey(views, nextViewKey);
    if (!view || !nextHospitalId) {
      setEmbedA({ status: "idle" });
      return;
    }

    const seq = ++requestSeqA.current;
    setEmbedA({ status: "loading" });
    fetchViewIframeUrl(view, nextHospitalId)
      .then((url) => {
        if (requestSeqA.current !== seq) return;
        setEmbedA({ status: "ready", url });
      })
      .catch((e: unknown) => {
        if (requestSeqA.current !== seq) return;
        setEmbedA({ status: "error", message: e instanceof Error ? e.message : "Embed error" });
      });
  }

  function loadEmbedB(nextViewKey: string, nextHospitalId: string) {
    if (!canLoadEmbeds) {
      setEmbedB({ status: "idle" });
      return;
    }

    const view = parseViewKey(views, nextViewKey);
    if (!view || !nextHospitalId) {
      setEmbedB({ status: "idle" });
      return;
    }

    const seq = ++requestSeqB.current;
    setEmbedB({ status: "loading" });
    fetchViewIframeUrl(view, nextHospitalId)
      .then((url) => {
        if (requestSeqB.current !== seq) return;
        setEmbedB({ status: "ready", url });
      })
      .catch((e: unknown) => {
        if (requestSeqB.current !== seq) return;
        setEmbedB({ status: "error", message: e instanceof Error ? e.message : "Embed error" });
      });
  }

  const selectedView = parseViewKey(views, viewKey);
  const hospitalASelected = hospitals.find((h) => h.id === hospitalA);
  const hospitalBSelected = hospitals.find((h) => h.id === hospitalB);

  return (
    <section className={styles.explorer} aria-label="Auswahl">
      <div className={styles.controlsCard}>
        <div className={styles.controlsHeader}>
          <h3 className={styles.controlsTitle}>Auswahl</h3>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={compare}
              onChange={(e) => {
                const next = e.target.checked;
                setCompare(next);
                if (!next) {
                  setHospitalB("");
                  setEmbedB({ status: "idle" });
                } else if (hospitalB && canLoadEmbeds) {
                  loadEmbedB(viewKey, hospitalB);
                }
              }}
            />
            <span>Vergleich</span>
          </label>
        </div>

        <div className={styles.controlsGrid}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Ansicht</span>
            <select
              className={styles.select}
              value={viewKey}
              onChange={(e) => {
                const nextKey = e.target.value;
                setViewKey(nextKey);
                if (canLoadEmbeds) {
                  loadEmbedA(nextKey, hospitalA);
                  if (compare) loadEmbedB(nextKey, hospitalB);
                } else {
                  setEmbedA({ status: "idle" });
                  setEmbedB({ status: "idle" });
                }
              }}
            >
              {views.length === 0 ? (
                <option value="">Keine Ansichten konfiguriert</option>
              ) : (
                views.map((v) => (
                  <option key={`${v.type}:${v.id}`} value={`${v.type}:${v.id}`}>
                    {v.name}
                  </option>
                ))
              )}
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>{compare ? "Krankenhaus A" : "Krankenhaus"}</span>
            <select
              className={styles.select}
              value={hospitalA}
              onChange={(e) => {
                const nextHospitalId = e.target.value;
                setHospitalA(nextHospitalId);
                if (canLoadEmbeds) loadEmbedA(viewKey, nextHospitalId);
                else setEmbedA({ status: "idle" });
              }}
            >
              <option value="">Bitte auswählen</option>
              {hospitals.map((h) => (
                <option key={h.id} value={h.id}>
                  {hospitalLabel(h)}
                </option>
              ))}
            </select>
          </label>

          {compare ? (
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Krankenhaus B</span>
              <select
                className={styles.select}
                value={hospitalB}
                onChange={(e) => {
                  const nextHospitalId = e.target.value;
                  setHospitalB(nextHospitalId);
                  if (compare && canLoadEmbeds) loadEmbedB(viewKey, nextHospitalId);
                  else setEmbedB({ status: "idle" });
                }}
              >
                <option value="">Bitte auswählen</option>
                {hospitals.map((h) => (
                  <option key={h.id} value={h.id}>
                    {hospitalLabel(h)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className={styles.hint}>{selectedView ? `${selectedView.name} · ` : ""}Datenquelle: Metabase</div>
        </div>
      </div>

      <div className={compare ? styles.embedsCompare : styles.embedsSingle}>
        <div className={styles.embedCard}>
          <div className={styles.embedHeader}>
            <div className={styles.embedTitle}>{compare ? "A" : "Ausgabe"}</div>
            <div className={styles.embedMeta}>{hospitalASelected ? hospitalLabel(hospitalASelected) : "Bitte auswählen"}</div>
          </div>
          <div className={styles.embedBody}>
            {!canLoadEmbeds ? (
              <div className={styles.embedPlaceholder}>Externe Inhalte (Metabase) sind deaktiviert. Bitte im Cookie-Banner zustimmen.</div>
            ) : embedA.status === "idle" ? (
              <div className={styles.embedPlaceholder}>Ansicht und Krankenhaus auswählen.</div>
            ) : embedA.status === "loading" ? (
              <div className={styles.embedPlaceholder}>Lädt…</div>
            ) : embedA.status === "error" ? (
              <div className={styles.embedError}>{embedA.message}</div>
            ) : (
              <iframe title="Metabase Embed A" src={embedA.url} className={styles.frame} />
            )}
          </div>
        </div>

        {compare ? (
          <div className={styles.embedCard}>
            <div className={styles.embedHeader}>
              <div className={styles.embedTitle}>B</div>
              <div className={styles.embedMeta}>{hospitalBSelected ? hospitalLabel(hospitalBSelected) : "Bitte auswählen"}</div>
            </div>
            <div className={styles.embedBody}>
              {!canLoadEmbeds ? (
                <div className={styles.embedPlaceholder}>
                  Externe Inhalte (Metabase) sind deaktiviert. Bitte im Cookie-Banner zustimmen.
                </div>
              ) : embedB.status === "idle" ? (
                <div className={styles.embedPlaceholder}>Krankenhaus B auswählen.</div>
              ) : embedB.status === "loading" ? (
                <div className={styles.embedPlaceholder}>Lädt…</div>
              ) : embedB.status === "error" ? (
                <div className={styles.embedError}>{embedB.message}</div>
              ) : (
                <iframe title="Metabase Embed B" src={embedB.url} className={styles.frame} />
              )}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
