"use client";

import { ErrorState } from "@/app/_components/ErrorState";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      title="Dashboard"
      subtitle="Im internen Bereich ist ein Fehler aufgetreten."
      error={error}
      onRetry={reset}
      linkAction={{ href: "/dashboard", label: "Zur Übersicht" }}
    />
  );
}
