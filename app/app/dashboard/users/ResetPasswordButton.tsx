"use client";

type Props = {
    userId: string;
    email: string;
    className?: string;
};

export function ResetPasswordButton({ userId, email, className }: Props) {
    async function onClick() {
        const ok = window.confirm(
            `Passwort für ${email} wirklich zurücksetzen? Das alte Passwort ist danach ungültig.`
        );
        if (!ok) return;

        const res = await fetch("/dashboard/users/reset-password", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ userId }),
        });

        if (!res.ok) {
            const text = await res.text().catch(() => "");
            alert(`Fehler beim Zurücksetzen (${res.status}). ${text}`.trim());
            return;
        }

        const data = (await res.json()) as { tempPassword: string; email: string };

        try {
            await navigator.clipboard.writeText(data.tempPassword);
            window.alert(`Neues Passwort für ${data.email}:\n\n${data.tempPassword}\n\n(In die Zwischenablage kopiert)`);
        } catch {
            window.prompt(`Neues Passwort für ${data.email} (kopieren):`, data.tempPassword);
        }
    }

    return (
        <button type="button" onClick={onClick} className={className}>
            Passwort zurücksetzen
        </button>
    );
}
