import { DashboardHeader, DashboardNotice, DashboardPage } from "@/app/dashboard/_components/DashboardUi";

export default function ForbiddenPage() {
  return (
    <DashboardPage>
      <DashboardHeader title="Zugriff verweigert" />
      <DashboardNotice tone="warning">
        Du bist eingeloggt, hast aber keine Berechtigung für diesen Bereich. Wenn du glaubst, dass das ein Fehler ist, wende dich an einen
        Admin.
      </DashboardNotice>
    </DashboardPage>
  );
}
