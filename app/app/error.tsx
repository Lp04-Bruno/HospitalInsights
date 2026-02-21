"use client";

import { ErrorState } from "@/app/_components/ErrorState";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      title="Etwas ist schiefgelaufen"
      subtitle="Beim Laden der Seite ist ein Fehler aufgetreten."
      error={error}
      onRetry={reset}
      linkAction={{ href: "/", label: "Zur Startseite" }}
    />
  );
}
