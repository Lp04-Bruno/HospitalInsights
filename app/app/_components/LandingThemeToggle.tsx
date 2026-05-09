"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import styles from "../page.module.css";

type Theme = "light" | "dark";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  for (const listener of listeners) listener();
}

function storedTheme(): Theme {
  const stored = window.localStorage.getItem("landing-theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getSnapshot(): Theme {
  const current = document.documentElement.dataset.landingTheme;
  return current === "dark" || current === "light" ? current : storedTheme();
}

function getServerSnapshot(): Theme {
  return "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.landingTheme = theme;
  window.localStorage.setItem("landing-theme", theme);
  emit();
}

export default function LandingThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    applyTheme(storedTheme());
  }, []);

  function toggleTheme() {
    applyTheme(theme === "dark" ? "light" : "dark");
  }

  return (
    <button
      className={styles.themeToggle}
      type="button"
      aria-label={theme === "dark" ? "Light Mode aktivieren" : "Dark Mode aktivieren"}
      title={theme === "dark" ? "Light Mode" : "Dark Mode"}
      onClick={toggleTheme}
    >
      <span className={styles.themeIcon} aria-hidden="true">
        {theme === "dark" ? <Sun size={19} strokeWidth={2.2} /> : <Moon size={19} strokeWidth={2.2} />}
      </span>
    </button>
  );
}
