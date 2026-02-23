"use client";

import { ErrorState } from "@/app/_components/ErrorState";

export default function DashboardDataError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      title="Datenverwaltung"
      subtitle="Beim Laden oder Speichern ist ein Fehler aufgetreten."
      error={error}
      onRetry={reset}
      linkAction={{ href: "/dashboard", label: "Zum Dashboard" }}
      supportHint="Wenn möglich: Hospital/Jahr/Bereich nennen."
    />
  );
}
