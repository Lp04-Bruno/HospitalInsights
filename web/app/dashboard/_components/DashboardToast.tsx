"use client";

import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { clearFlashSearchParams, type FlashMessage } from "@/lib/actionResult";

import styles from "./DashboardToast.module.css";

const icons = {
  danger: XCircle,
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
} as const;

type DashboardToastProps = {
  flash?: FlashMessage;
  durationMs?: number;
};

export function DashboardToast({ flash, durationMs = 6500 }: DashboardToastProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(Boolean(flash));

  const dismiss = useCallback(() => {
    setVisible(false);
    const params = clearFlashSearchParams(new URLSearchParams(searchParams.toString()));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    setVisible(Boolean(flash));
  }, [flash]);

  useEffect(() => {
    if (!flash || !visible) return;
    const timeout = window.setTimeout(dismiss, durationMs);
    return () => window.clearTimeout(timeout);
  }, [dismiss, durationMs, flash, visible]);

  if (!flash || !visible) return null;

  const Icon = icons[flash.tone];
  const role = flash.tone === "danger" || flash.tone === "warning" ? "alert" : "status";

  return (
    <div className={styles.viewport} aria-live="polite">
      <div className={styles.toast} data-tone={flash.tone} role={role}>
        <Icon className={styles.icon} size={18} aria-hidden="true" />
        <div className={styles.message}>{flash.message}</div>
        <button type="button" className={styles.close} onClick={dismiss} aria-label="Benachrichtigung schließen">
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
