"use server";

import { prisma } from "@/lib/prisma";
import { EDITOR_ROLES, getSessionIfAllowed } from "@/lib/access";
import { parseUserNumberDetailed } from "@/lib/facts/numberParsing";
import type { SaveFactsState } from "@/lib/facts/types";
import { StatementType, Unit } from "@/prisma/generated/enums";

export async function saveFacts(_prevState: SaveFactsState, formData: FormData): Promise<SaveFactsState> {
  const hospitalId = String(formData.get("hospitalId") ?? "");
  const periodId = String(formData.get("periodId") ?? "");
  const statementType = String(formData.get("statementType") ?? "") as StatementType;

  const session = await getSessionIfAllowed(EDITOR_ROLES);
  if (!session) return { ok: false, globalError: "Nicht angemeldet oder keine Berechtigung." };

  if (!hospitalId || !periodId || !statementType) {
    return { ok: false, globalError: "Ungültige Anfrage." };
  }

  try {
    await prisma.hospitalPeriod.upsert({
      where: { hospitalId_periodId: { hospitalId, periodId } },
      update: {},
      create: { hospitalId, periodId },
    });
  } catch {
    // Keep saving possible even if the relation already exists under a race.
  }

  const inputItemsRaw = await prisma.lineItem.findMany({
    where: { statementType, isInput: true },
    orderBy: { sortOrder: "asc" },
  });

  const seenInputCodes = new Set<string>();
  const inputItems = inputItemsRaw.filter((li) => {
    if (seenInputCodes.has(li.code)) return false;
    seenInputCodes.add(li.code);
    return true;
  });

  const presentValueKeys = new Set<string>();
  for (const [k] of formData.entries()) {
    if (typeof k === "string" && k.startsWith("v:")) presentValueKeys.add(k);
  }

  const presentItems = inputItems.filter((i) => presentValueKeys.has(`v:${i.code}`));
  if (presentItems.length === 0) {
    return { ok: true, message: "Keine sichtbaren Felder zum Speichern." };
  }

  const fieldErrors: Record<string, string> = {};
  const desiredByCode = new Map<string, number | null>();

  for (const item of presentItems) {
    const key = `v:${item.code}`;
    const raw = String(formData.get(key) ?? "");
    const parsed = parseUserNumberDetailed(raw, item.unit);

    if (parsed.kind === "invalid") {
      fieldErrors[item.code] = item.unit === Unit.PERCENT ? "Ungültige Prozentzahl." : "Ungültige Zahl.";
      continue;
    }

    if (parsed.kind === "empty") {
      desiredByCode.set(item.code, null);
      continue;
    }

    const rounded = Math.round(parsed.value * 100) / 100;
    desiredByCode.set(item.code, rounded);
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      globalError: "Bitte korrigiere die markierten Felder. Es wurde nichts gespeichert.",
      fieldErrors,
    };
  }

  const codes = presentItems.map((i) => i.code);
  const existing = await prisma.factValue.findMany({
    where: {
      hospitalId,
      periodId,
      lineItemCode: { in: codes },
    },
    select: { lineItemCode: true, value: true },
  });

  const existingByCode = new Map<string, number | null>();
  for (const v of existing) {
    const n = v.value === null ? null : Number(v.value.toString());
    existingByCode.set(v.lineItemCode, Number.isFinite(n as number) ? (n as number) : null);
  }

  const changes: Array<{ code: string; unit: (typeof presentItems)[number]["unit"]; before: number | null; after: number | null }> = [];
  for (const item of presentItems) {
    const after = desiredByCode.get(item.code) ?? null;
    const before = existingByCode.get(item.code) ?? null;
    if (before === after) continue;
    changes.push({ code: item.code, unit: item.unit, before, after });
  }

  if (changes.length === 0) {
    return { ok: true, message: "Keine Änderungen zum Speichern." };
  }

  const now = new Date();
  const savedBy = session.user.email ?? session.user.name ?? "";
  const dbUserId = session.user.id || null;

  try {
    await prisma.$transaction(async (tx) => {
      const run = await tx.factChangeRun.create({
        data: {
          hospitalId,
          periodId,
          statementType,
          userId: dbUserId,
          createdAt: now,
        },
        select: { id: true },
      });

      for (const c of changes) {
        if (c.after === null) {
          await tx.factValue.deleteMany({ where: { hospitalId, periodId, lineItemCode: c.code } });
        } else {
          await tx.factValue.upsert({
            where: {
              hospitalId_periodId_lineItemCode: {
                hospitalId,
                periodId,
                lineItemCode: c.code,
              },
            },
            update: { value: c.after },
            create: { hospitalId, periodId, lineItemCode: c.code, value: c.after },
          });
        }

        await tx.factChange.create({
          data: {
            runId: run.id,
            hospitalId,
            periodId,
            statementType,
            lineItemCode: c.code,
            unit: c.unit,
            beforeValue: c.before,
            afterValue: c.after,
            createdAt: now,
          },
        });
      }
    });
  } catch (err) {
    console.error("saveFacts failed", { hospitalId, periodId, statementType, userId: session.user.id }, err);
    return {
      ok: false,
      globalError: "Speichern fehlgeschlagen (Datenbankfehler). Es wurden keine Änderungen übernommen.",
    };
  }

  return {
    ok: true,
    message: "Gespeichert.",
    savedAt: now.toISOString(),
    savedBy: savedBy || undefined,
    changesApplied: changes.length,
  };
}
