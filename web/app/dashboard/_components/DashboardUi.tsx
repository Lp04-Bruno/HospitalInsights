import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import styles from "./DashboardUi.module.css";

type Tone = "primary" | "secondary" | "danger";
type NoticeTone = "neutral" | "warning" | "danger" | "success";

const buttonToneClass: Record<Tone, string> = {
  danger: styles.danger,
  primary: styles.primary,
  secondary: styles.secondary,
};

const noticeToneClass: Record<NoticeTone, string> = {
  danger: styles.noticeDanger,
  neutral: styles.noticeNeutral,
  success: styles.noticeSuccess,
  warning: styles.noticeWarning,
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export { styles as dashboardUi };

export function DashboardPage({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx(styles.page, className)}>{children}</section>;
}

export function DashboardHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className={styles.header}>
      <div className={styles.headerCopy}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle ? <div className={styles.subtitle}>{subtitle}</div> : null}
      </div>
      {actions ? <div className={styles.headerActions}>{actions}</div> : null}
    </header>
  );
}

export function DashboardCard({
  title,
  hint,
  children,
  className,
}: {
  title?: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx(styles.card, className)}>
      {title || hint ? (
        <div className={styles.cardHeader}>
          <div>
            {title ? <h2 className={styles.cardTitle}>{title}</h2> : null}
            {hint ? <div className={styles.cardHint}>{hint}</div> : null}
          </div>
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function DashboardGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx(styles.grid, className)}>{children}</div>;
}

export function DashboardField({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx(styles.field, className)}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export function DashboardActions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx(styles.actions, className)}>{children}</div>;
}

export function DashboardButton({
  tone = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: Tone;
}) {
  return <button className={cx(styles.button, buttonToneClass[tone], className)} {...props} />;
}

export function DashboardButtonLink({
  href,
  tone = "secondary",
  className,
  children,
}: {
  href: string;
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={cx(styles.button, buttonToneClass[tone], className)}>
      {children}
    </Link>
  );
}

export function DashboardNotice({ tone = "neutral", children, className }: { tone?: NoticeTone; children: ReactNode; className?: string }) {
  return <div className={cx(styles.notice, noticeToneClass[tone], className)}>{children}</div>;
}
